export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { addHours, isBefore } from 'date-fns';
import {
  getItem,
  executeTransaction,
  TransactWriteCommandInput,
} from '@/lib/db/dynamodb';
import { Mission, DynamoDBMissionItem, Squad, DynamoDBSquadItem } from '@/types';
import {
  withErrorHandler,
  NotFoundError,
  ConflictError,
  ForbiddenError,
  ValidationError,
} from '@/lib/middleware/error-handler';
import { withBodyValidation, validateParams } from '@/lib/middleware/validation';
import { requireAuth } from '@/lib/middleware/auth';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { ClaimMissionSchema, UuidParamSchema, ClaimMissionInput } from '@/lib/validation/schemas';

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'EcoSquadTable';
const CLAIM_EXPIRY_HOURS = 24;

interface RouteParams {
  id: string;
  [key: string]: string;
}

/**
 * POST /api/missions/:id/claim
 * User/Squad claims an available mission with transaction safety
 */
async function claimMission(
  request: NextRequest,
  body: ClaimMissionInput,
  { params, user }: { params: RouteParams; user: any }
): Promise<NextResponse> {
  const { id: missionId } = validateParams(params, UuidParamSchema);
  const { squadId } = body;

  // Verify user is a member of the squad
  const isMember = await isSquadMember(user.userId, squadId);
  if (!isMember) {
    throw new ForbiddenError('You must be a member of the squad to claim missions');
  }

  // Get mission and squad in parallel
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
  const squad = squadItem.data;

  // Check if mission is available
  if (mission.status !== 'AVAILABLE') {
    throw new ConflictError(
      `Mission is not available. Current status: ${mission.status}`
    );
  }

  // Check if mission has expired
  if (mission.expiresAt && isBefore(new Date(mission.expiresAt), new Date())) {
    throw new ConflictError('Mission has expired');
  }

  // Check squad's active mission limit (max 3)
  const activeMissions = await getSquadActiveMissions(squadId);
  if (activeMissions >= 3) {
    throw new ConflictError(
      'Squad has reached the maximum number of active missions (3)'
    );
  }

  const now = new Date();
  const expiresAt = addHours(now, CLAIM_EXPIRY_HOURS);

  // Prepare transaction for atomic claim operation
  const transactionInput: TransactWriteCommandInput = {
    TransactItems: [
      {
        // Update mission status
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
        // Update squad's active missions count
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
        // Create claim record for audit trail
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
      // Check which condition failed
      throw new ConflictError(
        'Mission was already claimed by another squad or is no longer available'
      );
    }
    throw error;
  }

  // Return updated mission
  const updatedMission: Mission = {
    ...mission,
    status: 'CLAIMED',
    claimedBy: squadId,
    claimedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  return NextResponse.json({
    status: 'CLAIMED',
    expiresAt: expiresAt.toISOString(),
    mission: updatedMission,
  });
}

/**
 * Check if user is a member of the squad
 */
async function isSquadMember(userId: string, squadId: string): Promise<boolean> {
  const squad = await getItem<DynamoDBSquadItem>(TABLE_NAME, {
    PK: `SQUAD#${squadId}`,
    SK: `METADATA#${squadId}`,
  });

  if (!squad) return false;

  return squad.data.members.some((m) => m.userId === userId);
}

/**
 * Get number of active missions for a squad
 */
async function getSquadActiveMissions(squadId: string): Promise<number> {
  // This could be optimized with a GSI or counter
  // For now, we'll use the stored count in the squad record
  const squad = await getItem<DynamoDBSquadItem>(TABLE_NAME, {
    PK: `SQUAD#${squadId}`,
    SK: `METADATA#${squadId}`,
  });

  return squad?.data?.activeMissions || 0;
}

// Export handler with middleware
export const POST = withErrorHandler(
  withRateLimit(
    requireAuth(async (req, user, ctx) => {
      const body = await req.json();
      const validatedBody = ClaimMissionSchema.parse(body);
      return claimMission(req, validatedBody, { ...ctx, user });
    }),
    'missionClaim',
    (req) => (req as any).user?.userId
  )
);
