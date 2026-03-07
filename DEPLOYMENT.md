# EcoSquad Deployment Guide

Step-by-step guide for deploying EcoSquad to AWS.

## Table of Contents

- [Prerequisites](#prerequisites)
- [First-Time Setup](#first-time-setup)
- [Development Deployment](#development-deployment)
- [Production Deployment](#production-deployment)
- [Manual Deployment](#manual-deployment)
- [Environment Management](#environment-management)
- [Rollback Procedures](#rollback-procedures)

---

## Prerequisites

### Required Tools

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **AWS CLI** 2.x ([Install](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html))
- **AWS CDK** 2.x: `npm install -g aws-cdk`
- **Git**

### AWS Requirements

- AWS Account with appropriate permissions
- IAM user/role with permissions to create:
  - CloudFormation stacks
  - DynamoDB tables
  - Lambda functions
  - API Gateway
  - S3 buckets
  - CloudFront distributions
  - Cognito User Pools

### Local Setup

```bash
# Clone the repository
git clone https://github.com/SKTECHCONSULTING/eco-squad.git
cd eco-squad

# Install dependencies
npm install
cd backend && npm install && cd ..
cd infra && npm install && cd ..

# Configure AWS credentials
aws configure
# OR use SSO
aws sso login
```

---

## First-Time Setup

### 1. Configure Environment Variables

Create environment files:

```bash
# For development
cp .env.development .env
# Edit .env with your AWS credentials and settings

# For production
cp .env.production .env.production.local
# Edit with production values (never commit this file!)
```

### 2. Bootstrap CDK

Required once per AWS account/region:

```bash
cd infra
npx cdk bootstrap aws://YOUR_ACCOUNT_ID/eu-west-1
```

### 3. Validate Setup

```bash
# Run environment validation
node scripts/validate-env.js

# Test build
./scripts/build.sh all dev
```

---

## Development Deployment

### Automated Deployment (Recommended)

Push to the `develop` branch to trigger automatic deployment:

```bash
git checkout develop
git merge your-feature-branch
git push origin develop
```

The GitHub Actions workflow (`.github/workflows/deploy-dev.yml`) will:
1. Run tests
2. Build the application
3. Deploy infrastructure
4. Deploy frontend to S3
5. Invalidate CloudFront cache

### Manual Deployment

If you need to deploy manually:

```bash
# 1. Set environment
export ENVIRONMENT=dev

# 2. Deploy infrastructure
cd infra
npm run build
npx cdk deploy

# Note the outputs: ApiUrl, UserPoolId, UserPoolClientId

# 3. Update environment variables
export NEXT_PUBLIC_API_URL=<ApiUrl from CDK output>

# 4. Build frontend
cd ..
npm run build

# 5. Deploy frontend
./scripts/deploy-frontend.sh
```

---

## Production Deployment

### Prerequisites

Before deploying to production:

1. ✅ All tests passing
2. ✅ Code review completed
3. ✅ Staging environment tested
4. ✅ Database migrations planned (if any)

### Automated Deployment

1. Go to GitHub Actions → Deploy to Production
2. Click "Run workflow"
3. Type `deploy` to confirm
4. Wait for approval (manual gate)

### Manual Production Deployment

```bash
# 1. Set production environment
export ENVIRONMENT=prod

# 2. Deploy infrastructure
cd infra
npm run build
ENVIRONMENT=prod npx cdk deploy

# 3. Build and deploy frontend
cd ..
ENVIRONMENT=prod npm run build
./scripts/deploy-frontend.sh
```

### Post-Deployment Verification

```bash
# Test website
curl -I https://your-domain.com

# Test API
curl "https://your-api.execute-api.eu-west-1.amazonaws.com/prod/missions?lat=48.8566&lng=2.3522&radius=5000"

# Check CloudWatch logs
aws logs tail /aws/lambda/eco-squad-missions-list-prod --follow
```

---

## Environment Management

### GitHub Secrets and Variables

Configure in GitHub: Settings → Secrets and variables → Actions

#### Required Secrets

| Secret | Description |
|--------|-------------|
| `AWS_DEPLOY_ROLE_ARN` | IAM Role ARN for deployment (e.g., `arn:aws:iam::123:role/GitHubActionsDeployRole`) |

#### Required Variables

| Variable | Dev Value Example | Prod Value Example |
|----------|-------------------|-------------------|
| `DEV_APP_URL` | `https://dev.eco-squad.com` | - |
| `DEV_API_URL` | `https://abc123.execute-api.eu-west-1.amazonaws.com/dev` | - |
| `DEV_CORS_ORIGIN` | `https://dev.eco-squad.com` | - |
| `PROD_APP_URL` | - | `https://eco-squad.com` |
| `PROD_API_URL` | - | `https://xyz789.execute-api.eu-west-1.amazonaws.com/prod` |
| `PROD_CORS_ORIGIN` | - | `https://eco-squad.com` |

### Setting Up GitHub OIDC (Recommended)

Instead of long-lived AWS credentials, use OIDC:

1. Create an IAM Identity Provider for GitHub
2. Create a role with trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::YOUR_ACCOUNT:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:SKTECHCONSULTING/eco-squad:*"
        }
      }
    }
  ]
}
```

3. Attach the deployer policy from `infra/iam/deployer-policy.json`

---

## Manual Deployment

### Deploy Specific Components

```bash
# Frontend only
./scripts/build.sh frontend
./scripts/deploy-frontend.sh

# Backend only
./scripts/build.sh backend
cd infra && npx cdk deploy

# Infrastructure only
./scripts/build.sh infra
cd infra && npx cdk deploy
```

### Deploy to Different Regions

```bash
# Set region
export AWS_REGION=us-east-1

# Bootstrap new region
cd infra && npx cdk bootstrap

# Deploy
ENVIRONMENT=prod npx cdk deploy
```

---

## Rollback Procedures

### Frontend Rollback

```bash
# Restore previous version from S3
aws s3 sync s3://backup-bucket/version-X s3://website-bucket --delete

# Invalidate cache
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

### Infrastructure Rollback

```bash
# View previous stack versions
cd infra
npx cdk diff

# Rollback to previous version (if stack is in UPDATE_ROLLBACK_COMPLETE)
npx cdk deploy --force

# For complete rollback, destroy and recreate (DATA LOSS!)
npx cdk destroy
npx cdk deploy
```

### Database Rollback

⚠️ **Warning**: DynamoDB point-in-time recovery must be enabled (it is by default in our CDK stack).

```bash
# Restore table to previous state
aws dynamodb restore-table-to-point-in-time \
  --source-table-name EcoSquadTable-prod \
  --target-table-name EcoSquadTable-prod-restored \
  --use-latest-restorable-time
```

---

## Maintenance

### Updating Dependencies

```bash
# Check for outdated packages
npm outdated

# Update all packages
npm update

# Update CDK (check compatibility first)
cd infra
npm install aws-cdk-lib@latest aws-cdk@latest
```

### Rotating Secrets

1. Update secrets in AWS Secrets Manager or GitHub
2. Redeploy infrastructure:
```bash
cd infra && npx cdk deploy
```

### Monitoring

View metrics in AWS Console:
- **CloudWatch**: Lambda metrics, API Gateway metrics
- **CloudFront**: Cache hit/miss ratios, errors
- **DynamoDB**: Consumed capacity, throttling

---

## Troubleshooting Deployment Failures

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed solutions.

Quick fixes:

```bash
# Check stack events
aws cloudformation describe-stack-events --stack-name EcoSquadStack

# View CDK logs
npx cdk deploy --debug

# Validate templates
npx cdk synth
```

---

## Deployment Checklist

### Before Production Deploy

- [ ] All tests passing locally
- [ ] CI/CD pipeline green
- [ ] Code reviewed and approved
- [ ] Environment variables updated
- [ ] Database backups verified (if applicable)
- [ ] Rollback plan documented

### After Production Deploy

- [ ] Website accessible
- [ ] API responding correctly
- [ ] Authentication working
- [ ] No errors in CloudWatch
- [ ] Smoke tests passing

---

## Support

For deployment issues:

1. Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. Review GitHub Actions logs
3. Check AWS CloudFormation console for stack events
4. Contact the team via GitHub Issues
