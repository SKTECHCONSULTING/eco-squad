import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { addHours, isBefore } from 'date-fns';
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
  ClaimMissionSchema,
  UuidParamSchema,
} from '../../lib/validation';
import { Mission, DynamoDBMissionItem, Squad, DynamoDBSquadItem, CognitoUser } from '../../types';

const TABLE_NAME = process.env.TABLE_NAME || '';
const CLAIM_EXPIRY_HOURS = 24;

// POST /missions/{id}/claim - Claim a mission
export const claimMission = requireAuth(async (event: APIGatewayProxyEvent, user: CognitoUser): Promise<any> => {
  const { id: missionId } = UuidParamSchema.parse(getPathParams(event));
  const body = parseBody(event);
  if (!body) throw new ValidationError('Request body is required');
  
  const { squadId } = ClaimMissionSchema.parse(body);

  const isMember = await isSquadMember(user.userId, squadId);
  if (!isMember) {
    throw new ForbiddenError('You must be a member of the squad to claim missions');
  }

  const [missionItem, squadItem] = await Promise.all([
    getItem<DynamoDBMissionItem>(TABLE_NAME, {
      PK: `MISSION#${missionId}`,
      SK: `METADATA#${missionId}`,
    }),
    getItem<DynamoDBSquadItem>(TABLE_NAME, {
      PK: `SQUAD#${squadId}`,
      SK: `METADATA#${squadId}`,
    }),
  ]);

  if (!missionItem) {
    throw new NotFoundError('Mission', missionId);
  }

  if (!squadItem) {
    throw new NotFoundError('Squad', squadId);
  }

  const mission = missionItem.data;

  if (mission.status !== 'AVAILABLE') {
    throw new ConflictError(`Mission is not available. Current status: ${mission.status}`);
  }

  if (mission.expiresAt && isBefore(new Date(mission.expiresAt), new Date())) {
    throw new ConflictError('Mission has expired');
  }

  const activeMissions = await getSquadActiveMissions(squadId);
  if (activeMissions >= 3) {
    throw new ConflictError('Squad has reached the maximum number of active missions (3)');
  }

  const now = new Date();
  const expiresAt = addHours(now, CLAIM_EXPIRY_HOURS);

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
            'SET #status = :claimed, #data.#status = :claimed, claimedBy = :squadId, #data.claimedBy = :squadId, claimedAt = :claimedAt, #data.claimedAt = :claimedAt, expiresAt = :expiresAt, #data.expiresAt = :expiresAt',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#data': 'data',
          },
          ExpressionAttributeValues: {
            ':claimed': 'CLAIMED',
            ':squadId': squadId,
            ':claimedAt': now.toISOString(),
            ':expiresAt': expiresAt.toISOString(),
            ':available': 'AVAILABLE',
          },
          ConditionExpression: '#status = :available',
        },
      },
      {
        Update: {
          TableName: TABLE_NAME,
          Key: {
            PK: `SQUAD#${squadId}`,
            SK: `METADATA#${squadId}`,
          },
          UpdateExpression:
            'SET #data.activeMissions = if_not_exists(#data.activeMissions, :zero) + :inc, #data.updatedAt = :now',
          ExpressionAttributeNames: { '#data': 'data' },
          ExpressionAttributeValues: {
            ':inc': 1,
            ':zero': 0,
            ':now': now.toISOString(),
          },
        },
      },
      {
        Put: {
          TableName: TABLE_NAME,
          Item: {
            PK: `MISSION#${missionId}`,
            SK: `CLAIM#${squadId}#${now.toISOString()}`,
            missionId,
            squadId,
            claimedBy: user.userId,
            claimedAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
            GSI1PK: `SQUAD#${squadId}`,
            GSI1SK: `CLAIM#${now.toISOString()}`,
          },
        },
      },
    ],
  };

  try {
    await executeTransaction(transactionInput);
  } catch (error: any) {
    if (error.name === 'TransactionCanceledException') {
      throw new ConflictError('Mission was already claimed by another squad');
    }
    throw error;
  }

  const updatedMission: Mission = {
    ...mission,
    status: 'CLAIMED',
    claimedBy: squadId,
    claimedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  return {
    status: 'CLAIMED',
    expiresAt: expiresAt.toISOString(),
    mission: updatedMission,
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

async function getSquadActiveMissions(squadId: string): Promise<number> {
  const squad = await getItem<DynamoDBSquadItem>(TABLE_NAME, {
    PK: `SQUAD#${squadId}`,
    SK: `METADATA#${squadId}`,
  });
  return squad?.data?.activeMissions || 0;
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
    return successResponse(await claimMission(event, context));
  } catch (error) {
    return errorResponse(error as Error);
  }
};
