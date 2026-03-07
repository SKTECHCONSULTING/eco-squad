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
  NotFoundError,
  ConflictError,
  ForbiddenError,
  isAdmin,
} from '../../lib/middleware';
import { 
  queryItems, 
  getItem, 
  putItem, 
  updateItem,
  deleteItem,
  executeTransaction,
} from '../../lib/dynamodb';
import { 
  DiscoverMissionsQuerySchema, 
  CreateMissionSchema,
  UpdateMissionSchema,
  UuidParamSchema,
} from '../../lib/validation';
import { encodeGeohash, getGeohashesForRadius, filterByDistance } from '../../lib/geo-service';
import { Mission, DynamoDBMissionItem, CognitoUser } from '../../types';

const TABLE_NAME = process.env.TABLE_NAME || '';
const DEFAULT_MISSION_EXPIRY_DAYS = 30;

// GET /missions - Discover nearby missions
export const listMissions = optionalAuth(async (event: APIGatewayProxyEvent): Promise<any> => {
  const params = getQueryParams(event);
  const query = DiscoverMissionsQuerySchema.parse(params);
  const { lat, lng, radius } = query;

  const geohashes = getGeohashesForRadius(lat, lng, radius);
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

  const nearbyMissions = filterByDistance(missions, { lat, lng }, radius);
  nearbyMissions.sort((a, b) => {
    const distA = Math.pow(a.location.lat - lat, 2) + Math.pow(a.location.lng - lng, 2);
    const distB = Math.pow(b.location.lat - lat, 2) + Math.pow(b.location.lng - lng, 2);
    return distA - distB;
  });

  return {
    missions: nearbyMissions,
    total: nearbyMissions.length,
  };
});

// POST /missions - Create a new mission (admin/org only)
export const createMission = requireAuth(async (event: APIGatewayProxyEvent, user: CognitoUser): Promise<any> => {
  if (!isAdmin(user)) {
    throw new ForbiddenError('Only administrators can create missions');
  }

  const body = parseBody(event);
  if (!body) throw new ValidationError('Request body is required');
  
  const validatedBody = CreateMissionSchema.parse(body);
  
  const missionId = uuidv4();
  const now = new Date();
  const expiresAt = validatedBody.expiresAt
    ? new Date(validatedBody.expiresAt)
    : new Date(now.getTime() + DEFAULT_MISSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  if (expiresAt <= now) {
    throw new ValidationError('Expiration date must be in the future');
  }

  const geohash = encodeGeohash(validatedBody.location.lat, validatedBody.location.lng);

  const mission: Mission = {
    id: missionId,
    title: validatedBody.title,
    description: validatedBody.description,
    type: validatedBody.type,
    status: 'AVAILABLE',
    location: {
      ...validatedBody.location,
      geohash,
    },
    impactPoints: validatedBody.impactPoints,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    tags: validatedBody.tags || [],
  };

  const dynamoItem: DynamoDBMissionItem = {
    PK: `MISSION#${missionId}`,
    SK: `METADATA#${missionId}`,
    GSI1PK: `GEO#${geohash}`,
    GSI1SK: `${now.toISOString()}#${missionId}`,
    data: mission,
    status: 'AVAILABLE',
    impactPoints: validatedBody.impactPoints,
    createdAt: now.toISOString(),
    ttl: Math.floor(expiresAt.getTime() / 1000),
  };

  await putItem(TABLE_NAME, dynamoItem);

  return {
    mission,
    message: 'Mission created successfully',
  };
});

// Main handler - routes to appropriate function based on HTTP method
export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const httpMethod = event.httpMethod;
  
  try {
    switch (httpMethod) {
      case 'GET':
        return await listMissions(event, context);
      case 'POST':
        return await createMission(event, context);
      default:
        return {
          statusCode: 405,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    return errorResponse(error as Error);
  }
};
