export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getItem, updateItem, executeTransaction, TransactWriteCommandInput } from '@/lib/db/dynamodb';
import { Mission, DynamoDBMissionItem, Squad, DynamoDBSquadItem } from '@/types';
import { withErrorHandler, NotFoundError, ConflictError, ForbiddenError } from '@/lib/middleware/error-handler';
import { withBodyValidation, validateParams } from '@/lib/middleware/validation';
import { requireAuth, optionalAuth, isAdmin } from '@/lib/middleware/auth';
import { UpdateMissionSchema, UuidParamSchema, UpdateMissionInput } from '@/lib/validation/schemas';
import { withRateLimit } from '@/lib/middleware/rate-limit';

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'EcoSquadTable';

interface RouteParams {
  id: string;
  [key: string]: string;
}

/**
 * GET /api/missions/:id
 * Get a single mission by ID
 */
async function getMission(
  request: NextRequest,
  { params }: { params: RouteParams }
): Promise<NextResponse> {
  const { id } = validateParams(params, UuidParamSchema);

  const item = await getItem<DynamoDBMissionItem>(TABLE_NAME, {
    PK: `MISSION#${id}`,
    SK: `METADATA#${id}`,
  });

  if (!item) {
    throw new NotFoundError('Mission', id);
  }

  return NextResponse.json({ mission: item.data });
}

/**
 * PATCH /api/missions/:id
 * Update a mission (admin, org, or claimed squad leader only)
 */
async function updateMission(
  request: NextRequest,
  body: UpdateMissionInput,
  { params, user }: { params: RouteParams; user: any }
): Promise<NextResponse> {
  const { id } = validateParams(params, UuidParamSchema);

  // Get existing mission
  const item = await getItem<DynamoDBMissionItem>(TABLE_NAME, {
    PK: `MISSION#${id}`,
    SK: `METADATA#${id}`,
  });

  if (!item) {
    throw new NotFoundError('Mission', id);
  }

  const mission = item.data;

  // Check permissions
  const canUpdate =
    isAdmin(user) ||
    (mission.claimedBy && await isSquadLeader(user.userId, mission.claimedBy));

  if (!canUpdate) {
    throw new ForbiddenError('You do not have permission to update this mission');
  }

  // Build update expression
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {
    '#data': 'data',
  };
  const expressionAttributeValues: Record<string, any> = {};

  if (body.title !== undefined) {
    updateExpressions.push('#data.title = :title');
    expressionAttributeValues[':title'] = body.title;
  }

  if (body.description !== undefined) {
    updateExpressions.push('#data.description = :description');
    expressionAttributeValues[':description'] = body.description;
  }

  if (body.type !== undefined) {
    updateExpressions.push('#data.type = :type');
    expressionAttributeValues[':type'] = body.type;
  }

  if (body.impactPoints !== undefined) {
    updateExpressions.push('#data.impactPoints = :impactPoints, impactPoints = :impactPoints');
    expressionAttributeValues[':impactPoints'] = body.impactPoints;
  }

  if (body.status !== undefined) {
    // Validate status transitions
    const validTransitions = getValidStatusTransitions(mission.status);
    if (!validTransitions.includes(body.status)) {
      throw new ConflictError(
        `Cannot transition from ${mission.status} to ${body.status}. Valid transitions: ${validTransitions.join(', ')}`
      );
    }
    updateExpressions.push('#data.status = :status, #status = :status');
    expressionAttributeNames['#status'] = 'status';
    expressionAttributeValues[':status'] = body.status;
  }

  if (body.tags !== undefined) {
    updateExpressions.push('#data.tags = :tags');
    expressionAttributeValues[':tags'] = body.tags;
  }

  if (body.expiresAt !== undefined) {
    const expiresAt = new Date(body.expiresAt);
    if (expiresAt <= new Date()) {
      throw new ConflictError('Expiration date must be in the future');
    }
    updateExpressions.push('#data.expiresAt = :expiresAt');
    expressionAttributeValues[':expiresAt'] = body.expiresAt;
  }

  if (body.location !== undefined) {
    updateExpressions.push('#data.location = :location');
    expressionAttributeValues[':location'] = body.location;
  }

  if (updateExpressions.length === 0) {
    return NextResponse.json({ mission });
  }

  // Add updatedAt timestamp
  updateExpressions.push('#data.updatedAt = :updatedAt');
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();

  await updateItem(
    TABLE_NAME,
    { PK: `MISSION#${id}`, SK: `METADATA#${id}` },
    `SET ${updateExpressions.join(', ')}`,
    expressionAttributeNames,
    expressionAttributeValues
  );

  // Fetch updated mission
  const updatedItem = await getItem<DynamoDBMissionItem>(TABLE_NAME, {
    PK: `MISSION#${id}`,
    SK: `METADATA#${id}`,
  });

  return NextResponse.json({ mission: updatedItem?.data });
}

/**
 * DELETE /api/missions/:id
 * Delete a mission (admin only)
 */
async function deleteMission(
  request: NextRequest,
  { params, user }: { params: RouteParams; user: any }
): Promise<NextResponse> {
  const { id } = validateParams(params, UuidParamSchema);

  // Only admins can delete
  if (!isAdmin(user)) {
    throw new ForbiddenError('Only administrators can delete missions');
  }

  const item = await getItem<DynamoDBMissionItem>(TABLE_NAME, {
    PK: `MISSION#${id}`,
    SK: `METADATA#${id}`,
  });

  if (!item) {
    throw new NotFoundError('Mission', id);
  }

  const mission = item.data;

  // Cannot delete completed missions with points awarded
  if (mission.status === 'COMPLETED') {
    throw new ConflictError('Cannot delete completed missions');
  }

  // Use transaction to delete mission and update related records
  const transactionItems: TransactWriteCommandInput = {
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

  // If mission was claimed, update squad's active mission count
  if (mission.claimedBy) {
    transactionItems.TransactItems!.push({
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

  return NextResponse.json(
    { message: 'Mission deleted successfully' },
    { status: 200 }
  );
}

/**
 * Check if user is squad leader
 */
async function isSquadLeader(userId: string, squadId: string): Promise<boolean> {
  const squad = await getItem<DynamoDBSquadItem>(TABLE_NAME, {
    PK: `SQUAD#${squadId}`,
    SK: `METADATA#${squadId}`,
  });

  if (!squad) return false;

  return squad.data.members.some(
    (m) => m.userId === userId && m.role === 'LEADER'
  );
}

/**
 * Get valid status transitions
 */
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

// Export handlers
export const GET = withErrorHandler(
  withRateLimit(getMission, 'default')
);

export const PATCH = withErrorHandler(
  requireAuth((req, user, ctx) => updateMission(req, {}, { ...ctx, user }))
);

export const DELETE = withErrorHandler(
  requireAuth((req, user, ctx) => deleteMission(req, { ...ctx, user }))
);
