// Route Segment Config
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// POST /api/missions/{id}/submit-evidence
// Upload photo metadata and location for verification

import { NextRequest, NextResponse } from 'next/server';
import { GetCommand, UpdateCommand } from '@/lib/db/dynamodb';
import { docClient } from '@/lib/db/dynamodb';
import { Mission, Evidence } from '@/types';

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'EcoSquadTable';

interface SubmitEvidenceRequest {
  imageS3Key: string;
  lat: number;
  lng: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const missionId = params.id;
    const body: SubmitEvidenceRequest = await request.json();
    const { imageS3Key, lat, lng } = body;

    if (!imageS3Key || lat === undefined || lng === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: imageS3Key, lat, lng' },
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

    // Check if mission is claimed
    if (mission.status !== 'CLAIMED' && mission.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: `Cannot submit evidence. Mission status: ${mission.status}` },
        { status: 409 }
      );
    }

    // Create evidence record
    const evidence: Evidence = {
      imageS3Key,
      submittedAt: new Date().toISOString(),
      location: { lat, lng },
      verificationStatus: 'PENDING',
    };

    // Update mission with evidence
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `MISSION#${missionId}`,
          SK: `METADATA#${missionId}`,
        },
        UpdateExpression: 'SET #status = :status, evidence = :evidence, #data.evidence = :evidence, #data.status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#data': 'data',
        },
        ExpressionAttributeValues: {
          ':status': 'PENDING_VERIFICATION',
          ':evidence': evidence,
        },
      })
    );

    // TODO: Trigger async verification Lambda

    return NextResponse.json({
      status: 'PENDING_VERIFICATION',
      evidenceId: `${missionId}-evidence`,
      estimatedReviewTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
    });
  } catch (error) {
    console.error('Error submitting evidence:', error);
    return NextResponse.json(
      { error: 'Failed to submit evidence' },
      { status: 500 }
    );
  }
}
