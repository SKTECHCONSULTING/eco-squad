import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { 
  optionalAuth,
  requireAuth, 
  parseBody, 
  getQueryParams,
  successResponse, 
  errorResponse,
  ValidationError,
  ConflictError,
} from '../../lib/middleware';
import { 
  queryItems, 
  getItem, 
  putItem,
  executeTransaction,
} from '../../lib/dynamodb';
import { 
  CreateSquadSchema,
  UuidParamSchema,
} from '../../lib/validation';
import { Squad, DynamoDBSquadItem, User, DynamoDBUserItem, SquadMember, CognitoUser } from '../../types';

const TABLE_NAME = process.env.TABLE_NAME || '';
const MAX_SQUADS_PER_USER = 5;
const MAX_SQUAD_MEMBERS = 20;

// GET /squads - List squads
export const listSquads = optionalAuth(async (event: APIGatewayProxyEvent): Promise<any> => {
  const params = getQueryParams(event);
  const userId = params.userId;
  const limit = Math.min(parseInt(params.limit || '20'), 100);

  let squads: Squad[] = [];

  if (userId) {
    const items = await queryItems<DynamoDBSquadItem>({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
      },
      Limit: limit,
    });
    squads = items.map((item) => item.data);
  } else {
    const items = await queryItems<DynamoDBSquadItem>({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'begins_with(PK, :prefix)',
      ExpressionAttributeValues: {
        ':prefix': 'SQUAD#',
      },
      Limit: limit,
    });
    squads = items.map((item) => item.data);
  }

  return {
    squads,
    total: squads.length,
  };
});

// POST /squads - Create a new squad
export const createSquad = requireAuth(async (event: APIGatewayProxyEvent, user: CognitoUser): Promise<any> => {
  const userSquads = await getUserSquadCount(user.userId);
  if (userSquads >= MAX_SQUADS_PER_USER) {
    throw new ConflictError(`You have reached the maximum number of squads (${MAX_SQUADS_PER_USER})`);
  }

  const body = parseBody(event);
  if (!body) throw new ValidationError('Request body is required');
  
  const validatedBody = CreateSquadSchema.parse(body);

  const squadId = uuidv4();
  const now = new Date();

  const members: SquadMember[] = [
    {
      userId: user.userId,
      role: 'LEADER',
      joinedAt: now.toISOString(),
    },
  ];

  if (validatedBody.memberIds) {
    const uniqueMemberIds = Array.from(new Set(validatedBody.memberIds)).filter(
      (id) => id !== user.userId
    );

    if (uniqueMemberIds.length + members.length > MAX_SQUAD_MEMBERS) {
      throw new ValidationError(`Squad cannot have more than ${MAX_SQUAD_MEMBERS} members`);
    }

    for (const memberId of uniqueMemberIds) {
      const memberExists = await getItem<DynamoDBUserItem>(TABLE_NAME, {
        PK: `USER#${memberId}`,
        SK: `METADATA#${memberId}`,
      });

      if (!memberExists) {
        throw new ValidationError(`User not found: ${memberId}`);
      }

      members.push({
        userId: memberId,
        role: 'MEMBER',
        joinedAt: now.toISOString(),
      });
    }
  }

  const squad: Squad = {
    id: squadId,
    name: validatedBody.name,
    members,
    totalImpactPoints: 0,
    completedMissions: 0,
    createdAt: now.toISOString(),
  };

  const dynamoItem: DynamoDBSquadItem = {
    PK: `SQUAD#${squadId}`,
    SK: `METADATA#${squadId}`,
    data: squad,
    totalImpactPoints: 0,
    createdAt: now.toISOString(),
  };

  const transactionItems: any = {
    TransactItems: [
      {
        Put: {
          TableName: TABLE_NAME,
          Item: dynamoItem,
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      },
    ],
  };

  for (const member of members) {
    transactionItems.TransactItems.push({
      Put: {
        TableName: TABLE_NAME,
        Item: {
          PK: `SQUAD#${squadId}`,
          SK: `MEMBER#${member.userId}`,
          userId: member.userId,
          role: member.role,
          joinedAt: member.joinedAt,
          GSI1PK: `USER#${member.userId}`,
          GSI1SK: `SQUAD#${now.toISOString()}`,
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      },
    });
  }

  await executeTransaction(transactionItems);

  return {
    squad,
    message: 'Squad created successfully',
  };
});

async function getUserSquadCount(userId: string): Promise<number> {
  const items = await queryItems<any>({
    TableName: TABLE_NAME,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':prefix': 'SQUAD#',
    },
  });
  return items.length;
}

// Main handler
export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  try {
    switch (event.httpMethod) {
      case 'GET':
        return successResponse(await listSquads(event, context));
      case 'POST':
        return successResponse(await createSquad(event, context));
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
