# Task: Complete AWS Infrastructure for EcoSquad

## Overview
Complete the AWS CDK infrastructure for the EcoSquad environmental micro-volunteering platform.

## Repository
Local path: /home/ec2-user/.openclaw/workspace/eco-squad
GitHub: SKTECHCONSULTING/eco-squad (to be pushed)

## What Exists
- Basic CDK stack with DynamoDB, S3, Cognito skeleton
- Placeholder Lambda for verification

## Your Tasks
1. **Complete the CDK Stack** (infra/lib/eco-squad-stack.ts):
   - Properly configure DynamoDB with TTL for mission expiration
   - Add S3 bucket notifications for verification Lambda trigger
   - Set up Cognito with proper groups (Admins, Organizations, Volunteers)
   - Add IAM policies following least privilege principle

2. **Implement Verification Lambda** (infra/lib/verification-lambda.ts):
   - S3 trigger handler for new evidence uploads
   - AWS Rekognition integration for image analysis
   - DynamoDB update for verification results
   - Impact point attribution logic

3. **Add CDK Tests** (infra/test/):
   - Unit tests for stack configuration
   - Snapshot tests

4. **Create IAM Policy Documents** (infra/iam/):
   - deployer-policy.json - For CI/CD deployment
   - runtime-policy.json - For application runtime

## Key Requirements
- Use environment variables for configuration
- Enable CloudWatch logging for all Lambdas
- Set up proper resource tagging
- Add CORS configuration for S3
- Enable DynamoDB point-in-time recovery

## DynamoDB Schema Reference
- PK: MISSION#<id> | USER#<id> | SQUAD#<id>
- SK: METADATA#<id>
- GSI1PK: GEO#<geohash>
- GSI1SK: <timestamp>#<id>

## Deliverables
- Complete, working CDK stack
- Lambda handler for verification
- IAM policy documents
- Test coverage

Run `cdk synth` to verify the stack compiles before finishing.