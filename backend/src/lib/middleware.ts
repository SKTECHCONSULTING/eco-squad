import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { CognitoUser, ApiResponse } from '../types';

// Custom Error Classes
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string = 'ERROR'
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(404, `${resource} not found: ${id}`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(403, message, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

// CORS Headers
export const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
};

// Success Response Builder
export function successResponse(data: any, statusCode: number = 200): ApiResponse {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(data),
  };
}

// Error Response Builder
export function errorResponse(error: Error | AppError): ApiResponse {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error.code,
        message: error.message,
      }),
    };
  }

  // Log unexpected errors
  console.error('Unexpected error:', error);

  return {
    statusCode: 500,
    headers: corsHeaders,
    body: JSON.stringify({
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    }),
  };
}

// Extract user from Cognito authorizer
export function getAuthenticatedUser(event: APIGatewayProxyEvent): CognitoUser | null {
  const claims = event.requestContext.authorizer?.claims;
  if (!claims) return null;

  const groups = claims['cognito:groups'];
  return {
    userId: claims.sub,
    email: claims.email,
    name: claims.name,
    groups: groups ? (typeof groups === 'string' ? groups.split(',') : groups) : [],
  };
}

// Require authentication middleware
export function requireAuth<T>(
  handler: (event: APIGatewayProxyEvent, user: CognitoUser, context: Context) => Promise<T>
): (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult> {
  return async (event: APIGatewayProxyEvent, context: Context) => {
    const user = getAuthenticatedUser(event);
    if (!user) {
      return errorResponse(new UnauthorizedError());
    }
    try {
      const result = await handler(event, user, context);
      return successResponse(result);
    } catch (error) {
      return errorResponse(error as Error);
    }
  };
}

// Optional auth middleware
export function optionalAuth<T>(
  handler: (event: APIGatewayProxyEvent, user: CognitoUser | null, context: Context) => Promise<T>
): (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult> {
  return async (event: APIGatewayProxyEvent, context: Context) => {
    const user = getAuthenticatedUser(event);
    try {
      const result = await handler(event, user, context);
      return successResponse(result);
    } catch (error) {
      return errorResponse(error as Error);
    }
  };
}

// Parse JSON body safely
export function parseBody<T>(event: APIGatewayProxyEvent): T | null {
  if (!event.body) return null;
  try {
    return JSON.parse(event.body) as T;
  } catch {
    throw new ValidationError('Invalid JSON in request body');
  }
}

// Parse query parameters
export function getQueryParams(event: APIGatewayProxyEvent): Record<string, string> {
  return event.queryStringParameters || {};
}

// Parse path parameters
export function getPathParams(event: APIGatewayProxyEvent): Record<string, string> {
  return event.pathParameters || {};
}

// Check if user is admin
export function isAdmin(user: CognitoUser): boolean {
  return user.groups.includes('Admins');
}

// Check if user is organization
export function isOrganization(user: CognitoUser): boolean {
  return user.groups.includes('Organizations');
}

// Require specific role
export function requireRole(user: CognitoUser, roles: string[]): void {
  const hasRole = roles.some(role => user.groups.includes(role));
  if (!hasRole) {
    throw new ForbiddenError('Insufficient permissions');
  }
}
