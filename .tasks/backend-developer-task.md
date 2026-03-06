# Task: Complete Backend API for EcoSquad

## Overview
Complete the Next.js API routes and backend services for the EcoSquad platform.

## Repository
Local path: /home/ec2-user/.openclaw/workspace/eco-squad

## What Exists
- TypeScript types defined (src/types/index.ts)
- DynamoDB client setup (src/lib/db/dynamodb.ts)
- Geohash service (src/lib/services/geo-service.ts)
- Verification service (src/lib/services/verification-service.ts)
- Skeleton API routes for missions, claim, submit-evidence

## Your Tasks
1. **Complete API Routes**:
   - `src/app/api/missions/route.ts` - Implement POST (create mission)
   - `src/app/api/missions/[id]/claim/route.ts` - Add transaction safety, expiry handling
   - `src/app/api/missions/[id]/submit-evidence/route.ts` - Complete with validation
   - `src/app/api/missions/[id]/route.ts` - GET single mission, PATCH update
   - `src/app/api/squads/route.ts` - CRUD for squads
   - `src/app/api/auth/[...nextauth]/route.ts` - Cognito auth integration

2. **Enhance Services**:
   - Add error handling and retries to DynamoDB operations
   - Implement proper transaction handling for claim operations
   - Add rate limiting helpers
   - Create notification service (placeholder for future SNS integration)

3. **Add Middleware**:
   - Authentication middleware
   - Request validation using Zod
   - Error handling middleware
   - CORS configuration

4. **API Documentation**:
   - Create OpenAPI/Swagger spec (docs/api-spec.yaml)

## Key Requirements
- All endpoints must validate input with Zod
- Use DynamoDB transactions for atomic operations
- Implement proper error responses (400, 401, 404, 409, 500)
- Add logging for all operations
- Follow RESTful conventions

## DynamoDB Access Patterns
- Get mission by ID: PK=MISSION#<id>, SK=METADATA#<id>
- Query missions by geohash: GSI1PK=GEO#<geohash>
- Get squad by ID: PK=SQUAD#<id>, SK=METADATA#<id>
- Get user by ID: PK=USER#<id>, SK=METADATA#<id>

## Deliverables
- Complete, working API routes
- Enhanced service layer
- Middleware implementations
- API documentation

Test each endpoint with sample data to ensure it works.