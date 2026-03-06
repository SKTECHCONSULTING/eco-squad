export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import {
  getItem,
  putItem,
  queryItems,
  updateItem,
  deleteItem,
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
import { withBodyValidation, validateParams } from '@/lib/middleware/validation';
import { requireAuth, optionalAuth } from '@/lib/middleware/auth';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { withCsrfProtection } from '@/lib/middleware/csrf';
import {
  CreateSquadSchema,
  UpdateSquadSchema,
  AddMemberSchema,
  UuidParamSchema,
  CreateSquadInput,
  UpdateSquadInput,
  AddMemberInput,
} from '@/lib/validation/schemas';

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'EcoSquadTable';
const MAX_SQUAD_MEMBERS = 20;
const MAX_SQUADS_PER_USER = 5;

interface RouteParams {
  id: string;
  [key: string]: string;
}

/**
 * GET /api/squads
 * List squads (with optional filtering)
 */
async function listSquads(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('userId');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = searchParams.get('offset');

  let squads: Squad[] = [];

  if (userId) {
    // Query squads by user membership using GSI
    const items = await queryItems<DynamoDBSquadItem>({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
      },
      Limit: Math.min(limit, 100),
      ...(offset && { ExclusiveStartKey: JSON.parse(offset) }),
    });

    squads = items.map((item) => item.data);
  } else {
    // Scan for all squads (paginated) - in production, consider using a GSI
    // This is simplified for demonstration
    const items = await queryItems<DynamoDBSquadItem>({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'begins_with(PK, :prefix)',
      ExpressionAttributeValues: {
        ':prefix': 'SQUAD#',
      },
      Limit: Math.min(limit, 100),
      ...(offset && { ExclusiveStartKey: JSON.parse(offset) }),
    });

    squads = items.map((item) => item.data);
  }

  return NextResponse.json({
    squads,
    total: squads.length,
  });
}

/**
 * POST /api/squads
 * Create a new squad
 */
