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
  UpdateSquadSchema,
  UuidParamSchema,
} from '../../lib/validation';
import { Squad, DynamoDBSquadItem, CognitoUser } from '../../types';

const TABLE_NAME = process.env.TABLE_NAME || '';

// GET /squads/{id} - Get a single squad
export const getSquad = async (event: APIGatewayProxyEvent): Promise<any> => {
  const { id } = UuidParamSchema.parse(getPathParams(event));

  const item = await getItem<DynamoDBSquadItem>(TABLE_NAME, {
    PK: `SQUAD#${id}`,
    SK: `METADATA#${id}`,
  });

  if (!item) {
    throw new NotFoundError('Squad', id);
  }

  return { squad: item.data };
};

// PATCH /squads/{id} - Update a squad
export const updateSquad = requireAuth(async (event: APIGatewayProxyEvent, user: CognitoUser): Promise<any> => {
  const { id } = UuidParamSchema.parse(getPathParams(event));
  const body = parseBody(event);
  if (!body) throw new ValidationError('Request body is required');
  
  const validatedBody = UpdateSquadSchema.parse(body);

  const item = await getItem<DynamoDBSquadItem>(TABLE_NAME, {
    PK: `SQUAD#${id}`,
    SK: `METADATA#${id}`,
  });

  if (!item) {
    throw new NotFoundError('Squad', id);
  }

  const squad = item.data;

  const isLeader = squad.members.some(
    (m) => m.userId === user.userId && m.role === 'LEADER'
  );

  if (!isLeader && !isAdmin(user)) {
    throw new ForbiddenError('Only squad leaders can update the squad');
  }

  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = { '#data': 'data' };
  const expressionAttributeValues: Record<string, any> = {};

  if (validatedBody.name !== undefined) {
    updateExpressions.push('#data.name = :name');
    expressionAttributeValues[':name'] = validatedBody.name;
  }

  if (updateExpressions.length === 0) {
    return { squad };
  }

  updateExpressions.push('#data.updatedAt = :updatedAt');
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();

  await updateItem(
    TABLE_NAME,
    { PK: `SQUAD#${id}`, SK: `METADATA#${id}` },
    `SET ${updateExpressions.join(', ')}`,
    expressionAttributeNames,
    expressionAttributeValues
  );

  const updatedItem = await getItem<DynamoDBSquadItem>(TABLE_NAME, {
    PK: `SQUAD#${id}`,
    SK: `METADATA#${id}`,
  });

  return { squad: updatedItem?.data };
});

// DELETE /squads/{id} - Delete a squad
export const deleteSquad = requireAuth(async (event: APIGatewayProxyEvent, user: CognitoUser): Promise<any> => {
  const { id } = UuidParamSchema.parse(getPathParams(event));

  const item = await getItem<DynamoDBSquadItem>(TABLE_NAME, {
    PK: `SQUAD#${id}`,
    SK: `METADATA#${id}`,
  });

  if (!item) {
    throw new NotFoundError('Squad', id);
  }

  const squad = item.data;

  const isLeader = squad.members.some(
    (m) => m.userId === user.userId && m.role === 'LEADER'
  );

  if (!isLeader && !isAdmin(user)) {
    throw new ForbiddenError('Only squad leaders can delete the squad');
  }

  const activeMissions = squad.activeMissions || 0;
  if (activeMissions > 0) {
    throw new ConflictError('Cannot delete squad with active missions');
  }

  const transactionItems: any = {
    TransactItems: [
      {
        Delete: {
          TableName: TABLE_NAME,
          Key: {
            PK: `SQUAD#${id}`,
            SK: `METADATA#${id}`,
          },
        },
      },
    ],
  };

  for (const member of squad.members) {
    transactionItems.TransactItems.push({
      Delete: {
        TableName: TABLE_NAME,
        Key: {
          PK: `SQUAD#${id}`,
          SK: `MEMBER#${member.userId}`,
        },
      },
    });
  }

  await executeTransaction(transactionItems);

  return { message: 'Squad deleted successfully' };
});

// Main handler
export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  try {
    switch (event.httpMethod) {
      case 'GET':
        return successResponse(await getSquad(event));
      case 'PATCH':
        return successResponse(await updateSquad(event, context));
      case 'DELETE':
        return successResponse(await deleteSquad(event, context));
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
