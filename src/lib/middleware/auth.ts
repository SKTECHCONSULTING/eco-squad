import { NextRequest, NextResponse } from 'next/server';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { CognitoAccessTokenPayload } from 'aws-jwt-verify/jwt-model';

// Cognito configuration
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || '';
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID || '';

// JWT Verifier singleton
let jwtVerifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function getJwtVerifier() {
  if (!jwtVerifier) {
    jwtVerifier = CognitoJwtVerifier.create({
      userPoolId: COGNITO_USER_POOL_ID,
      tokenUse: 'access',
      clientId: COGNITO_CLIENT_ID,
    });
  }
  return jwtVerifier;
}

// Authenticated user type
export interface AuthenticatedUser {
  userId: string;
  email: string;
  groups: string[];
  token: string;
}

/**
 * Extract token from Authorization header
 */
function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1];
  }

  return null;
}

/**
 * Verify JWT token and return user info
 */
export async function verifyToken(
  token: string
): Promise<AuthenticatedUser | null> {
  try {
    const verifier = getJwtVerifier();
    const payload = await verifier.verify(token);

    return {
      userId: payload.sub,
      email: String(payload.email || payload.username || ''),
      groups: (payload['cognito:groups'] as string[]) || [],
      token,
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Get authenticated user from request
 */
export async function getAuthUser(
  request: NextRequest
): Promise<AuthenticatedUser | null> {
  const token = extractToken(request);
  if (!token) return null;

  return verifyToken(token);
}

/**
 * Require authentication middleware
 */
export function requireAuth(
  handler: (
    request: NextRequest,
    user: AuthenticatedUser,
    context?: any
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid authentication token required.' },
        { status: 401 }
      );
    }

    // Add user to request for downstream use
    (request as any).user = user;

    return handler(request, user, context);
  };
}

/**
 * Require specific role/group membership
 */
export function requireRole(
  allowedRoles: string[],
  handler: (
    request: NextRequest,
    user: AuthenticatedUser,
    context?: any
  ) => Promise<NextResponse>
) {
  return requireAuth(async (request, user, context) => {
    const hasRole = user.groups.some((group) => allowedRoles.includes(group));

    if (!hasRole) {
      return NextResponse.json(
        {
          error: 'Forbidden. Insufficient permissions.',
          required: allowedRoles,
        },
        { status: 403 }
      );
    }

    return handler(request, user, context);
  });
}

/**
 * Optional authentication - attaches user if available but doesn't require it
 */
export function optionalAuth(
  handler: (
    request: NextRequest,
    user: AuthenticatedUser | null,
    context?: any
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const user = await getAuthUser(request);
    (request as any).user = user;

    return handler(request, user, context);
  };
}

/**
 * Check if user is admin
 */
export function isAdmin(user: AuthenticatedUser): boolean {
  return user.groups.includes('admin') || user.groups.includes('Admin');
}

/**
 * Check if user is organization member
 */
export function isOrganization(user: AuthenticatedUser): boolean {
  return (
    user.groups.includes('organization') || user.groups.includes('Organization')
  );
}

/**
 * Middleware to check if user can create missions
 */
export function requireMissionCreator(
  handler: (
    request: NextRequest,
    user: AuthenticatedUser,
    context?: any
  ) => Promise<NextResponse>
) {
  return requireAuth(async (request, user, context) => {
    const canCreate = isAdmin(user) || isOrganization(user);

    if (!canCreate) {
      return NextResponse.json(
        {
          error: 'Forbidden. Only admins and organizations can create missions.',
        },
        { status: 403 }
      );
    }

    return handler(request, user, context);
  });
}
