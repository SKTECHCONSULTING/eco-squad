const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { RekognitionClient, DetectLabelsCommand, DetectModerationLabelsCommand } = require('@aws-sdk/client-rekognition');

// Initialize AWS clients
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-west-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const rekognitionClient = new RekognitionClient({ region: process.env.AWS_REGION || 'eu-west-1' });

// Configuration
const TABLE_NAME = process.env.TABLE_NAME;
const BUCKET_NAME = process.env.BUCKET_NAME;
const MIN_CONFIDENCE = parseInt(process.env.REKOGNITION_MIN_CONFIDENCE || '70', 10);
const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';

/**
 * Lambda handler for S3 upload events
 * Triggers AWS Rekognition analysis and updates DynamoDB with results
 */
exports.handler = async (event) => {
  console.log('Verification Lambda triggered:', JSON.stringify(event, null, 2));

  const results = [];

  for (const record of event.Records) {
    try {
      const result = await processRecord(record);
      results.push(result);
    } catch (error) {
      console.error('Error processing record:', error);
      results.push({
        recordId: record.s3.object.key,
        status: 'ERROR',
        error: error.message,
      });
    }
  }

  console.log('Processing complete:', JSON.stringify(results, null, 2));
  return { statusCode: 200, body: JSON.stringify(results) };
};

/**
 * Process a single S3 event record
 */
async function processRecord(record) {
  const bucketName = record.s3.bucket.name;
  const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

  console.log(`Processing object: ${bucketName}/${objectKey}`);

  // Extract mission ID from the key (format: evidence/{missionId}/{timestamp}-{filename})
  const keyParts = objectKey.split('/');
  if (keyParts.length < 3 || keyParts[0] !== 'evidence') {
    throw new Error(`Invalid object key format: ${objectKey}`);
  }

  const missionId = keyParts[1];
  const evidenceId = keyParts[2];

  console.log(`Mission ID: ${missionId}, Evidence ID: ${evidenceId}`);

  // Step 1: Check for inappropriate content
  const moderationResult = await checkModeration(bucketName, objectKey);
  if (moderationResult.hasInappropriateContent) {
    console.log('Inappropriate content detected, rejecting evidence');
    await updateMissionWithVerification(missionId, evidenceId, {
      verificationStatus: 'REJECTED',
      verificationResult: {
        labels: [],
        confidence: 0,
        detectedObjects: [],
        moderationFlags: moderationResult.flags,
      },
      aiConfidence: 0,
    });

    return {
      missionId,
      evidenceId,
      status: 'REJECTED',
      reason: 'Inappropriate content detected',
      moderationFlags: moderationResult.flags,
    };
  }

  // Step 2: Get mission details from DynamoDB
  const mission = await getMission(missionId);
  if (!mission) {
    throw new Error(`Mission not found: ${missionId}`);
  }

  // Step 3: Detect labels in the image
  const labelResult = await detectLabels(bucketName, objectKey);

  // Step 4: Verify based on mission type
  const verification = verifyByMissionType(
    labelResult.labels,
    labelResult.detectedObjects,
    mission.data?.type || 'GENERAL'
  );

  console.log('Verification result:', JSON.stringify(verification, null, 2));

  // Step 5: Update mission with verification results
  const verificationStatus = verification.isValid ? 'VERIFIED' : 'MANUAL_REVIEW';
  const impactPoints = verification.isValid 
    ? calculateImpactPoints(mission.data?.type, verification.confidence)
    : 0;

  await updateMissionWithVerification(missionId, evidenceId, {
    verificationStatus,
    verificationResult: {
      labels: labelResult.labels,
      confidence: verification.confidence,
      detectedObjects: labelResult.detectedObjects,
      moderationFlags: [],
    },
    aiConfidence: verification.confidence,
    impactPointsAwarded: impactPoints,
  });

  // Step 6: If verified, update user/squad impact points
  if (verification.isValid && mission.claimedBy) {
    await awardImpactPoints(mission.claimedBy, impactPoints);
  }

  return {
    missionId,
    evidenceId,
    status: verificationStatus,
    confidence: verification.confidence,
    impactPoints,
    reasoning: verification.reasoning,
  };
}

/**
 * Check for inappropriate/moderation content
 */
async function checkModeration(bucketName, objectKey) {
  const command = new DetectModerationLabelsCommand({
    Image: {
      S3Object: {
        Bucket: bucketName,
        Name: objectKey,
      },
    },
    MinConfidence: MIN_CONFIDENCE,
  });

  const response = await rekognitionClient.send(command);
  const flags = (response.ModerationLabels || []).map(label => ({
    name: label.Name,
    confidence: label.Confidence,
    parentName: label.ParentName,
  }));

  // Check for high-severity moderation labels
  const highSeverityLabels = [
    'Explicit Nudity',
    'Violence',
    'Graphic Violence',
    'Weapons',
    'Drugs',
    'Hate Symbols',
  ];

  const hasInappropriateContent = flags.some(flag => 
    highSeverityLabels.some(severe => 
      flag.name?.includes(severe) || flag.parentName?.includes(severe)
    )
  );

  return {
    hasInappropriateContent,
    flags,
  };
}

