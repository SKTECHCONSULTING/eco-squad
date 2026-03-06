export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import {
  getItem,
  updateItem,
  deleteItem,
  executeTransaction,
  TransactWriteCommandInput,
} from '@/lib/db/dynamodb';
import { Squad, DynamoDBSquadItem } from '@/types';
import {
  withErrorHandler,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from '@/lib/middleware/error-handler';
import { validateParams } from '@/lib/middleware/validation';
import { requireAuth, isAdmin } from '@/lib/middleware/auth';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { withCsrfProtection } from '@/lib/middleware/csrf';
import { UuidParamSchema, UpdateSquadInput, UpdateSquadSchema } from '@/lib/validation/schemas';

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'EcoSquadTable';

interface RouteParams {
  id: string;
  [key: string]: string;
}

/**
 * GET /api/squads/:id
 * Get a single squad by ID
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

  if (!isLeader && !isAdmin(user)) {
    throw new ForbiddenError('Only squad leaders can update the squad');
  }

  // Parse and validate body
  const body = await request.json();
  const validatedBody = UpdateSquadSchema.parse(body);

  // Build update expression
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {
    '#data': 'data',
  };
  const expressionAttributeValues: Record<string, any> = {};

  if (validatedBody.name !== undefined) {
    updateExpressions.push('#data.name = :name');
    expressionAttributeValues[':name'] = validatedBody.name;
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

  if (!isLeader && !isAdmin(user)) {
    throw new ForbiddenError('Only squad leaders can delete the squad');
  }

  // Check for active missions
  const activeMissions = squad.activeMissions || 0;
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

// Export handlers
export const GET = withErrorHandler(
  withRateLimit(getSquad, 'default')
);

export const PATCH = withErrorHandler(
  withCsrfProtection(
    withRateLimit(
      requireAuth((req, user, ctx) => updateSquad(req, { ...ctx, user })),
      'default'
    )
  )
);

export const DELETE = withErrorHandler(
  withCsrfProtection(
    withRateLimit(
      requireAuth((req, user, ctx) => deleteSquad(req, { ...ctx, user })),
      'default'
    )
  )
);
