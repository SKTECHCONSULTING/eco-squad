export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { putItem } from '@/lib/db/dynamodb';
import { User, DynamoDBUserItem } from '@/types';
import { withErrorHandler, ConflictError } from '@/lib/middleware/error-handler';
import { withBodyValidation } from '@/lib/middleware/validation';
import { withCsrfProtection } from '@/lib/middleware/csrf';
import { SignupSchema, SignupInput } from '@/lib/validation/schemas';

// bcrypt salt rounds (10 is recommended for production)
const SALT_ROUNDS = 10;

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'EcoSquadTable';

async function signupHandler(
  request: NextRequest,
  body: SignupInput
): Promise<NextResponse> {
  const { email, password, name } = body;

  // Check if user already exists
  // In a real implementation, you would query DynamoDB to check for existing user
  // For now, we'll create the user

  const userId = uuidv4();
  const now = new Date();

  // Hash password using bcrypt
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user: User = {
    id: userId,
    email,
    name,
    totalImpactPoints: 0,
    squads: [],
    createdAt: now.toISOString(),
  };

  const dynamoItem: DynamoDBUserItem = {
    PK: `USER#${userId}`,
    SK: `METADATA#${userId}`,
    data: user,
    totalImpactPoints: 0,
    createdAt: now.toISOString(),
  };

  // Also store credentials for login (in production, use Cognito or similar)
  const credentialsItem = {
    PK: `CREDENTIALS#${email}`,
    SK: `CREDENTIALS#${email}`,
    userId,
    email,
    password: hashedPassword,
    createdAt: now.toISOString(),
  };

  await putItem(TABLE_NAME, dynamoItem);
  await putItem(TABLE_NAME, credentialsItem);

  return NextResponse.json(
    {
      user,
      message: 'Account created successfully',
    },
    { status: 201 }
  );
}

export const POST = withErrorHandler(
  withCsrfProtection(
    withBodyValidation(SignupSchema, signupHandler)
  )
);
