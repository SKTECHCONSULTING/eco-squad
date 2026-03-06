# EcoSquad Technical Blueprint

## Project Overview
**EcoSquad** is an Environmental Micro-Volunteering Platform connecting individuals and corporations with location-based environmental missions.

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | Next.js API Routes, AWS Lambda |
| Database | AWS DynamoDB with Geohash GSI |
| Auth | AWS Cognito |
| Storage | AWS S3 |
| AI Verification | AWS Rekognition |

## Database Schema

### EcoSquadTable
| Attribute | Type | Description |
|-----------|------|-------------|
| PK | String | Partition Key (MISSION#<id>, USER#<id>, SQUAD#<id>) |
| SK | String | Sort Key (METADATA#<id>) |
| GSI1PK | String | Geohash for location queries (GEO#<geohash>) |
| GSI1SK | String | Timestamp#ID for sorting |
| data | Map | Full entity data |
| status | String | Entity status |
| impactPoints | Number | Impact score |
| createdAt | String | ISO timestamp |

## API Endpoints

### GET /api/missions?lat={lat}&lng={lng}&radius={r}
Discover nearby missions using Geohash-based GSI query.

### POST /api/missions/{id}/claim
Claim an available mission.
**Body:** `{ squadId: string }`

### POST /api/missions/{id}/submit-evidence
Submit photo evidence for verification.
**Body:** `{ imageS3Key: string, lat: number, lng: number }`

## Implementation Plan

1. **Infra & DB Schema** - Provision AWS resources via CDK
2. **Geohash Utility & Discovery** - Implement location-based search
3. **Mission Lifecycle API** - Create/Claim/Submit endpoints
4. **Verification Lambda** - S3 trigger → Rekognition → DynamoDB
5. **Mobile Field Client** - Native Camera & Map integration
6. **Corporate Web Dashboard** - Impact visualizations

## File Structure
```
eco-squad/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/missions/ # API Routes
│   │   ├── dashboard/    # Corporate dashboard
│   │   └── missions/     # Mission discovery
│   ├── components/       # React components
│   ├── lib/
│   │   ├── db/          # DynamoDB client
│   │   └── services/    # Business logic
│   └── types/           # TypeScript types
├── mobile/
│   ├── ios/             # Swift/SwiftUI app
│   └── android/         # Kotlin/Jetpack Compose app
└── infra/               # AWS CDK infrastructure
```
