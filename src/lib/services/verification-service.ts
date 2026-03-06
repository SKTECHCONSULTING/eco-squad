import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { RekognitionClient, DetectLabelsCommand, DetectModerationLabelsCommand } from '@aws-sdk/client-rekognition';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-west-1',
});

const rekognitionClient = new RekognitionClient({
  region: process.env.AWS_REGION || 'eu-west-1',
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'eco-squad-evidence';

export interface VerificationResult {
  isValid: boolean;
  confidence: number;
  labels: string[];
  detectedObjects: Array<{
    name: string;
    confidence: number;
  }>;
  moderationFlags: string[];
  reasoning: string;
}

/**
 * Generate a pre-signed URL for uploading evidence images
 */
export async function generateUploadUrl(missionId: string, fileName: string): Promise<{ uploadUrl: string; s3Key: string }> {
  const s3Key = `evidence/${missionId}/${Date.now()}-${fileName}`;
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    ContentType: 'image/jpeg',
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 minutes

  return { uploadUrl, s3Key };
}

/**
 * Generate a pre-signed URL for viewing evidence images
 */
export async function generateViewUrl(s3Key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  });

  return getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
}

/**
 * Verify evidence image using AWS Rekognition
 */
export async function verifyEvidence(s3Key: string, missionType: string): Promise<VerificationResult> {
  try {
    // Check for inappropriate content first
    const moderationResponse = await rekognitionClient.send(
      new DetectModerationLabelsCommand({
        Image: {
          S3Object: {
            Bucket: BUCKET_NAME,
            Name: s3Key,
          },
        },
        MinConfidence: 60,
      })
    );

    const moderationFlags = moderationResponse.ModerationLabels?.map(label => label.Name || '') || [];
    
    if (moderationFlags.length > 0) {
      return {
        isValid: false,
        confidence: 0,
        labels: [],
        detectedObjects: [],
        moderationFlags,
        reasoning: 'Image contains inappropriate content',
      };
    }

    // Detect labels in the image
    const labelsResponse = await rekognitionClient.send(
      new DetectLabelsCommand({
        Image: {
          S3Object: {
            Bucket: BUCKET_NAME,
            Name: s3Key,
          },
        },
        MaxLabels: 50,
        MinConfidence: 70,
      })
    );

    const labels = labelsResponse.Labels?.map(label => label.Name || '') || [];
    const detectedObjects = labelsResponse.Labels?.map(label => ({
      name: label.Name || '',
      confidence: label.Confidence || 0,
    })) || [];

    // Verify based on mission type
    const verification = verifyByMissionType(labels, missionType);

    return {
      isValid: verification.isValid,
      confidence: verification.confidence,
      labels,
      detectedObjects,
      moderationFlags: [],
      reasoning: verification.reasoning,
    };
  } catch (error) {
    // Sanitized logging - don't expose raw error details or PII
    console.error('Verification failed for mission type:', { 
      missionType, 
      s3KeyPrefix: s3Key.split('/')[0] // Log only the prefix, not full key
    });
    return {
      isValid: false,
      confidence: 0,
      labels: [],
      detectedObjects: [],
      moderationFlags: [],
      reasoning: 'Error during verification process',
    };
  }
}

/**
 * Verify image content based on mission type
 */
function verifyByMissionType(labels: string[], missionType: string): { isValid: boolean; confidence: number; reasoning: string } {
  const normalizedLabels = labels.map(l => l.toLowerCase());

  switch (missionType) {
    case 'LITTER_COLLECTION':
      const litterKeywords = ['trash', 'garbage', 'litter', 'waste', 'plastic', 'bottle', 'bag', 'container'];
      const litterMatches = normalizedLabels.filter(label => 
        litterKeywords.some(keyword => label.includes(keyword))
      );
      const outdoorKeywords = ['outdoor', 'nature', 'park', 'street', 'road', 'grass', 'tree'];
      const isOutdoor = normalizedLabels.some(label => 
        outdoorKeywords.some(keyword => label.includes(keyword))
      );
      
      if (litterMatches.length > 0 && isOutdoor) {
        return {
          isValid: true,
          confidence: Math.min(litterMatches.length * 15 + 50, 95),
          reasoning: `Detected ${litterMatches.length} litter-related objects in outdoor setting`,
        };
      }
      return {
        isValid: false,
        confidence: 0,
        reasoning: 'No litter detected or not in outdoor setting',
      };

    case 'TREE_PLANTING':
      const treeKeywords = ['tree', 'plant', 'sapling', 'soil', 'gardening', 'shovel', 'planting'];
      const treeMatches = normalizedLabels.filter(label => 
        treeKeywords.some(keyword => label.includes(keyword))
      );
      
      if (treeMatches.length >= 2) {
        return {
          isValid: true,
          confidence: Math.min(treeMatches.length * 20 + 40, 90),
          reasoning: `Detected ${treeMatches.length} tree-planting related objects`,
        };
      }
      return {
        isValid: false,
        confidence: 0,
        reasoning: 'Insufficient evidence of tree planting activity',
      };

    case 'BIO_DIVERSITY':
      const bioKeywords = ['animal', 'bird', 'insect', 'plant', 'flower', 'wildlife', 'nature', 'tree'];
      const bioMatches = normalizedLabels.filter(label => 
        bioKeywords.some(keyword => label.includes(keyword))
      );
      
      if (bioMatches.length > 0) {
        return {
          isValid: true,
          confidence: Math.min(bioMatches.length * 20 + 50, 90),
          reasoning: `Detected biodiversity elements: ${bioMatches.join(', ')}`,
        };
      }
      return {
        isValid: false,
        confidence: 0,
        reasoning: 'No biodiversity indicators detected',
      };

    default:
      // For other mission types, accept if we have reasonable outdoor/nature content
      const generalKeywords = ['outdoor', 'nature', 'environment', 'green'];
      const generalMatches = normalizedLabels.filter(label => 
        generalKeywords.some(keyword => label.includes(keyword))
      );
      
      return {
        isValid: generalMatches.length > 0,
        confidence: generalMatches.length > 0 ? 60 : 0,
        reasoning: generalMatches.length > 0 ? 'General environmental activity detected' : 'No relevant content detected',
      };
  }
}
