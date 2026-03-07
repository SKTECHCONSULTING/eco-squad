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
  AddMemberSchema,
  UuidParamSchema,
} from '../../lib/validation';
import { Squad, DynamoDBSquadItem, User, DynamoDBUserItem, SquadMember, CognitoUser } from '../../types';

const TABLE_NAME = process.env.TABLE_NAME || '';
const MAX_SQUAD_MEMBERS = 20;

// GET /squads/{id}/members - List all members
export const listMembers = async (event: APIGatewayProxyEvent): Promise<any> => {
  const { id } = UuidParamSchema.parse(getPathParams(event));

  const item = await getItem<DynamoDBSquadItem>(TABLE_NAME, {
    PK: `SQUAD#${id}`,
    SK: `METADATA#${id}`,
  });

  if (!item) {
    throw new NotFoundError('Squad', id);
  }

  const members = await Promise.all(
    item.data.members.map(async (member) => {
      const user = await getItem<DynamoDBUserItem>(TABLE_NAME, {
        PK: `USER#${member.userId}`,
        SK: `METADATA#${member.userId}`,
      });

      return {
        ...member,
        user: user
          ? {
              id: user.data.id,
              name: user.data.name,
              avatar: user.data.avatar,
            }
          : null,
      };
    })
  );

  return {
    members,
    total: members.length,
  };
};

// POST /squads/{id}/members - Add a member
export const addMember = requireAuth(async (event: APIGatewayProxyEvent, user: CognitoUser): Promise<any> => {
  const { id: squadId } = UuidParamSchema.parse(getPathParams(event));
  const body = parseBody(event);
  if (!body) throw new ValidationError('Request body is required');
  
  const validatedBody = AddMemberSchema.parse(body);
  const { userId: memberId, role = 'MEMBER' } = validatedBody;

  const item = await getItem<DynamoDBSquadItem>(TABLE_NAME, {
    PK: `SQUAD#${squadId}`,
    SK: `METADATA#${squadId}`,
  });

  if (!item) {
    throw new NotFoundError('Squad', squadId);
  }

  const squad = item.data;

  const isLeader = squad.members.some(
    (m) => m.userId === user.userId && m.role === 'LEADER'
  );

  if (!isLeader && !isAdmin(user)) {
    throw new ForbiddenError('Only squad leaders can add members');
  }

  if (squad.members.length >= MAX_SQUAD_MEMBERS) {
    throw new ConflictError(`Squad cannot have more than ${MAX_SQUAD_MEMBERS} members`);
  }

  if (squad.members.some((m) => m.userId === memberId)) {
    throw new ConflictError('User is already a member of this squad');
  }

  const userExists = await getItem<DynamoDBUserItem>(TABLE_NAME, {
    PK: `USER#${memberId}`,
    SK: `METADATA#${memberId}`,
  });

  if (!userExists) {
    throw new NotFoundError('User', memberId);
  }

  const now = new Date();
  const newMember: SquadMember = {
    userId: memberId,
    role,
    joinedAt: now.toISOString(),
  };

  const transactionItems: any = {
    TransactItems: [
      {
        Update: {
          TableName: TABLE_NAME,
          Key: {
            PK: `SQUAD#${squadId}`,
            SK: `METADATA#${squadId}`,
          },
          UpdateExpression:
            'SET #data.members = list_append(#data.members, :member)',
          ExpressionAttributeNames: { '#data': 'data' },
          ExpressionAttributeValues: {
            ':member': [newMember],
          },
        },
      },
      {
        Put: {
          TableName: TABLE_NAME,
          Item: {
            PK: `SQUAD#${squadId}`,
            SK: `MEMBER#${memberId}`,
            userId: memberId,
            role: newMember.role,
            joinedAt: newMember.joinedAt,
            GSI1PK: `USER#${memberId}`,
            GSI1SK: `SQUAD#${now.toISOString()}`,
          },
        },
      },
    ],
  };

  await executeTransaction(transactionItems);

  return {
    member: {
      ...newMember,
      user: {
        id: userExists.data.id,
        name: userExists.data.name,
        avatar: userExists.data.avatar,
      },
    },
    message: 'Member added successfully',
  };
});

// DELETE /squads/{id}/members/{userId} - Remove a member
export const removeMember = requireAuth(async (event: APIGatewayProxyEvent, user: CognitoUser): Promise<any> => {
  const params = getPathParams(event);
  const squadId = params.id;
  const memberId = params.userId;

  if (!squadId || !memberId) {
    throw new ValidationError('Squad ID and User ID are required');
  }

  UuidParamSchema.parse({ id: squadId });
  UuidParamSchema.parse({ id: memberId });

  const item = await getItem<DynamoDBSquadItem>(TABLE_NAME, {
    PK: `SQUAD#${squadId}`,
    SK: `METADATA#${squadId}`,
  });

  if (!item) {
    throw new NotFoundError('Squad', squadId);
  }

  const squad = item.data;

  const isLeader = squad.members.some(
    (m) => m.userId === user.userId && m.role === 'LEADER'
  );
  const isSelf = memberId === user.userId;

  if (!isLeader && !isSelf && !isAdmin(user)) {
    throw new ForbiddenError('Only squad leaders can remove other members');
  }

  const memberToRemove = squad.members.find((m) => m.userId === memberId);
  if (!memberToRemove) {
    throw new NotFoundError('Member', memberId);
  }

  if (memberToRemove.role === 'LEADER') {
    const leaderCount = squad.members.filter((m) => m.role === 'LEADER').length;
    if (leaderCount === 1) {
      throw new ConflictError('Cannot remove the only leader. Transfer leadership first.');
    }
  }

  const updatedMembers = squad.members.filter((m) => m.userId !== memberId);

  const transactionItems: any = {
    TransactItems: [
      {
        Update: {
          TableName: TABLE_NAME,
          Key: {
            PK: `SQUAD#${squadId}`,
            SK: `METADATA#${squadId}`,
          },
          UpdateExpression: 'SET #data.members = :members',
          ExpressionAttributeNames: { '#data': 'data' },
          ExpressionAttributeValues: {
            ':members': updatedMembers,
          },
        },
      },
      {
        Delete: {
          TableName: TABLE_NAME,
          Key: {
            PK: `SQUAD#${squadId}`,
            SK: `MEMBER#${memberId}`,
          },
        },
      },
    ],
  };

  await executeTransaction(transactionItems);

  return { message: 'Member removed successfully' };
});

// Main handler
export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  try {
    switch (event.httpMethod) {
      case 'GET':
        return successResponse(await listMembers(event));
      case 'POST':
        return successResponse(await addMember(event, context));
      case 'DELETE':
        return successResponse(await removeMember(event, context));
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
