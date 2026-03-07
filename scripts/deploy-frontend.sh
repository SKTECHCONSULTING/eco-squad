#!/bin/bash
set -e

# EcoSquad Frontend Deployment Script
# Usage: ./deploy-frontend.sh [environment]

ENVIRONMENT=${1:-dev}
AWS_REGION=${AWS_REGION:-eu-west-1}

echo "🚀 Deploying EcoSquad Frontend to $ENVIRONMENT"

# Get CloudFront Distribution ID from CDK outputs
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name "eco-squad-$ENVIRONMENT" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
  --output text \
  --region "$AWS_REGION" 2>/dev/null || echo "")

if [ -z "$DISTRIBUTION_ID" ]; then
  echo "❌ Could not find CloudFront Distribution ID. Make sure infrastructure is deployed first."
  exit 1
fi

# Get S3 bucket name
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name "eco-squad-$ENVIRONMENT" \
  --query "Stacks[0].Outputs[?OutputKey=='WebsiteBucketName'].OutputValue" \
  --output text \
  --region "$AWS_REGION" 2>/dev/null || echo "")

if [ -z "$BUCKET_NAME" ]; then
  echo "❌ Could not find S3 Website Bucket. Make sure infrastructure is deployed first."
  exit 1
fi

# Build the frontend
echo "📦 Building Next.js application..."
npm run build

# Check if build succeeded
if [ ! -d "dist" ]; then
  echo "❌ Build failed - dist directory not found"
  exit 1
fi

# Sync to S3
echo "☁️  Uploading to S3: $BUCKET_NAME"
aws s3 sync dist/ "s3://$BUCKET_NAME/" \
  --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "*.html" \
  --exclude "*.json"

# Upload HTML files with different cache settings
aws s3 sync dist/ "s3://$BUCKET_NAME/" \
  --delete \
  --cache-control "public,max-age=0,must-revalidate" \
  --include "*.html" \
  --include "*.json"

# Invalidate CloudFront cache
echo "🔄 Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" \
  --region "$AWS_REGION"

# Get CloudFront domain
DOMAIN=$(aws cloudfront get-distribution \
  --id "$DISTRIBUTION_ID" \
  --query "Distribution.DomainName" \
  --output text \
  --region "$AWS_REGION" 2>/dev/null || echo "")

echo "✅ Frontend deployed successfully!"
echo "🌐 Website URL: https://$DOMAIN"
echo ""
echo "Note: CloudFront invalidation may take a few minutes to propagate."
