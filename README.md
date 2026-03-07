# EcoSquad - Environmental Micro-Volunteering Platform

Empowering communities to take environmental action through micro-volunteering missions.

## 🚀 Quick Start (One-Command Setup)

```bash
# Clone and setup
git clone https://github.com/SKTECHCONSULTING/eco-squad.git
cd eco-squad
npm install && npm run build:all

# Configure environment
cp .env.development .env
# Edit .env with your AWS credentials

# Start development
npm run dev
```

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
├── .github/workflows/    # CI/CD pipelines
├── backend/              # Serverless Lambda functions
│   └── src/
│       ├── functions/    # API Lambda handlers
│       ├── lib/          # Shared utilities
│       └── types/        # TypeScript types
├── infra/                # AWS CDK infrastructure
│   ├── lib/              # CDK stack definitions
│   └── iam/              # IAM policies
├── scripts/              # Build and deployment scripts
├── src/                  # Next.js frontend (App Router)
│   ├── app/              # Pages and layouts
│   ├── components/       # React components
│   └── lib/              # Frontend utilities
└── mobile/               # Mobile apps (iOS/Android)
    ├── ios/
    └── android/
```

## 📋 Prerequisites

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **AWS CLI** 2.x configured ([Install](https://docs.aws.amazon.com/cli/))
- **AWS CDK**: `npm install -g aws-cdk`
- **Git**

## 🛠️ Development Setup

### Option 1: Automated Setup (Recommended)

```bash
# Run the setup script
npm install
npm run build:all dev
```

### Option 2: Manual Setup

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..

# Install infrastructure dependencies
cd infra && npm install && cd ..

# Build everything
npm run build:all
```

### Environment Configuration

Create your environment file:

```bash
# For development
cp .env.development .env

# For production (never commit this!)
cp .env.production .env.production.local
```

Edit `.env` with your AWS credentials:

```env
# Required AWS Configuration
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# Environment
ENVIRONMENT=dev
NODE_ENV=development

# URLs (update after first deployment)
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001

# Optional: For local development
DYNAMODB_ENDPOINT=http://localhost:8000
S3_LOCAL_ENDPOINT=http://localhost:4566
```

### Validate Setup

```bash
# Validate environment variables
npm run validate

# Run all builds
npm run build:all

# Run tests
npm test
```

## 📦 Deployment

### Development Deployment

```bash
# Deploy to dev environment
npm run deploy:dev
```

Or use GitHub Actions:
- Push to `develop` branch for automatic deployment

### Production Deployment

```bash
# Deploy to production
npm run deploy:prod
```

Or use GitHub Actions:
- Go to Actions → Deploy to Production → Run workflow

### Manual Deployment Steps

1. **Deploy Infrastructure**:
```bash
cd infra
npm run build
npx cdk deploy
```

2. **Note the outputs** (ApiUrl, UserPoolId, etc.)

3. **Update environment variables** with the outputs

4. **Build and deploy frontend**:
```bash
npm run build
./scripts/deploy-frontend.sh
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## 🐳 Docker Development

For a consistent development environment:

```bash
# Start all services
docker-compose up

# Start specific services
docker-compose up frontend dynamodb-local

# Stop everything
docker-compose down -v
```

Services available:
- **Frontend**: http://localhost:3000
- **DynamoDB Local**: http://localhost:8000
- **DynamoDB Admin UI**: http://localhost:8001
- **LocalStack**: http://localhost:4566

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run type checking
npm run type-check
```

## 🔧 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run build:all` | Build frontend, backend, and infrastructure |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint errors |
| `npm run format` | Format code with Prettier |
| `npm run validate` | Validate environment variables |
| `npm run test` | Run tests |
| `npm run deploy:dev` | Deploy to development |
| `npm run deploy:prod` | Deploy to production |
| `npm run synth` | Synthesize CDK templates |
| `npm run bootstrap` | Bootstrap CDK |
| `npm run docker:dev` | Start Docker development environment |

## 📚 API Documentation

### Authentication

All protected endpoints require a valid Cognito JWT token:

```
Authorization: Bearer <jwt-token>
```

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/missions?lat={lat}&lng={lng}&radius={r}` | No | Discover nearby missions |
| POST | `/missions` | Yes (Admin) | Create a new mission |
| GET | `/missions/{id}` | No | Get mission details |
| PATCH | `/missions/{id}` | Yes | Update mission |
| DELETE | `/missions/{id}` | Yes (Admin) | Delete mission |
| POST | `/missions/{id}/claim` | Yes | Claim a mission |
| POST | `/missions/{id}/submit-evidence` | Yes | Submit evidence |
| GET | `/squads` | No | List squads |
| POST | `/squads` | Yes | Create a squad |
| GET | `/squads/{id}` | No | Get squad details |
| PATCH | `/squads/{id}` | Yes | Update squad |
| DELETE | `/squads/{id}` | Yes | Delete squad |

See [API.md](./API.md) for complete documentation.

## 📱 Mobile Apps

### iOS
Located in `mobile/ios/`. Built with SwiftUI.

```bash
cd mobile/ios
open EcoSquad.xcodeproj
```

### Android
Located in `mobile/android/`. Built with Jetpack Compose.

```bash
cd mobile/android
./gradlew assembleDebug
```

## 🔒 Security

- All API endpoints use HTTPS
- Authentication via Cognito JWT tokens
- Protected endpoints validate user groups
- CORS configured for specific origins
- S3 buckets block public access
- CloudFront provides DDoS protection

See [infra/iam/](./infra/iam/) for IAM policies.

## 🆘 Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for solutions to common issues.

Quick fixes:

```bash
# Clean and rebuild
rm -rf node_modules dist .next
npm install
npm run build:all

# Reset Docker environment
docker-compose down -v
docker-compose up
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Quality

We use:
- **ESLint** for code linting
- **Prettier** for code formatting
- **Husky** for pre-commit hooks
- **Jest** for testing

Make sure to run before committing:
```bash
npm run lint
npm run format
npm test
```

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Built with ❤️ for environmental action
- Powered by AWS, Next.js, and community volunteers

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/SKTECHCONSULTING/eco-squad/issues)
- **Documentation**: See [DEPLOYMENT.md](./DEPLOYMENT.md) and [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
