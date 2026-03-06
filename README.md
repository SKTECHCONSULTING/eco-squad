# EcoSquad - Environmental Micro-Volunteering Platform

Empowering communities to take environmental action through micro-volunteering missions.

## 🌱 Mission

EcoSquad connects environmentally conscious individuals and corporations with bite-sized, location-based environmental missions. From litter collection to biodiversity documentation, make a measurable impact in your community.

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes + AWS Lambda
- **Database**: AWS DynamoDB with Geohash-based GSI
- **Auth**: AWS Cognito
- **Storage**: AWS S3
- **AI Verification**: AWS Rekognition

### Project Structure
```
eco-squad/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API Routes
│   │   ├── dashboard/    # Corporate dashboard
│   │   └── missions/     # Mission discovery
│   ├── components/       # React components
│   ├── lib/             # Utilities & services
│   │   ├── db/          # DynamoDB client
│   │   └── services/    # Business logic
│   └── types/           # TypeScript types
├── mobile/
│   ├── ios/             # Swift/SwiftUI app
│   └── android/         # Kotlin/Jetpack Compose app
└── infra/               # AWS CDK infrastructure
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- AWS CLI configured
- GitHub account

### Installation

```bash
# Clone the repository
git clone https://github.com/SKTECHCONSULTING/eco-squad.git
cd eco-squad

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your AWS credentials

# Run development server
npm run dev
```

### Environment Variables

```env
# AWS Configuration
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# DynamoDB
DYNAMODB_TABLE_NAME=EcoSquadTable

# Cognito
COGNITO_USER_POOL_ID=your_pool_id
COGNITO_CLIENT_ID=your_client_id

# S3
S3_BUCKET_NAME=eco-squad-evidence

# Geohash
GEOHASH_PRECISION=7
```

## 📚 API Documentation

### Missions

#### Discover Nearby Missions
```http
GET /api/missions?lat={lat}&lng={lng}&radius={r}
```

#### Claim Mission
```http
POST /api/missions/{id}/claim
Content-Type: application/json

{
  "squadId": "string"
}
```

#### Submit Evidence
```http
POST /api/missions/{id}/submit-evidence
Content-Type: application/json

{
  "imageS3Key": "string",
  "lat": number,
  "lng": number
}
```

## 🛠️ Development

### Running Tests
```bash
npm test
```

### Database Setup
```bash
npm run db:setup
```

## 📱 Mobile Apps

### iOS
Located in `mobile/ios/`. Built with SwiftUI.

### Android
Located in `mobile/android/`. Built with Jetpack Compose.

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
