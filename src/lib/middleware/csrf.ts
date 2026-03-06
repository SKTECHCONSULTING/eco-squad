import { NextRequest, NextResponse } from 'next/server';

// CSRF Token configuration
const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';

// Safe methods that don't require CSRF protection
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// Generate a cryptographically secure CSRF token
export function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * CSRF protection middleware
 * Validates CSRF token for state-changing operations (POST, PATCH, DELETE)
 */
export function withCsrfProtection(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    // Skip CSRF check for safe methods
    if (SAFE_METHODS.includes(request.method)) {
      return handler(request, context);
    }

    // Get CSRF token from header
    const csrfHeader = request.headers.get(CSRF_HEADER_NAME);

    // Get CSRF token from cookie
    const csrfCookie = request.cookies.get(CSRF_COOKIE_NAME)?.value;

    // Validate CSRF token
    if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
      return NextResponse.json(
        {
          error: 'CSRF validation failed',
          message: 'Invalid or missing CSRF token. Please refresh the page and try again.',
        },
        { status: 403 }
      );
    }

    return handler(request, context);
  };
}

/**
 * Generate a new CSRF token and set it in a cookie
 * Call this when serving pages that will make state-changing requests
 */
export function setCsrfCookie(response: NextResponse): NextResponse {
  const token = generateCsrfToken();
  
  response.cookies.set({
    name: CSRF_COOKIE_NAME,
    value: token,
    httpOnly: false, // Must be accessible to JavaScript for reading
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });

  return response;
}

/**
 * Get CSRF token from cookie (for API routes to include in responses)
 */
export function getCsrfToken(request: NextRequest): string | undefined {
  return request.cookies.get(CSRF_COOKIE_NAME)?.value;
}

/**
 * Middleware to set CSRF token on GET requests
 * This ensures pages have a CSRF token available for subsequent mutations
 */
export function withCsrfToken(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const response = await handler(request, context);
    
    // Only set CSRF cookie if not already present
    if (!request.cookies.get(CSRF_COOKIE_NAME)) {
      return setCsrfCookie(response);
    }
    
    return response;
  };
}
