#!/usr/bin/env node
/**
 * Environment Validation Script
 * Validates that all required environment variables are set
 * Run this before building or deploying
 */

const requiredVars = {
  // AWS Configuration
  AWS_REGION: 'AWS Region (e.g., eu-west-1)',
  AWS_ACCESS_KEY_ID: 'AWS Access Key ID',
  AWS_SECRET_ACCESS_KEY: 'AWS Secret Access Key',
  
  // Environment
  NODE_ENV: 'Node environment (development/production)',
  ENVIRONMENT: 'Environment name (dev/staging/prod)',
  
  // Frontend
  NEXT_PUBLIC_APP_URL: 'Public app URL',
  NEXT_PUBLIC_API_URL: 'Public API URL',
  
  // Database
  DYNAMODB_TABLE_NAME: 'DynamoDB table name',
  
  // Storage
  S3_BUCKET_NAME: 'S3 bucket name for evidence storage',
  
  // Auth
  COGNITO_USER_POOL_ID: 'Cognito User Pool ID',
  COGNITO_CLIENT_ID: 'Cognito Client ID',
};

const optionalVars = {
  DYNAMODB_ENDPOINT: 'DynamoDB endpoint (for local development)',
  S3_LOCAL_ENDPOINT: 'S3 local endpoint (for local development)',
  GEOHASH_PRECISION: 'Geohash precision (default: 7)',
  CORS_ORIGIN: 'CORS origins (comma-separated)',
  OAUTH_CALLBACK_URLS: 'OAuth callback URLs (comma-separated)',
  OAUTH_LOGOUT_URLS: 'OAuth logout URLs (comma-separated)',
};

function validateEnv() {
  const missing = [];
  const warnings = [];
  
  console.log('🔍 Validating environment variables...\n');
  
  // Check required variables
  for (const [key, description] of Object.entries(requiredVars)) {
    if (!process.env[key]) {
      missing.push({ key, description });
    }
  }
  
  // Check optional variables
  for (const [key, description] of Object.entries(optionalVars)) {
    if (!process.env[key]) {
      warnings.push({ key, description });
    }
  }
  
  // Report results
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:\n');
    missing.forEach(({ key, description }) => {
      console.error(`   ${key}: ${description}`);
    });
    console.error('\nPlease set these variables in your .env file or environment.');
    console.error('See .env.example for more details.\n');
    process.exit(1);
  }
  
  if (warnings.length > 0) {
    console.warn('⚠️  Optional environment variables not set:\n');
    warnings.forEach(({ key, description }) => {
      console.warn(`   ${key}: ${description}`);
    });
    console.warn('\nUsing default values where applicable.\n');
  }
  
  // Environment-specific validations
  const nodeEnv = process.env.NODE_ENV;
  const environment = process.env.ENVIRONMENT;
  
  if (nodeEnv === 'production' && environment !== 'prod') {
    console.warn('⚠️  Warning: NODE_ENV is "production" but ENVIRONMENT is not "prod"');
  }
  
  if (environment === 'prod' && process.env.DYNAMODB_ENDPOINT) {
    console.error('❌ Error: DYNAMODB_ENDPOINT should not be set in production!');
    process.exit(1);
  }
  
  if (environment === 'prod' && process.env.S3_LOCAL_ENDPOINT) {
    console.error('❌ Error: S3_LOCAL_ENDPOINT should not be set in production!');
    process.exit(1);
  }
  
  // Validate URLs
  const urlVars = ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_API_URL'];
  for (const key of urlVars) {
    const value = process.env[key];
    if (value) {
      try {
        new URL(value);
      } catch {
        console.error(`❌ Error: ${key} is not a valid URL: ${value}`);
        process.exit(1);
      }
    }
  }
  
  console.log('✅ All required environment variables are set!\n');
  console.log(`📋 Environment: ${environment}`);
  console.log(`🔧 Node Env: ${nodeEnv}`);
  console.log(`🌐 App URL: ${process.env.NEXT_PUBLIC_APP_URL}`);
  console.log(`🔌 API URL: ${process.env.NEXT_PUBLIC_API_URL}\n`);
  
  process.exit(0);
}

validateEnv();
