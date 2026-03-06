// Route Segment Config
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/missions?lat={lat}&lng={lng}&radius={r}
// Discover nearby missions using Geohash-based GSI query

import { NextRequest, NextResponse } from 'next/server';
import { QueryCommand } from '@/lib/db/dynamodb';
import { docClient } from '@/lib/db/dynamodb';
import { getGeohashesForRadius, filterByDistance } from '@/lib/services/geo-service';
import { Mission, DynamoDBMissionItem } from '@/types';

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'EcoSquadTable';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');
    const radius = parseInt(searchParams.get('radius') || '5000'); // Default 5km

    if (!lat || !lng) {
      return NextResponse.json(
        { error: 'Missing required parameters: lat and lng' },
        { status: 400 }
      );
    }

    // Get geohashes to query for this radius
    const geohashes = getGeohashesForRadius(lat, lng, radius);

    // Query DynamoDB for missions in these geohash areas
    const missions: Mission[] = [];
    const queriedIds = new Set<string>();

    for (const geohash of geohashes) {
      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :pk',
          FilterExpression: '#status = :status',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':pk': `GEO#${geohash}`,
            ':status': 'AVAILABLE',
          },
        })
      );

      const items = (result.Items || []) as DynamoDBMissionItem[];
      
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
  } catch (error) {
    console.error('Error fetching missions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch missions' },
      { status: 500 }
    );
  }
}

// POST /api/missions - Create a new mission (admin/org only)
export async function POST(request: NextRequest) {
  try {
    // TODO: Add authentication check
    const body = await request.json();
    
    // TODO: Implement mission creation logic
    
    return NextResponse.json(
      { message: 'Mission created' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating mission:', error);
    return NextResponse.json(
      { error: 'Failed to create mission' },
      { status: 500 }
    );
  }
}
