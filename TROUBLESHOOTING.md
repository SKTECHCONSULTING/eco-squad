# EcoSquad Troubleshooting Guide

Common issues and their solutions when developing or deploying EcoSquad.

## Table of Contents

- [Development Issues](#development-issues)
- [Build Issues](#build-issues)
- [Deployment Issues](#deployment-issues)
- [AWS/CDK Issues](#awscdk-issues)
- [Environment Issues](#environment-issues)

---

## Development Issues

### `npm install` fails with permission errors

**Problem**: EACCES errors when installing packages globally or locally.

**Solution**:
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) ./node_modules

# Or use npx instead of global installs
npx <command>
```

### Next.js hot reload not working

**Problem**: Changes to files don't trigger automatic browser refresh.

**Solution**:
1. Check if `NODE_ENV` is set to `development`
2. Ensure you're not running in a Docker container with read-only filesystem
3. Try clearing Next.js cache:
```bash
rm -rf .next
npm run dev
```

### DynamoDB Local connection refused

**Problem**: Cannot connect to local DynamoDB instance.

**Solution**:
```bash
# Check if DynamoDB Local is running
docker ps | grep dynamodb

# Start DynamoDB Local manually
docker run -p 8000:8000 amazon/dynamodb-local:latest

# Or use docker-compose
docker-compose up dynamodb-local
```

---

## Build Issues

### TypeScript compilation errors

**Problem**: `tsc` fails with type errors.

**Solution**:
```bash
# Check TypeScript version (must be 5.x)
npx tsc --version

# Run type check only
npx tsc --noEmit

# Clean and rebuild
rm -rf dist node_modules
npm ci
npm run build
```

### `next build` fails with "Cannot find module"

**Problem**: Module resolution errors during build.

**Solution**:
1. Check `tsconfig.json` paths configuration
2. Ensure all imports use correct relative paths
3. Clean and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Lambda build fails with "Cannot find module"

**Problem**: Backend build can't find shared modules.

**Solution**:
```bash
# Build from the correct directory
cd backend
npm run build

# If using path aliases, ensure they're resolved
npm run build:prod  # Includes packaging step
```

---

## Deployment Issues

### CDK bootstrap fails

**Problem**: `cdk bootstrap` fails with permission errors.

**Solution**:
```bash
# Ensure you have the correct AWS credentials
aws sts get-caller-identity

# Bootstrap with explicit profile
npx cdk bootstrap --profile your-profile

# If using SSO
aws sso login
npx cdk bootstrap
```

### CDK deploy fails with "Stack already exists"

**Problem**: Trying to deploy when stack is in a failed state.

**Solution**:
```bash
# Check stack status
aws cloudformation describe-stacks --stack-name EcoSquadStack

# Delete failed stack (careful - this deletes resources!)
aws cloudformation delete-stack --stack-name EcoSquadStack

# Or use CDK destroy
cd infra && npx cdk destroy
```

### S3 deployment fails with "Access Denied"

**Problem**: IAM permissions insufficient for S3 upload.

**Solution**:
1. Check IAM policies in `infra/iam/`
2. Ensure user/role has these permissions:
   - `s3:PutObject`
   - `s3:DeleteObject`
   - `s3:ListBucket`
3. Verify bucket exists and is accessible

### CloudFront cache not invalidating

**Problem**: Updated content not showing on website.

**Solution**:
```bash
# Invalidate manually
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"

# Or use the deploy script
./scripts/deploy-frontend.sh
```

---

## AWS/CDK Issues

### Lambda function timeout

**Problem**: API Gateway returns 504 Gateway Timeout.

**Solution**:
1. Increase Lambda timeout in CDK stack:
```typescript
timeout: cdk.Duration.seconds(30),
```
2. Check CloudWatch Logs for actual error
3. Optimize database queries

### Cognito authentication fails

**Problem**: JWT token validation fails.

**Solution**:
```bash
# Verify User Pool ID
aws cognito-idp describe-user-pool --user-pool-id YOUR_POOL_ID

# Check app client settings
aws cognito-idp describe-user-pool-client \
  --user-pool-id YOUR_POOL_ID \
  --client-id YOUR_CLIENT_ID
```

### DynamoDB throttling errors

**Problem**: `ProvisionedThroughputExceededException`.

**Solution**:
1. Switch to on-demand billing mode (already configured in CDK)
2. Implement exponential backoff in Lambda functions
3. Use batch operations for bulk writes

---

## Environment Issues

### Environment variables not loading

**Problem**: `process.env.VAR_NAME` is undefined.

**Solution**:
1. Ensure `.env` file exists in project root
2. Variables must be loaded before use:
```bash
# Load from file
export $(cat .env | xargs)

# Or use dotenv package (already included)
```

3. For Next.js, use `NEXT_PUBLIC_` prefix for client-side variables

### CI/CD fails with "Environment variable not set"

**Problem**: GitHub Actions missing required secrets.

**Solution**:
1. Check repository secrets: Settings → Secrets and variables → Actions
2. Required secrets:
   - `AWS_DEPLOY_ROLE_ARN`
   - `AWS_REGION` (or set in workflow)
3. Required variables (in GitHub Variables):
   - `DEV_APP_URL`
   - `DEV_API_URL`
   - `PROD_APP_URL`
   - `PROD_API_URL`

### LocalStack S3 not working

**Problem**: Cannot upload files to local S3.

**Solution**:
```bash
# Create bucket manually
aws --endpoint-url=http://localhost:4566 s3 mb s3://eco-squad-evidence-local

# Verify bucket exists
aws --endpoint-url=http://localhost:4566 s3 ls
```

---

## General Debugging Tips

### Enable verbose logging

```bash
# AWS SDK
export DEBUG=*

# CDK
npx cdk deploy --debug

# Next.js
npm run dev -- --verbose
```

### Check CloudWatch Logs

```bash
# List log groups
aws logs describe-log-groups

# Get recent logs
aws logs tail /aws/lambda/your-function-name --follow
```

### Reset everything (nuclear option)

⚠️ **Warning**: This deletes all local data!

```bash
# Clean everything
rm -rf node_modules backend/node_modules infra/node_modules
rm -rf .next dist backend/dist infra/dist
rm -rf infra/cdk.out

# Clean Docker volumes
docker-compose down -v

# Reinstall and rebuild
npm install
cd backend && npm install && cd ..
cd infra && npm install && cd ..
npm run build
```

---

## Getting Help

If you're still stuck:

1. Check the [GitHub Issues](https://github.com/SKTECHCONSULTING/eco-squad/issues)
2. Review AWS documentation:
   - [CDK Documentation](https://docs.aws.amazon.com/cdk/)
   - [Lambda Documentation](https://docs.aws.amazon.com/lambda/)
   - [API Gateway Documentation](https://docs.aws.amazon.com/apigateway/)
3. Create a new issue with:
   - Error message (full stack trace)
   - Steps to reproduce
   - Environment details (OS, Node version, etc.)
