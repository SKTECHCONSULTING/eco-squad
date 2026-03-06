# EcoSquad API Documentation

## Overview
RESTful API for the EcoSquad environmental micro-volunteering platform.

## Authentication

### Cognito Integration
The API uses AWS Cognito for authentication via NextAuth.js.

**Environment Variables:**
```bash
COGNITO_CLIENT_ID=
COGNITO_CLIENT_SECRET=
COGNITO_ISSUER=https://cognito-idp.{region}.amazonaws.com/{userPoolId}
```

**Authentication Header:**
```
Authorization: Bearer {access_token}
```

## API Endpoints

### Missions

#### List/Discover Missions
```
GET /api/missions?lat={lat}&lng={lng}&radius={radius}
```
- Query params: `lat` (required), `lng` (required), `radius` (default: 5000m)
- Returns nearby available missions sorted by distance

#### Create Mission
```
POST /api/missions
```
- Auth: Admin or Organization only
- Body: `{ title, description, type, location: { lat, lng, address? }, impactPoints, expiresAt?, tags? }`

#### Get Mission
```
GET /api/missions/{id}
```
- Returns single mission details

#### Update Mission
```
PATCH /api/missions/{id}
```
- Auth: Admin, Organization, or Squad Leader
- Body: Partial mission update

#### Delete Mission
```
DELETE /api/missions/{id}
```
- Auth: Admin only
- Cannot delete completed missions

#### Claim Mission
```
POST /api/missions/{id}/claim
```
- Auth: Authenticated user (must be squad member)
- Body: `{ squadId }`
- Transaction-safe with 24h expiry

#### Submit Evidence
```
POST /api/missions/{id}/submit-evidence
```
- Auth: Squad member
- Body: `{ imageS3Key, lat, lng }`
- Location must be within 500m of mission
- S3 key must be valid image (.jpg, .jpeg, .png, .webp)

### Squads

#### List Squads
```
GET /api/squads?userId={userId}&limit={limit}
```
- Optional filter by user membership

#### Create Squad
```
POST /api/squads
```
- Auth: Authenticated
- Body: `{ name, memberIds: string[] }`
- Max 20 members, 5 squads per user

#### Get Squad
```
GET /api/squads/{id}
```

#### Update Squad
```
PATCH /api/squads/{id}
```
- Auth: Squad Leader
- Body: `{ name? }`

#### Delete Squad
```
DELETE /api/squads/{id}
```
- Auth: Squad Leader
- Cannot delete with active missions

#### List Members
```
GET /api/squads/{id}/members
```

#### Add Member
```
POST /api/squads/{id}/members
```
- Auth: Squad Leader
- Body: `{ userId, role?: 'LEADER' | 'MEMBER' }`

#### Remove Member
```
DELETE /api/squads/{id}/members?userId={userId}
```
- Auth: Squad Leader or Self

### Authentication

#### NextAuth.js Handler
```
GET|POST /api/auth/[...nextauth]
```
- Handles signin/signout/callbacks

## Rate Limits

| Endpoint Type | Max Requests | Window |
|--------------|--------------|--------|
| Default | 100 | 1 minute |
| Mission Claim | 10 | 1 minute |
| Evidence Submit | 20 | 1 hour |
| Squad Create | 5 | 1 hour |
| Auth | 5 | 1 minute |

## Error Responses

All errors follow this format:
```json
{
  "error": {
    "message": "Description of error",
    "code": "ERROR_CODE",
    "details": { ... }
  },
  "requestId": "uuid"
}
```

### Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request / Validation Error
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `429` - Rate Limited
- `500` - Internal Server Error

## Data Models

### Mission
```typescript
{
  id: string;
  title: string;
  description: string;
  type: 'LITTER_COLLECTION' | 'TREE_PLANTING' | 'BIO_DIVERSITY' | 
        'WATER_QUALITY' | 'RECYCLING' | 'RESTORATION';
  status: 'AVAILABLE' | 'CLAIMED' | 'IN_PROGRESS' | 
          'PENDING_VERIFICATION' | 'COMPLETED' | 'EXPIRED';
  location: { lat: number; lng: number; geohash: string; address?: string };
  impactPoints: number;
  createdAt: string;
  expiresAt?: string;
  claimedBy?: string;
  claimedAt?: string;
  evidence?: Evidence;
  tags: string[];
}
```

### Squad
```typescript
{
  id: string;
  name: string;
  members: SquadMember[];
  totalImpactPoints: number;
  completedMissions: number;
  createdAt: string;
}
```

### Evidence
```typescript
{
  imageS3Key: string;
  submittedAt: string;
  location: { lat: number; lng: number };
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'MANUAL_REVIEW';
}
```
