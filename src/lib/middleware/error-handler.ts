import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

// Custom API Error class
export class APIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// Specific error types
export class ValidationError extends APIError {
  constructor(message: string, details?: Record<string, any>) {
    super(400, message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends APIError {
  constructor(resource: string, id?: string) {
    super(404, `${resource} not found${id ? `: ${id}` : ''}`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends APIError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class UnauthorizedError extends APIError {
  constructor(message: string = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends APIError {
  constructor(message: string = 'Forbidden') {
    super(403, message, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class RateLimitError extends APIError {
  constructor(retryAfter: number) {
    super(429, 'Too many requests', 'RATE_LIMITED', { retryAfter });
    this.name = 'RateLimitError';
  }
}

// Error response shape
interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    details?: Record<string, any>;
  };
  requestId?: string;
}

/**
 * Format Zod validation errors
 */
function formatZodError(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(err.message);
  });

  return formatted;
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  error: Error,
  requestId?: string
): NextResponse<ErrorResponse> {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details: Record<string, any> | undefined;

  if (error instanceof APIError) {
    statusCode = error.statusCode;
    code = error.code || 'API_ERROR';
    message = error.message;
    details = error.details;
  } else if (error instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = { fields: formatZodError(error) };
  } else if (error.name === 'ConditionalCheckFailedException') {
    statusCode = 409;
    code = 'CONDITION_FAILED';
    message = 'The operation could not be completed due to a conflict';
  } else if (error.name === 'ResourceNotFoundException') {
    statusCode = 404;
    code = 'RESOURCE_NOT_FOUND';
    message = error.message || 'Resource not found';
  }

  // Log error for debugging (don't log in production for 4xx errors)
  if (statusCode >= 500) {
    console.error('API Error:', {
      statusCode,
      code,
      message,
      stack: error.stack,
      requestId,
    });
  }

  const response: ErrorResponse = {
    error: {
      message,
      ...(code && { code }),
      ...(details && { details }),
    },
    ...(requestId && { requestId }),
  };

  return NextResponse.json(response, { status: statusCode });
}

/**
 * Wrap API handler with error handling
 */
export function withErrorHandler(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const requestId = crypto.randomUUID();

    try {
      const response = await handler(request, context);
      
      // Add request ID to successful responses
      response.headers.set('X-Request-ID', requestId);
      return response;
    } catch (error) {
      return createErrorResponse(error as Error, requestId);
    }
  };
}

/**
 * Global error handler for unexpected errors
 */
export function handleUnexpectedError(error: unknown): NextResponse {
  console.error('Unexpected error:', error);

  return NextResponse.json(
    {
      error: {
        message: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
      },
    },
    { status: 500 }
  );
}
