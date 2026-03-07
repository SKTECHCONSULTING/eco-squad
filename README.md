# EcoSquad - Environmental Micro-Volunteering Platform

Empowering communities to take environmental action through micro-volunteering missions.

## 🌱 Mission

EcoSquad connects environmentally conscious individuals and corporations with bite-sized, location-based environmental missions. From litter collection to biodiversity documentation, make a measurable impact in your community.

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 14 (Static Export) + TypeScript + Tailwind CSS
- **Backend**: AWS Lambda (Node.js 20) + API Gateway
- **Auth**: AWS Cognito with JWT Authorizers
- **Database**: AWS DynamoDB with Geohash-based GSI
- **Storage**: AWS S3 (Evidence + Static Website)
- **CDN**: AWS CloudFront
- **AI Verification**: AWS Rekognition
- **Infrastructure**: AWS CDK (TypeScript)

### Project Structure
```
eco-squad/
├── backend/             # Serverless Lambda functions
│   └── src/
│       ├── functions/   # API Lambda handlers
│       ├── lib/         # Shared utilities (db, validation, etc.)
│       └── types/       # TypeScript types
├── infra/               # AWS CDK infrastructure
│   └── lib/
│       └── eco-squad-stack.ts
├── scripts/             # Deployment scripts
│   └── deploy-frontend.sh
├── src/                 # Next.js frontend (App Router)
│   ├── app/            # Pages and layouts
│   ├── components/     # React components
│   └── lib/            # Frontend utilities
└── mobile/             # Mobile apps (iOS/Android)
    ├── ios/
    └── android/
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- AWS CLI configured with appropriate credentials
- AWS CDK installed globally: `npm install -g aws-cdk`
- Git

### Environment Variables

Create a `.env` file in the root directory:

```env
# AWS Configuration
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# Environment
ENVIRONMENT=dev

# CORS (for local development)
CORS_ORIGIN=http://localhost:3000

# Optional: OAuth Callback URLs (comma-separated)
OAUTH_CALLBACK_URLS=http://localhost:3000/auth/callback
OAUTH_LOGOUT_URLS=http://localhost:3000
```

### Installation

```bash
# Clone the repository
git clone https://github.com/SKTECHCONSULTING/eco-squad.git
cd eco-squad

# Install root dependencies
npm install

# Install infrastructure dependencies
cd infra && npm install && cd ..

# Install backend dependencies
cd backend && npm install && cd ..
```

## 📦 Deployment

### 1. Deploy Infrastructure (First Time Only)

This deploys the CDK stack including DynamoDB, Cognito, Lambda functions, API Gateway, S3, and CloudFront.

```bash
# Bootstrap CDK (only needed once per AWS account/region)
npm run bootstrap

# Deploy all infrastructure
npm run deploy:infra
```

The deployment will output:
- `ApiUrl`: Your API Gateway endpoint
- `UserPoolId`: Cognito User Pool ID
- `UserPoolClientId`: Cognito App Client ID
- `CloudFrontDomain`: Your website URL
- `CloudFrontDistributionId`: For cache invalidation

### 2. Deploy Frontend

```bash
# Build and deploy to S3 + CloudFront
npm run deploy:frontend

# Or manually:
# npm run build
# ./scripts/deploy-frontend.sh
```

### 3. Deploy Everything

```bash
# Build frontend and deploy everything
npm run deploy:all
```

### Development Workflow

```bash
# Run local development server (frontend only)
npm run dev

# Synthesize CDK templates without deploying
npm run synth

# Deploy specific environment
ENVIRONMENT=prod npm run deploy:infra
```

## 📚 API Documentation

### Authentication

All protected endpoints require a valid Cognito JWT token in the Authorization header:

```
Authorization: Bearer <jwt-token>
```

### Endpoints

#### Missions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/missions?lat={lat}&lng={lng}&radius={r}` | No | Discover nearby missions |
| POST | `/missions` | Yes (Admin) | Create a new mission |
| GET | `/missions/{id}` | No | Get mission details |
| PATCH | `/missions/{id}` | Yes | Update mission |
| DELETE | `/missions/{id}` | Yes (Admin) | Delete mission |
| POST | `/missions/{id}/claim` | Yes | Claim a mission |
| POST | `/missions/{id}/submit-evidence` | Yes | Submit evidence |

