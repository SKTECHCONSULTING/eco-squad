// EcoSquad Core Types

export interface Mission {
  id: string;
  title: string;
  description: string;
  type: MissionType;
  status: MissionStatus;
  location: {
    lat: number;
    lng: number;
    geohash: string;
    address?: string;
  };
  impactPoints: number;
  createdAt: string;
  updatedAt?: string;
  expiresAt?: string;
  claimedBy?: string;
  claimedAt?: string;
  completedAt?: string;
  evidence?: Evidence;
  tags: string[];
}

export type MissionType = 
  | 'LITTER_COLLECTION'
  | 'TREE_PLANTING'
  | 'BIO_DIVERSITY'
  | 'WATER_QUALITY'
  | 'RECYCLING'
  | 'RESTORATION';

export type MissionStatus = 
  | 'AVAILABLE'
  | 'CLAIMED'
  | 'IN_PROGRESS'
  | 'PENDING_VERIFICATION'
  | 'COMPLETED'
  | 'EXPIRED';

export interface Evidence {
  imageS3Key: string;
  submittedAt: string;
  location: {
    lat: number;
    lng: number;
  };
  verificationStatus: VerificationStatus;
  verificationResult?: VerificationResult;
  aiConfidence?: number;
}

export type VerificationStatus = 
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'MANUAL_REVIEW';

export interface VerificationResult {
  labels: string[];
  confidence: number;
  detectedObjects: DetectedObject[];
  moderationFlags: string[];
}

export interface DetectedObject {
  name: string;
  confidence: number;
  boundingBox?: BoundingBox;
}

export interface BoundingBox {
  width: number;
  height: number;
  left: number;
  top: number;
}

export interface Squad {
  id: string;
  name: string;
  members: SquadMember[];
  totalImpactPoints: number;
  completedMissions: number;
  activeMissions?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface SquadMember {
  userId: string;
  role: 'LEADER' | 'MEMBER';
  joinedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  totalImpactPoints: number;
  squads: string[];
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  description: string;
  missions: string[];
  totalImpactPoints: number;
  memberCount: number;
  createdAt: string;
}

// API Request/Response Types

export interface DiscoverMissionsRequest {
  lat: number;
  lng: number;
  radius: number;
}

export interface DiscoverMissionsResponse {
  missions: Mission[];
  total: number;
}

export interface ClaimMissionRequest {
  squadId: string;
}

export interface ClaimMissionResponse {
  status: 'CLAIMED';
  expiresAt: string;
  mission: Mission;
}

export interface SubmitEvidenceRequest {
  imageS3Key: string;
  lat: number;
  lng: number;
}

export interface SubmitEvidenceResponse {
  status: 'PENDING_VERIFICATION';
  evidenceId: string;
  estimatedReviewTime: string;
}

// DynamoDB Types

export interface DynamoDBMissionItem {
  PK: string;
  SK: string;
  GSI1PK: string;
  GSI1SK: string;
  data: Mission;
  status: MissionStatus;
  impactPoints: number;
  createdAt: string;
  ttl?: number;
}

export interface DynamoDBSquadItem {
  PK: string;
  SK: string;
  data: Squad;
  totalImpactPoints: number;
  createdAt: string;
}

export interface DynamoDBUserItem {
  PK: string;
  SK: string;
  data: User;
  totalImpactPoints: number;
  createdAt: string;
}

// Lambda Types

export interface AuthenticatedEvent {
  requestContext: {
    authorizer?: {
      claims: {
        sub: string;
        email: string;
        name?: string;
        'cognito:groups'?: string;
      };
    };
  };
  body: string | null;
  queryStringParameters: { [name: string]: string } | null;
  pathParameters: { [name: string]: string } | null;
  headers: { [name: string]: string };
  httpMethod: string;
  path: string;
}

export interface ApiResponse {
  statusCode: number;
  headers: {
    'Content-Type': string;
    'Access-Control-Allow-Origin': string;
    'Access-Control-Allow-Headers': string;
    'Access-Control-Allow-Methods': string;
  };
  body: string;
}

export interface CognitoUser {
  userId: string;
  email: string;
  name?: string;
  groups: string[];
}
