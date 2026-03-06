export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getItem, executeTransaction, TransactWriteCommandInput } from '@/lib/db/dynamodb';
import { Mission, DynamoDBMissionItem, Evidence, Squad, DynamoDBSquadItem } from '@/types';
import {
  withErrorHandler,
  NotFoundError,
  ConflictError,
  ForbiddenError,
  ValidationError,
} from '@/lib/middleware/error-handler';
import { withBodyValidation, validateParams } from '@/lib/middleware/validation';
import { requireAuth } from '@/lib/middleware/auth';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import {
  SubmitEvidenceSchema,
  UuidParamSchema,
  SubmitEvidenceInput,
} from '@/lib/validation/schemas';

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'EcoSquadTable';
const VERIFICATION_ESTIMATED_MINUTES = 5;

// Maximum distance in meters for evidence submission
const MAX_DISTANCE_METERS = 500;

interface RouteParams {
  id: string;
  [key: string]: string;
}

/**
 * Calculate distance between two points in meters using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * POST /api/missions/:id/submit-evidence
 * Upload photo metadata and location for verification
 */
async function submitEvidence(
  request: NextRequest,
  body: SubmitEvidenceInput,
  { params, user }: { params: RouteParams; user: any }
): Promise<NextResponse> {
  const { id: missionId } = validateParams(params, UuidParamSchema);
  const { imageS3Key, lat, lng } = body;

  // Get mission
  const missionItem = await getItem<DynamoDBMissionItem>(TABLE_NAME, {
    PK: `MISSION#${missionId}`,
    SK: `METADATA#${missionId}`,
  });

  if (!missionItem) {
    throw new NotFoundError('Mission', missionId);
  }

  const mission = missionItem.data;

  // Check if mission is claimed
  if (!mission.claimedBy) {
    throw new ConflictError('Mission has not been claimed');
  }

  // Check if mission is in a state that allows evidence submission
  if (mission.status !== 'CLAIMED' && mission.status !== 'IN_PROGRESS') {
    throw new ConflictError(
      `Cannot submit evidence. Mission status: ${mission.status}`
    );
  }

  // Verify user is member of claiming squad
  const isMember = await isSquadMember(user.userId, mission.claimedBy);
  if (!isMember) {
    throw new ForbiddenError(
      'Only members of the claiming squad can submit evidence'
    );
  }

  // Validate evidence location is near mission location
  const distance = calculateDistance(
    mission.location.lat,
    mission.location.lng,
    lat,
    lng
  );

  if (distance > MAX_DISTANCE_METERS) {
    throw new ValidationError(
      `Evidence location is too far from mission location (${Math.round(
        distance
      )}m away, max ${MAX_DISTANCE_METERS}m)`
    );
  }

  // Validate S3 key format
  if (!isValidS3Key(imageS3Key)) {
    throw new ValidationError('Invalid S3 key format');
  }

  // Create evidence record
  const evidence: Evidence = {
    imageS3Key,
    submittedAt: new Date().toISOString(),
    location: { lat, lng },
    verificationStatus: 'PENDING',
  };

  const now = new Date();
  const estimatedReviewTime = new Date(
    now.getTime() + VERIFICATION_ESTIMATED_MINUTES * 60 * 1000
  );

  // Use transaction for atomic update
  const transactionInput: TransactWriteCommandInput = {
    TransactItems: [
      {
        // Update mission with evidence
        Update: {
          TableName: TABLE_NAME,
          Key: {
            PK: `MISSION#${missionId}`,
            SK: `METADATA#${missionId}`,
          },
          UpdateExpression:
            'SET #status = :pendingVerification, #data.#status = :pendingVerification, evidence = :evidence, #data.evidence = :evidence, #data.updatedAt = :now',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#data': 'data',
          },
          ExpressionAttributeValues: {
            ':pendingVerification': 'PENDING_VERIFICATION',
            ':evidence': evidence,
            ':now': now.toISOString(),
            ':claimableStatuses': ['CLAIMED', 'IN_PROGRESS'],
          },
          ConditionExpression:
            'contains(:claimableStatuses, #status)',
        },
      },
      {
        // Create evidence record for audit trail
        Put: {
          TableName: TABLE_NAME,
          Item: {
            PK: `MISSION#${missionId}`,
            SK: `EVIDENCE#${now.toISOString()}`,
            missionId,
            submittedBy: user.userId,
            squadId: mission.claimedBy,
            evidence,
            GSI1PK: `USER#${user.userId}`,
            GSI1SK: `EVIDENCE#${now.toISOString()}`,
          },
        },
      },
    ],
  };

  try {
    await executeTransaction(transactionInput);
  } catch (error: any) {
    if (error.name === 'TransactionCanceledException') {
      throw new ConflictError(
        'Could not submit evidence. Mission may have been updated by another request.'
      );
    }
    throw error;
  }

  // TODO: Trigger async verification Lambda (implement via EventBridge or SQS)
  // await triggerVerificationLambda(missionId, imageS3Key);

  return NextResponse.json({
    status: 'PENDING_VERIFICATION',
    evidenceId: `${missionId}-${now.getTime()}`,
    estimatedReviewTime: estimatedReviewTime.toISOString(),
    distanceFromMission: Math.round(distance),
  });
}

/**
 * Check if user is a member of the squad
 */
async function isSquadMember(userId: string, squadId: string): Promise<boolean> {
  const squad = await getItem<DynamoDBSquadItem>(TABLE_NAME, {
    PK: `SQUAD#${squadId}`,
    SK: `METADATA#${squadId}`,
  });

  if (!squad) return false;

  return squad.data.members.some((m) => m.userId === userId);
}

/**
 * Validate S3 key format
 */
function isValidS3Key(key: string): boolean {
  // Basic S3 key validation
  if (!key || key.length < 1 || key.length > 1024) return false;
  
  // Should not start or end with /
  if (key.startsWith('/') || key.endsWith('/')) return false;
  
  // Should not contain //
  if (key.includes('//')) return false;
  
  // Should have a valid extension for images
  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const lowerKey = key.toLowerCase();
  return validExtensions.some((ext) => lowerKey.endsWith(ext));
}

/**
 * Trigger verification Lambda (placeholder for actual implementation)
 */
async function triggerVerificationLambda(
  missionId: string,
  imageS3Key: string
): Promise<void> {
  // This would typically invoke a Lambda or publish to SNS/SQS
  console.log(`Triggering verification for mission ${missionId}, image ${imageS3Key}`);
}

// Export handler with middleware
export const POST = withErrorHandler(
  withRateLimit(
    requireAuth(async (req, user, ctx) => {
      const body = await req.json();
      const validatedBody = SubmitEvidenceSchema.parse(body);
      return submitEvidence(req, validatedBody, { ...ctx, user });
    }),
    'evidenceSubmit',
    (req) => (req as any).user?.userId
  )
);
