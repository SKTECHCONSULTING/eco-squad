export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { encodeGeohash } from '@/lib/services/geo-service';
import { executeWithRetry, queryItems, putItem } from '@/lib/db/dynamodb';
import { Mission, DynamoDBMissionItem } from '@/types';
import { withErrorHandler, ValidationError } from '@/lib/middleware/error-handler';
import { withQueryValidation } from '@/lib/middleware/validation';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { requireMissionCreator, optionalAuth, getAuthUser } from '@/lib/middleware/auth';
import {
  CreateMissionSchema,
  DiscoverMissionsQuerySchema,
  CreateMissionInput,
  DiscoverMissionsQuery,
} from '@/lib/validation/schemas';
import { getGeohashesForRadius, filterByDistance } from '@/lib/services/geo-service';

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'EcoSquadTable';
const DEFAULT_MISSION_EXPIRY_DAYS = 30;

/**
 * GET /api/missions?lat={lat}&lng={lng}&radius={r}
 * Discover nearby missions using Geohash-based GSI query
 */
async function getMissions(
  request: NextRequest,
  query: DiscoverMissionsQuery
): Promise<NextResponse> {
  const { lat, lng, radius } = query;

  // Get geohashes to query for this radius
  const geohashes = getGeohashesForRadius(lat, lng, radius);

  // Query DynamoDB for missions in these geohash areas
  const missions: Mission[] = [];
  const queriedIds = new Set<string>();

  for (const geohash of geohashes) {
    const items = await queryItems<DynamoDBMissionItem>({
      TableName: TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      FilterExpression: '#status = :status AND (attribute_not_exists(expiresAt) OR expiresAt > :now)',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':pk': `GEO#${geohash}`,
        ':status': 'AVAILABLE',
        ':now': new Date().toISOString(),
      },
    });

    for (const item of items) {
      if (!queriedIds.has(item.data.id)) {
        queriedIds.add(item.data.id);
        missions.push(item.data);
      }
    }
  }

  // Filter by actual distance to ensure accuracy
  const nearbyMissions = filterByDistance(missions, { lat, lng }, radius);

  // Sort by distance
  nearbyMissions.sort((a, b) => {
    const distA = Math.pow(a.location.lat - lat, 2) + Math.pow(a.location.lng - lng, 2);
    const distB = Math.pow(b.location.lat - lat, 2) + Math.pow(b.location.lng - lng, 2);
    return distA - distB;
  });

  return NextResponse.json({
    missions: nearbyMissions,
    total: nearbyMissions.length,
  });
}

/**
 * POST /api/missions
 * Create a new mission (admin/org only)
 */
async function createMission(
  request: NextRequest,
  body: CreateMissionInput,
  user: any
): Promise<NextResponse> {
  const missionId = uuidv4();
  const now = new Date();
  const expiresAt = body.expiresAt
    ? new Date(body.expiresAt)
    : new Date(now.getTime() + DEFAULT_MISSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  // Validate expiration is in the future
  if (expiresAt <= now) {
    throw new ValidationError('Expiration date must be in the future');
  }

  const geohash = encodeGeohash(body.location.lat, body.location.lng);

  const mission: Mission = {
    id: missionId,
    title: body.title,
    description: body.description,
    type: body.type,
    status: 'AVAILABLE',
    location: {
      ...body.location,
      geohash,
    },
    impactPoints: body.impactPoints,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    tags: body.tags || [],
  };

  const dynamoItem: DynamoDBMissionItem = {
    PK: `MISSION#${missionId}`,
    SK: `METADATA#${missionId}`,
    GSI1PK: `GEO#${geohash}`,
    GSI1SK: `${now.toISOString()}#${missionId}`,
    data: mission,
    status: 'AVAILABLE',
    impactPoints: body.impactPoints,
    createdAt: now.toISOString(),
    ttl: Math.floor(expiresAt.getTime() / 1000),
  };

  await putItem(TABLE_NAME, dynamoItem);

  return NextResponse.json(
    {
      mission,
      message: 'Mission created successfully',
    },
    { status: 201 }
  );
}

// Export handlers with middleware
export const GET = withErrorHandler(
  withRateLimit(
    withQueryValidation(DiscoverMissionsQuerySchema, getMissions),
    'default'
  )
);

export const POST = withErrorHandler(
  requireMissionCreator(async (request, user) => {
    const body = await request.json();
    const validatedBody = CreateMissionSchema.parse(body);
    return createMission(request, validatedBody, user);
  })
);
