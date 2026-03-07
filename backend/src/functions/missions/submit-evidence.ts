import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { 
  requireAuth, 
  parseBody, 
  getPathParams,
  successResponse, 
  errorResponse,
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from '../../lib/middleware';
import { 
  getItem, 
  executeTransaction,
} from '../../lib/dynamodb';
import { 
  SubmitEvidenceSchema,
  UuidParamSchema,
} from '../../lib/validation';
import { Mission, DynamoDBMissionItem, Squad, DynamoDBSquadItem, Evidence, CognitoUser } from '../../types';

const TABLE_NAME = process.env.TABLE_NAME || '';
const VERIFICATION_ESTIMATED_MINUTES = 5;
const MAX_DISTANCE_METERS = 500;

// Calculate distance between two points in meters using Haversine formula
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
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

// POST /missions/{id}/submit-evidence - Submit evidence for a mission
export const submitEvidence = requireAuth(async (event: APIGatewayProxyEvent, user: CognitoUser): Promise<any> => {
  const { id: missionId } = UuidParamSchema.parse(getPathParams(event));
  const body = parseBody(event);
  if (!body) throw new ValidationError('Request body is required');
  
  const { imageS3Key, lat, lng } = SubmitEvidenceSchema.parse(body);

  const missionItem = await getItem<DynamoDBMissionItem>(TABLE_NAME, {
    PK: `MISSION#${missionId}`,
    SK: `METADATA#${missionId}`,
  });

  if (!missionItem) {
    throw new NotFoundError('Mission', missionId);
  }

  const mission = missionItem.data;

  if (!mission.claimedBy) {
    throw new ConflictError('Mission has not been claimed');
  }

  if (mission.status !== 'CLAIMED' && mission.status !== 'IN_PROGRESS') {
    throw new ConflictError(`Cannot submit evidence. Mission status: ${mission.status}`);
  }

  const isMember = await isSquadMember(user.userId, mission.claimedBy);
  if (!isMember) {
    throw new ForbiddenError('Only members of the claiming squad can submit evidence');
  }

  const distance = calculateDistance(
    mission.location.lat,
    mission.location.lng,
    lat,
    lng
  );

  if (distance > MAX_DISTANCE_METERS) {
    throw new ValidationError(
      `Evidence location is too far from mission location (${Math.round(distance)}m away, max ${MAX_DISTANCE_METERS}m)`
    );
  }

  if (!isValidS3Key(imageS3Key)) {
    throw new ValidationError('Invalid S3 key format');
  }

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

  const transactionInput: any = {
    TransactItems: [
      {
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
          ConditionExpression: 'contains(:claimableStatuses, #status)',
        },
      },
      {
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
      throw new ConflictError('Could not submit evidence. Mission may have been updated.');
    }
    throw error;
  }

  return {
    status: 'PENDING_VERIFICATION',
    evidenceId: `${missionId}-${now.getTime()}`,
    estimatedReviewTime: estimatedReviewTime.toISOString(),
    distanceFromMission: Math.round(distance),
  };
});

async function isSquadMember(userId: string, squadId: string): Promise<boolean> {
  const squad = await getItem<DynamoDBSquadItem>(TABLE_NAME, {
    PK: `SQUAD#${squadId}`,
    SK: `METADATA#${squadId}`,
  });

  if (!squad) return false;
  return squad.data.members.some((m) => m.userId === userId);
}

function isValidS3Key(key: string): boolean {
  if (!key || key.length < 1 || key.length > 1024) return false;
  if (key.startsWith('/') || key.endsWith('/')) return false;
  if (key.includes('//')) return false;
  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const lowerKey = key.toLowerCase();
  return validExtensions.some((ext) => lowerKey.endsWith(ext));
}

// Main handler
export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  try {
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }
    return successResponse(await submitEvidence(event, context));
  } catch (error) {
    return errorResponse(error as Error);
  }
};