async function createSquad(
  request: NextRequest,
  body: CreateSquadInput,
  { user }: { user: any }
): Promise<NextResponse> {
  // Check user's squad limit
  const userSquads = await getUserSquadCount(user.userId);
  if (userSquads >= MAX_SQUADS_PER_USER) {
    throw new ConflictError(
      `You have reached the maximum number of squads (${MAX_SQUADS_PER_USER})`
    );
  }

  const squadId = uuidv4();
  const now = new Date();

  // Build members list
  const members: SquadMember[] = [
    {
      userId: user.userId,
      role: 'LEADER',
      joinedAt: now.toISOString(),
    },
  ];

  // Validate and add other members
  if (body.memberIds) {
    const uniqueMemberIds = Array.from(new Set(body.memberIds)).filter(
      (id) => id !== user.userId
    );

    if (uniqueMemberIds.length + members.length > MAX_SQUAD_MEMBERS) {
      throw new ValidationError(
        `Squad cannot have more than ${MAX_SQUAD_MEMBERS} members`
      );
    }

    // Validate all members exist
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
    name: body.name,
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

  // Use transaction to create squad and update user records
  const transactionItems: TransactWriteCommandInput = {
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

  // Add user membership records
  for (const member of members) {
    transactionItems.TransactItems!.push({
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

  return NextResponse.json(
    {
      squad,
      message: 'Squad created successfully',
    },
    { status: 201 }
  );
}

/**
 * GET /api/squads/:id
 * Get a single squad
 */
async function getSquad(
  request: NextRequest,
  { params }: { params: RouteParams }
): Promise<NextResponse> {
  const { id } = validateParams(params, UuidParamSchema);

  const item = await getItem<DynamoDBSquadItem>(TABLE_NAME, {
    PK: `SQUAD#${id}`,
    SK: `METADATA#${id}`,
  });

  if (!item) {
    throw new NotFoundError('Squad', id);
  }

  return NextResponse.json({ squad: item.data });
}

/**
 * PATCH /api/squads/:id
 * Update a squad (leader only)
 */
async function updateSquad(
  request: NextRequest,
  body: UpdateSquadInput,
  { params, user }: { params: RouteParams; user: any }
): Promise<NextResponse> {
  const { id } = validateParams(params, UuidParamSchema);

  // Get existing squad
  const item = await getItem<DynamoDBSquadItem>(TABLE_NAME, {
    PK: `SQUAD#${id}`,
    SK: `METADATA#${id}`,
  });

  if (!item) {
    throw new NotFoundError('Squad', id);
  }

  const squad = item.data;

  // Check if user is leader
  const isLeader = squad.members.some(
    (m) => m.userId === user.userId && m.role === 'LEADER'
  );

  if (!isLeader) {
    throw new ForbiddenError('Only squad leaders can update the squad');
  }

  // Build update expression
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {
    '#data': 'data',
  };
  const expressionAttributeValues: Record<string, any> = {};

  if (body.name !== undefined) {
    updateExpressions.push('#data.name = :name');
    expressionAttributeValues[':name'] = body.name;
  }

  if (updateExpressions.length === 0) {
    return NextResponse.json({ squad });
  }

  // Add updatedAt
  updateExpressions.push('#data.updatedAt = :updatedAt');
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();

  await updateItem(
    TABLE_NAME,
    { PK: `SQUAD#${id}`, SK: `METADATA#${id}` },
    `SET ${updateExpressions.join(', ')}`,
    expressionAttributeNames,
    expressionAttributeValues
  );

  // Fetch updated squad
  const updatedItem = await getItem<DynamoDBSquadItem>(TABLE_NAME, {
    PK: `SQUAD#${id}`,
    SK: `METADATA#${id}`,
  });

  return NextResponse.json({ squad: updatedItem?.data });
}

/**
 * DELETE /api/squads/:id
 * Delete a squad (leader only, no active missions)
 */
async function deleteSquad(
  request: NextRequest,
  { params, user }: { params: RouteParams; user: any }
): Promise<NextResponse> {
  const { id } = validateParams(params, UuidParamSchema);

  const item = await getItem<DynamoDBSquadItem>(TABLE_NAME, {
    PK: `SQUAD#${id}`,
    SK: `METADATA#${id}`,
  });

  if (!item) {
    throw new NotFoundError('Squad', id);
  }

  const squad = item.data;

  // Check if user is leader
  const isLeader = squad.members.some(
    (m) => m.userId === user.userId && m.role === 'LEADER'
  );

  if (!isLeader) {
    throw new ForbiddenError('Only squad leaders can delete the squad');
  }

  // Check for active missions
  const activeMissions = await getSquadActiveMissions(id);
  if (activeMissions > 0) {
    throw new ConflictError(
      'Cannot delete squad with active missions. Complete or cancel missions first.'
    );
  }

  // Delete squad and all member records
  const transactionItems: TransactWriteCommandInput = {
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

  // Delete all member records
  for (const member of squad.members) {
    transactionItems.TransactItems!.push({
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

  return NextResponse.json({
    message: 'Squad deleted successfully',
  });
}

/**
 * POST /api/squads/:id/members
 * Add a member to a squad
 */
async function addMember(
  request: NextRequest,
  body: AddMemberInput,
  { params, user }: { params: RouteParams; user: any }
): Promise<NextResponse> {
  const { id: squadId } = validateParams(params, UuidParamSchema);
  const { userId: memberId, role } = body;

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

  if (!isLeader) {
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
    role: role || 'MEMBER',
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
        },
      },
    ],
  };

  await executeTransaction(transactionItems);

  return NextResponse.json(
    {
      member: newMember,
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

  if (!isLeader && !isSelf) {
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

/**
 * Helper: Get user's squad count
 */
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

/**
 * Helper: Get squad's active missions
 */
async function getSquadActiveMissions(squadId: string): Promise<number> {
  const squad = await getItem<DynamoDBSquadItem>(TABLE_NAME, {
    PK: `SQUAD#${squadId}`,
    SK: `METADATA#${squadId}`,
  });

  return squad?.data?.activeMissions || 0;
}

// Export handlers for /api/squads
export const GET = withErrorHandler(
  withRateLimit(optionalAuth(listSquads), 'default')
);

export const POST = withErrorHandler(
  withCsrfProtection(
    withRateLimit(
      requireAuth(async (req, user) => {
        const body = await req.json();
        const validatedBody = CreateSquadSchema.parse(body);
        return createSquad(req, validatedBody, { user });
      }),
      'squadCreate',
      (req) => (req as any).user?.userId
    )
  )
);
