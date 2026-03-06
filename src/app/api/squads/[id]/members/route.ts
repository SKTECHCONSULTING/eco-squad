export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import {
  getItem,
  updateItem,
  queryItems,
  executeTransaction,
  TransactWriteCommandInput,
} from '@/lib/db/dynamodb';
import { Squad, DynamoDBSquadItem, SquadMember, User, DynamoDBUserItem } from '@/types';
import {
  withErrorHandler,
  NotFoundError,
  ConflictError,
  ForbiddenError,
  ValidationError,
} from '@/lib/middleware/error-handler';
import { validateParams } from '@/lib/middleware/validation';
import { requireAuth, isAdmin } from '@/lib/middleware/auth';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { UuidParamSchema, AddMemberSchema, AddMemberInput } from '@/lib/validation/schemas';

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'EcoSquadTable';
const MAX_SQUAD_MEMBERS = 20;

interface RouteParams {
  id: string;
  [key: string]: string;
}

/**
 * GET /api/squads/:id/members
 * List all members of a squad
 */
async function listMembers(
  request: NextRequest,
  { params }: { params: RouteParams }
): Promise<NextResponse> {
  const { id } = validateParams(params, UuidParamSchema);

  // Get squad to verify existence
  const item = await getItem<DynamoDBSquadItem>(TABLE_NAME, {
    PK: `SQUAD#${id}`,
    SK: `METADATA#${id}`,
  });

  if (!item) {
    throw new NotFoundError('Squad', id);
  }

  // Get detailed member info
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

  return NextResponse.json({
    members,
    total: members.length,
  });
}

/**
 * POST /api/squads/:id/members
 * Add a member to a squad
 */
async function addMember(
  request: NextRequest,
  { params, user }: { params: RouteParams; user: any }
): Promise<NextResponse> {
  const { id: squadId } = validateParams(params, UuidParamSchema);

  // Parse and validate body
  const body = await request.json();
  const validatedBody = AddMemberSchema.parse(body);
  const { userId: memberId, role = 'MEMBER' } = validatedBody;

  // Get squad
  const item = await getItem<DynamoDBSquadItem>(TABLE_NAME, {
    PK: `SQUAD#${squadId}`,
    SK: `METADATA#${squadId}`,
  });

  if (!item) {
    throw new NotFoundError('Squad', squadId);
  }

  const squad = item.data;

  // Check if user is leader
  const isLeader = squad.members.some(
    (m) => m.userId === user.userId && m.role === 'LEADER'
  );

  if (!isLeader && !isAdmin(user)) {
    throw new ForbiddenError('Only squad leaders can add members');
  }

  // Check member limit
  if (squad.members.length >= MAX_SQUAD_MEMBERS) {
    throw new ConflictError(
      `Squad cannot have more than ${MAX_SQUAD_MEMBERS} members`
    );
  }

  // Check if user is already a member
  if (squad.members.some((m) => m.userId === memberId)) {
    throw new ConflictError('User is already a member of this squad');
  }

  // Verify user exists
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

  // Add member to squad and create membership record
  const transactionItems: TransactWriteCommandInput = {
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
          ConditionExpression: 'attribute_not_exists(PK)',
        },
      },
    ],
  };

  await executeTransaction(transactionItems);

  return NextResponse.json(
    {
      member: {
        ...newMember,
        user: {
          id: userExists.data.id,
          name: userExists.data.name,
          avatar: userExists.data.avatar,
        },
      },
      message: 'Member added successfully',
    },
    { status: 201 }
  );
}

/**
 * DELETE /api/squads/:id/members/:userId
 * Remove a member from a squad
 */
async function removeMember(
  request: NextRequest,
  { params, user }: { params: RouteParams & { userId: string }; user: any }
): Promise<NextResponse> {
  const { id: squadId, userId: memberId } = params;

  // Validate UUIDs
  validateParams({ id: squadId }, UuidParamSchema);
  validateParams({ id: memberId }, UuidParamSchema);

  // Get squad
  const item = await getItem<DynamoDBSquadItem>(TABLE_NAME, {
    PK: `SQUAD#${squadId}`,
    SK: `METADATA#${squadId}`,
  });

  if (!item) {
    throw new NotFoundError('Squad', squadId);
  }

  const squad = item.data;

  // Check permissions
  const isLeader = squad.members.some(
    (m) => m.userId === user.userId && m.role === 'LEADER'
  );
  const isSelf = memberId === user.userId;

  if (!isLeader && !isSelf && !isAdmin(user)) {
    throw new ForbiddenError(
      'Only squad leaders can remove other members. You can remove yourself.'
    );
  }

  // Cannot remove the last leader
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

  // Update squad members and delete membership record
  const updatedMembers = squad.members.filter((m) => m.userId !== memberId);

  const transactionItems: TransactWriteCommandInput = {
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

  return NextResponse.json({
    message: 'Member removed successfully',
  });
}

// Export handlers
export const GET = withErrorHandler(
  withRateLimit(listMembers, 'default')
);

export const POST = withErrorHandler(
  withRateLimit(
    requireAuth((req, user, ctx) => addMember(req, { ...ctx, user })),
    'default'
  )
);

export const DELETE = withErrorHandler(
  withRateLimit(
    requireAuth((req, user, ctx) => removeMember(req, { ...ctx, user })),
    'default'
  )
);