/**
 * Detect labels in the image using AWS Rekognition
 */
async function detectLabels(bucketName, objectKey) {
  const command = new DetectLabelsCommand({
    Image: {
      S3Object: {
        Bucket: bucketName,
        Name: objectKey,
      },
    },
    MaxLabels: 50,
    MinConfidence: MIN_CONFIDENCE,
  });

  const response = await rekognitionClient.send(command);

  const labels = (response.Labels || []).map(label => label.Name || '');
  const detectedObjects = (response.Labels || []).map(label => ({
    name: label.Name || '',
    confidence: label.Confidence || 0,
    parents: (label.Parents || []).map(p => p.Name || ''),
  }));

  return {
    labels,
    detectedObjects,
  };
}

/**
 * Get mission details from DynamoDB
 */
async function getMission(missionId) {
  const command = new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `MISSION#${missionId}`,
      SK: `METADATA#${missionId}`,
    },
  });

  const response = await docClient.send(command);
  return response.Item;
}

/**
 * Update mission with verification results
 */
async function updateMissionWithVerification(missionId, evidenceId, verificationData) {
  const command = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `MISSION#${missionId}`,
      SK: `METADATA#${missionId}`,
    },
    UpdateExpression: 'SET #evidence = :evidence, #status = :status, #updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#evidence': 'evidence',
      '#status': 'status',
      '#updatedAt': 'updatedAt',
    },
    ExpressionAttributeValues: {
      ':evidence': {
        evidenceId,
        ...verificationData,
        verifiedAt: new Date().toISOString(),
      },
      ':status': verificationData.verificationStatus === 'VERIFIED' 
        ? 'PENDING_VERIFICATION' 
        : verificationData.verificationStatus,
      ':updatedAt': new Date().toISOString(),
    },
  });

  await docClient.send(command);
  console.log(`Updated mission ${missionId} with verification results`);
}

/**
 * Verify image content based on mission type
 */
function verifyByMissionType(labels, detectedObjects, missionType) {
  const normalizedLabels = labels.map(l => l.toLowerCase());

  switch (missionType) {
    case 'LITTER_COLLECTION':
      return verifyLitterCollection(normalizedLabels, detectedObjects);
    case 'TREE_PLANTING':
      return verifyTreePlanting(normalizedLabels, detectedObjects);
    case 'BIO_DIVERSITY':
      return verifyBiodiversity(normalizedLabels, detectedObjects);
    case 'WATER_QUALITY':
      return verifyWaterQuality(normalizedLabels, detectedObjects);
    case 'RECYCLING':
      return verifyRecycling(normalizedLabels, detectedObjects);
    case 'RESTORATION':
      return verifyRestoration(normalizedLabels, detectedObjects);
    default:
      return verifyGeneral(normalizedLabels, detectedObjects);
  }
}

/**
 * Verify litter collection mission
 */
function verifyLitterCollection(labels, detectedObjects) {
  const litterKeywords = [
    'trash', 'garbage', 'litter', 'waste', 'rubbish', 'debris',
    'plastic', 'bottle', 'bag', 'container', 'can', 'wrapper',
    'cleanup', 'collecting', 'picker', 'glove',
  ];
  
  const outdoorKeywords = [
    'outdoor', 'nature', 'park', 'street', 'road', 'grass',
    'tree', 'sidewalk', 'beach', 'forest', 'trail',
  ];

  const litterMatches = labels.filter(label => 
    litterKeywords.some(keyword => label.includes(keyword))
  );
  
  const isOutdoor = labels.some(label => 
    outdoorKeywords.some(keyword => label.includes(keyword))
  );

  if (litterMatches.length > 0 && isOutdoor) {
    const confidence = Math.min(litterMatches.length * 15 + 50, 95);
    return {
      isValid: true,
      confidence,
      reasoning: `Detected ${litterMatches.length} litter-related objects in outdoor setting`,
    };
  }

  return {
    isValid: false,
    confidence: 0,
    reasoning: 'No litter detected or not in outdoor setting',
  };
}

/**
 * Verify tree planting mission
 */
function verifyTreePlanting(labels, detectedObjects) {
  const treeKeywords = [
    'tree', 'plant', 'sapling', 'seedling', 'soil', 'dirt',
    'gardening', 'shovel', 'spade', 'planting', 'hole',
    'watering', 'pot', 'roots', 'foliage', 'leaf',
  ];

  const treeMatches = labels.filter(label => 
    treeKeywords.some(keyword => label.includes(keyword))
  );

  if (treeMatches.length >= 2) {
    const confidence = Math.min(treeMatches.length * 20 + 40, 90);
    return {
      isValid: true,
      confidence,
      reasoning: `Detected ${treeMatches.length} tree-planting related objects`,
    };
  }

  return {
    isValid: false,
    confidence: 0,
    reasoning: 'Insufficient evidence of tree planting activity',
  };
}

/**
 * Verify biodiversity mission
 */