#### Squads

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/squads` | No | List squads |
| POST | `/squads` | Yes | Create a squad |
| GET | `/squads/{id}` | No | Get squad details |
| PATCH | `/squads/{id}` | Yes | Update squad |
| DELETE | `/squads/{id}` | Yes | Delete squad |
| GET | `/squads/{id}/members` | No | List members |
| POST | `/squads/{id}/members` | Yes | Add member |
| DELETE | `/squads/{id}/members/{userId}` | Yes | Remove member |

### Example Request

```bash
# Get nearby missions
curl "https://your-api.execute-api.eu-west-1.amazonaws.com/dev/missions?lat=48.8566&lng=2.3522&radius=5000"

# Create mission (requires auth)
curl -X POST "https://your-api.execute-api.eu-west-1.amazonaws.com/dev/missions" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Park Cleanup",
    "description": "Clean up litter at Central Park",
    "type": "LITTER_COLLECTION",
    "location": {"lat": 48.8566, "lng": 2.3522},
    "impactPoints": 100,
    "tags": ["park", "cleanup"]
  }'
```

## 🛠️ Development

### Backend Development

The backend is organized as individual Lambda functions:

```
backend/src/functions/
├── missions/
│   ├── index.ts          # GET /missions, POST /missions
│   ├── [id].ts           # GET /missions/:id, PATCH, DELETE
│   ├── claim.ts          # POST /missions/:id/claim
│   └── submit-evidence.ts # POST /missions/:id/submit-evidence
└── squads/
    ├── index.ts          # GET /squads, POST /squads
    ├── [id].ts           # GET /squads/:id, PATCH, DELETE
    └── members.ts        # GET /squads/:id/members, POST, DELETE
```

Each function:
- Uses Zod for input validation
- Returns standardized API responses
- Supports CORS
- Integrates with Cognito for authentication

### Adding a New API Endpoint

1. Create a new Lambda handler in `backend/src/functions/`
2. Add the function to the CDK stack in `infra/lib/eco-squad-stack.ts`
3. Add the API Gateway route with appropriate authorizer
4. Deploy: `npm run deploy:infra`

### Frontend Development

The frontend is configured for static export:

```bash
# Development server
npm run dev

# Build for production (creates static files in `dist/`)
npm run build

# Preview production build
npx serve dist
```

### Environment-Specific Configuration

For production deployment:

```bash
# Set environment
export ENVIRONMENT=prod

# Update environment variables
export CORS_ORIGIN=https://your-domain.com
export OAUTH_CALLBACK_URLS=https://your-domain.com/auth/callback

# Deploy
npm run deploy:all
```

## 📱 Mobile Apps

### iOS
Located in `mobile/ios/`. Built with SwiftUI.

### Android
Located in `mobile/android/`. Built with Jetpack Compose.

## 🔒 Security

- All API endpoints use HTTPS
- Authentication via Cognito JWT tokens
- Protected endpoints validate user groups (Admins, Organizations, Volunteers)
- CORS configured for specific origins
- S3 buckets block public access
- CloudFront provides DDoS protection

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run CDK tests
cd infra && npm test
```

## 📊 Monitoring

- CloudWatch Logs for Lambda functions
- CloudWatch Metrics for API Gateway
- CloudWatch Alarms for 5xx errors
- X-Ray tracing enabled

## 🗑️ Cleanup

To destroy all infrastructure:

```bash
cd infra && cdk destroy
```

⚠️ **Warning**: This will delete all data in DynamoDB and S3 unless retention policies are set.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Built with ❤️ for environmental action
- Powered by AWS, Next.js, and community volunteers
