// Route Segment Config
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/missions/{id}/claim
// User/Squad claims an available mission

import { NextRequest, NextResponse } from 'next/server';
import { GetCommand, UpdateCommand } from '@/lib/db/dynamodb';
import { docClient } from '@/lib/db/dynamodb';
import { Mission } from '@/types';
import { addHours } from 'date-fns';

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'EcoSquadTable';
const CLAIM_EXPIRY_HOURS = 24;

interface ClaimRequest {
  squadId: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const missionId = params.id;
    const body: ClaimRequest = await request.json();
    const { squadId } = body;

    if (!squadId) {
      return NextResponse.json(
        { error: 'Missing required field: squadId' },
        { status: 400 }
      );
    }

    // Get the mission
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `MISSION#${missionId}`,
          SK: `METADATA#${missionId}`,
        },
      })
    );

    if (!result.Item) {
      return NextResponse.json(
        { error: 'Mission not found' },
        { status: 404 }
      );
    }

    const mission = result.Item.data as Mission;

    // Check if mission is available
    if (mission.status !== 'AVAILABLE') {
      return NextResponse.json(
        { error: `Mission is not available. Current status: ${mission.status}` },
        { status: 409 }
      );
    }

    const now = new Date();
    const expiresAt = addHours(now, CLAIM_EXPIRY_HOURS);

    // Update mission status
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `MISSION#${missionId}`,
          SK: `METADATA#${missionId}`,
        },
        UpdateExpression: 'SET #status = :status, claimedBy = :claimedBy, claimedAt = :claimedAt, expiresAt = :expiresAt, #data.claimedBy = :claimedBy, #data.claimedAt = :claimedAt, #data.expiresAt = :expiresAt, #data.status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#data': 'data',
        },
        ExpressionAttributeValues: {
          ':status': 'CLAIMED',
          ':claimedBy': squadId,
          ':claimedAt': now.toISOString(),
          ':expiresAt': expiresAt.toISOString(),
        },
        ConditionExpression: '#status = :available',
        ExpressionAttributeValues: {
          ':status': 'CLAIMED',
          ':claimedBy': squadId,
          ':claimedAt': now.toISOString(),
          ':expiresAt': expiresAt.toISOString(),
          ':available': 'AVAILABLE',
        },
      })
    );

    return NextResponse.json({
      status: 'CLAIMED',
      expiresAt: expiresAt.toISOString(),
      mission: {
        ...mission,
        status: 'CLAIMED',
        claimedBy: squadId,
        claimedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error claiming mission:', error);
    
    if (error.name === 'ConditionalCheckFailedException') {
      return NextResponse.json(
        { error: 'Mission was already claimed by another squad' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to claim mission' },
      { status: 500 }
    );
  }
}