function verifyBiodiversity(labels, detectedObjects) {
  const bioKeywords = [
    'animal', 'bird', 'insect', 'wildlife', 'fauna',
    'plant', 'flower', 'tree', 'shrub', 'flora',
    'nature', 'species', 'habitat', 'ecosystem',
  ];

  const bioMatches = labels.filter(label => 
    bioKeywords.some(keyword => label.includes(keyword))
  );

  if (bioMatches.length > 0) {
    const confidence = Math.min(bioMatches.length * 20 + 50, 90);
    return {
      isValid: true,
      confidence,
      reasoning: `Detected biodiversity elements: ${bioMatches.slice(0, 3).join(', ')}`,
    };
  }

  return {
    isValid: false,
    confidence: 0,
    reasoning: 'No biodiversity indicators detected',
  };
}

/**
 * Verify water quality mission
 */
function verifyWaterQuality(labels, detectedObjects) {
  const waterKeywords = [
    'water', 'river', 'lake', 'stream', 'pond', 'ocean', 'sea',
    'testing', 'sample', 'kit', 'probe', 'measurement',
  ];

  const waterMatches = labels.filter(label => 
    waterKeywords.some(keyword => label.includes(keyword))
  );

  if (waterMatches.length >= 2) {
    return {
      isValid: true,
      confidence: 75,
      reasoning: 'Water body and testing equipment detected',
    };
  }

  return {
    isValid: false,
    confidence: 0,
    reasoning: 'Insufficient water quality measurement evidence',
  };
}

/**
 * Verify recycling mission
 */
function verifyRecycling(labels, detectedObjects) {
  const recycleKeywords = [
    'recycling', 'recyclable', 'bin', 'container', 'sorting',
    'paper', 'cardboard', 'plastic', 'glass', 'metal', 'aluminum',
    'symbol', 'logo', 'sign',
  ];

  const recycleMatches = labels.filter(label => 
    recycleKeywords.some(keyword => label.includes(keyword))
  );

  if (recycleMatches.length >= 2) {
    return {
      isValid: true,
      confidence: 80,
      reasoning: 'Recycling materials and containers detected',
    };
  }

  return {
    isValid: false,
    confidence: 0,
    reasoning: 'Insufficient recycling activity evidence',
  };
}

/**
 * Verify restoration mission
 */
function verifyRestoration(labels, detectedObjects) {
  const restorationKeywords = [
    'construction', 'restoration', 'repair', 'renovation',
    'volunteer', 'work', 'tools', 'equipment', 'team',
    'cleanup', 'building', 'garden', 'landscape',
  ];

  const restorationMatches = labels.filter(label => 
    restorationKeywords.some(keyword => label.includes(keyword))
  );

  if (restorationMatches.length >= 2) {
    return {
      isValid: true,
      confidence: 75,
      reasoning: 'Restoration work and tools detected',
    };
  }

  return {
    isValid: false,
    confidence: 0,
    reasoning: 'Insufficient restoration activity evidence',
  };
}

/**
 * General verification fallback
 */
function verifyGeneral(labels, detectedObjects) {
  const generalKeywords = [
    'outdoor', 'nature', 'environment', 'green', 'park',
    'volunteer', 'activity', 'event', 'work',
  ];

  const generalMatches = labels.filter(label => 
    generalKeywords.some(keyword => label.includes(keyword))
  );

  if (generalMatches.length > 0) {
    return {
      isValid: true,
      confidence: 60,
      reasoning: 'General environmental activity detected',
    };
  }

  return {
    isValid: false,
    confidence: 0,
    reasoning: 'No relevant environmental content detected',
  };
}

/**
 * Calculate impact points based on mission type and verification confidence
 */
function calculateImpactPoints(missionType, confidence) {
  const basePoints = {
    'LITTER_COLLECTION': 50,
    'TREE_PLANTING': 100,
    'BIO_DIVERSITY': 75,
    'WATER_QUALITY': 60,
    'RECYCLING': 40,
    'RESTORATION': 80,
  };

  const base = basePoints[missionType] || 50;
  
  // Apply confidence multiplier (0.7 to 1.0 range)
  const multiplier = 0.7 + (confidence / 100) * 0.3;
  
  return Math.round(base * multiplier);
}

/**
 * Award impact points to user/squad
 */
async function awardImpactPoints(userId, points) {
  // Update user's impact points
  const userUpdateCommand = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      PK: `USER#${userId}`,
      SK: `METADATA#${userId}`,
    },
    UpdateExpression: 'SET #totalImpactPoints = if_not_exists(#totalImpactPoints, :zero) + :points, #updatedAt = :updatedAt',
    ExpressionAttributeNames: {
      '#totalImpactPoints': 'totalImpactPoints',
      '#updatedAt': 'updatedAt',
    },
    ExpressionAttributeValues: {
      ':points': points,
      ':zero': 0,
      ':updatedAt': new Date().toISOString(),
    },
  });

  await docClient.send(userUpdateCommand);
  console.log(`Awarded ${points} impact points to user ${userId}`);
}
