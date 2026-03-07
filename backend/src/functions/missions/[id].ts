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
  isAdmin,
} from '../../lib/middleware';
import { 
  getItem, 
  updateItem,
  deleteItem,
  executeTransaction,
} from '../../lib/dynamodb';
import { 
  UpdateMissionSchema,
  UuidParamSchema,
} from '../../lib/validation';
import { Mission, DynamoDBMissionItem, DynamoDBSquadItem, CognitoUser } from '../../types';

const TABLE_NAME = process.env.TABLE_NAME || '';

// GET /missions/{id} - Get a single mission
export const getMission = async (event: APIGatewayProxyEvent): Promise<any> => {
  const { id } = UuidParamSchema.parse(getPathParams(event));

  const item = await getItem<DynamoDBMissionItem>(TABLE_NAME, {
    PK: `MISSION#${id}`,
    SK: `METADATA#${id}`,
  });

  if (!item) {
    throw new NotFoundError('Mission', id);
  }

  return { mission: item.data };
};

// PATCH /missions/{id} - Update a mission
export const updateMission = requireAuth(async (event: APIGatewayProxyEvent, user: CognitoUser): Promise<any> => {
  const { id } = UuidParamSchema.parse(getPathParams(event));
  const body = parseBody(event);
  if (!body) throw new ValidationError('Request body is required');
  
  const validatedBody = UpdateMissionSchema.parse(body);

  const item = await getItem<DynamoDBMissionItem>(TABLE_NAME, {
    PK: `MISSION#${id}`,
    SK: `METADATA#${id}`,
  });

  if (!item) {
    throw new NotFoundError('Mission', id);
  }

  const mission = item.data;

  const canUpdate = isAdmin(user) || await isSquadLeader(user.userId, mission.claimedBy);
  if (!canUpdate) {
    throw new ForbiddenError('You do not have permission to update this mission');
  }

  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = { '#data': 'data' };
  const expressionAttributeValues: Record<string, any> = {};

  if (validatedBody.title !== undefined) {
    updateExpressions.push('#data.title = :title');
    expressionAttributeValues[':title'] = validatedBody.title;
  }

  if (validatedBody.description !== undefined) {
    updateExpressions.push('#data.description = :description');
    expressionAttributeValues[':description'] = validatedBody.description;
  }

  if (validatedBody.type !== undefined) {
    updateExpressions.push('#data.type = :type');
    expressionAttributeValues[':type'] = validatedBody.type;
  }

  if (validatedBody.impactPoints !== undefined) {
    updateExpressions.push('#data.impactPoints = :impactPoints, impactPoints = :impactPoints');
    expressionAttributeValues[':impactPoints'] = validatedBody.impactPoints;
  }

  if (validatedBody.status !== undefined) {
    const validTransitions = getValidStatusTransitions(mission.status);
    if (!validTransitions.includes(validatedBody.status)) {
      throw new ConflictError(
        `Cannot transition from ${mission.status} to ${validatedBody.status}`
      );
    }
    updateExpressions.push('#data.status = :status, #status = :status');
    expressionAttributeNames['#status'] = 'status';
    expressionAttributeValues[':status'] = validatedBody.status;
  }

  if (validatedBody.tags !== undefined) {
    updateExpressions.push('#data.tags = :tags');
    expressionAttributeValues[':tags'] = validatedBody.tags;
  }

  if (validatedBody.expiresAt !== undefined) {
    const expiresAt = new Date(validatedBody.expiresAt);
    if (expiresAt <= new Date()) {
      throw new ConflictError('Expiration date must be in the future');
    }
    updateExpressions.push('#data.expiresAt = :expiresAt');
    expressionAttributeValues[':expiresAt'] = validatedBody.expiresAt;
  }

  if (updateExpressions.length === 0) {
    return { mission };
  }

  updateExpressions.push('#data.updatedAt = :updatedAt');
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();

  await updateItem(
    TABLE_NAME,
    { PK: `MISSION#${id}`, SK: `METADATA#${id}` },
    `SET ${updateExpressions.join(', ')}`,
    expressionAttributeNames,
    expressionAttributeValues
  );

  const updatedItem = await getItem<DynamoDBMissionItem>(TABLE_NAME, {
    PK: `MISSION#${id}`,
    SK: `METADATA#${id}`,
  });

  return { mission: updatedItem?.data };
});

// DELETE /missions/{id} - Delete a mission
export const deleteMission = requireAuth(async (event: APIGatewayProxyEvent, user: CognitoUser): Promise<any> => {
  if (!isAdmin(user)) {
    throw new ForbiddenError('Only administrators can delete missions');
  }

  const { id } = UuidParamSchema.parse(getPathParams(event));

  const item = await getItem<DynamoDBMissionItem>(TABLE_NAME, {
    PK: `MISSION#${id}`,
    SK: `METADATA#${id}`,
  });

  if (!item) {
    throw new NotFoundError('Mission', id);
  }

  const mission = item.data;

  if (mission.status === 'COMPLETED') {
    throw new ConflictError('Cannot delete completed missions');
  }

  const transactionItems: any = {
    TransactItems: [
      {
        Delete: {
          TableName: TABLE_NAME,
          Key: {
            PK: `MISSION#${id}`,
            SK: `METADATA#${id}`,
          },
        },
      },
    ],
  };

  if (mission.claimedBy) {
    transactionItems.TransactItems.push({
      Update: {
        TableName: TABLE_NAME,
        Key: {
          PK: `SQUAD#${mission.claimedBy}`,
          SK: `METADATA#${mission.claimedBy}`,
        },
        UpdateExpression: 'SET #data.activeMissions = #data.activeMissions - :dec',
        ExpressionAttributeNames: { '#data': 'data' },
        ExpressionAttributeValues: { ':dec': 1 },
        ConditionExpression: 'attribute_exists(PK)',
      },
    });
  }

  await executeTransaction(transactionItems);

  return { message: 'Mission deleted successfully' };
});

async function isSquadLeader(userId: string, squadId: string | undefined): Promise<boolean> {
  if (!squadId) return false;
  const squad = await getItem<DynamoDBSquadItem>(TABLE_NAME, {
    PK: `SQUAD#${squadId}`,
    SK: `METADATA#${squadId}`,
  });

  if (!squad) return false;
  return squad.data.members.some((m) => m.userId === userId && m.role === 'LEADER');
}

function getValidStatusTransitions(currentStatus: string): string[] {
  const transitions: Record<string, string[]> = {
    AVAILABLE: ['CLAIMED', 'EXPIRED'],
    CLAIMED: ['IN_PROGRESS', 'AVAILABLE', 'EXPIRED'],
    IN_PROGRESS: ['PENDING_VERIFICATION', 'AVAILABLE'],
    PENDING_VERIFICATION: ['COMPLETED', 'REJECTED', 'IN_PROGRESS'],
    COMPLETED: [],
    EXPIRED: ['AVAILABLE'],
    REJECTED: ['IN_PROGRESS'],
  };
  return transitions[currentStatus] || [];
}

// Main handler
export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const httpMethod = event.httpMethod;
  
  try {
    switch (httpMethod) {
      case 'GET':
        return successResponse(await getMission(event));
      case 'PATCH':
        return successResponse(await updateMission(event, context));
      case 'DELETE':
        return successResponse(await deleteMission(event, context));
      default:
        return {
          statusCode: 405,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    return errorResponse(error as Error);
  }
};
