import { NextRequest, NextResponse } from 'next/server';

/**
 * INFRA LIMITATION NOTICE (BROKEN-ACCESS-01):
 * This implementation uses an in-memory Map for rate limiting, which has the
 * following limitations in a serverless/multi-instance deployment:
 * 
 * 1. Rate limits are not shared across Lambda/container instances
 * 2. Each instance maintains its own independent counter
 * 3. Restarts/cold starts reset the rate limit counters
 * 
 * FOR PRODUCTION: Migrate to Redis (ElastiCache) or AWS API Gateway throttling
 * for consistent, distributed rate limiting across all instances.
 * 
 * Current implementation provides basic protection per-instance but is not
 * suitable for high-security rate limiting requirements.
 */

// In-memory rate limiting store (use Redis in production)
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Rate limit configurations
export const RATE_LIMITS = {
  // Default: 100 requests per minute
  default: { maxRequests: 100, windowMs: 60 * 1000 },
  
  // Mission claim: 10 per minute per squad
  missionClaim: { maxRequests: 10, windowMs: 60 * 1000 },
  
  // Evidence submission: 20 per hour per user
  evidenceSubmit: { maxRequests: 20, windowMs: 60 * 60 * 1000 },
  
  // Squad creation: 5 per hour per user
  squadCreate: { maxRequests: 5, windowMs: 60 * 60 * 1000 },
  
  // Authentication: 5 per minute per IP
  auth: { maxRequests: 5, windowMs: 60 * 1000 },
};

export type RateLimitType = keyof typeof RATE_LIMITS;

/**
 * Generate a rate limit key from request
 */
function getRateLimitKey(
  request: NextRequest,
  identifier: string,
  type: RateLimitType
): string {
  // Use user ID if authenticated, otherwise IP
  const clientId = identifier || request.ip || 'anonymous';
  return `ratelimit:${type}:${clientId}`;
}

/**
 * Check if request is rate limited
 */
export function checkRateLimit(
  request: NextRequest,
  type: RateLimitType = 'default',
  identifier?: string
): { allowed: boolean; remaining: number; resetTime: number } {
  const config = RATE_LIMITS[type];
  const key = getRateLimitKey(request, identifier || '', type);
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  // Reset if window has passed
  if (!entry || now > entry.resetTime) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(key, newEntry);
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: newEntry.resetTime,
    };
  }

  // Check limit
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(key, entry);

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Rate limiting middleware for API routes
 */
export function withRateLimit(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>,
  type: RateLimitType = 'default',
  getIdentifier?: (request: NextRequest) => string | undefined
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const identifier = getIdentifier?.(request);
    const rateLimit = checkRateLimit(request, type, identifier);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(RATE_LIMITS[type].maxRequests),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetTime / 1000)),
            'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)),
          },
        }
      );
    }

    const response = await handler(request, context);

    // Add rate limit headers to response
    response.headers.set('X-RateLimit-Limit', String(RATE_LIMITS[type].maxRequests));
    response.headers.set('X-RateLimit-Remaining', String(rateLimit.remaining));
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(rateLimit.resetTime / 1000)));

    return response;
  };
}

/**
 * Create a rate limited response
 */
export function createRateLimitResponse(
  retryAfterSeconds: number
): NextResponse {
  return NextResponse.json(
    {
      error: 'Too many requests',
      message: `Please try again in ${retryAfterSeconds} seconds`,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
      },
    }
  );
}

// Cleanup old entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  rateLimitStore.forEach((entry, key) => {
    if (now > entry.resetTime) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => rateLimitStore.delete(key));
}, 5 * 60 * 1000);
