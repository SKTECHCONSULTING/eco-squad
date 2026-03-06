import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema, ZodError } from 'zod';

/**
 * Validate request body against Zod schema
 */
export async function validateBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<T> {
  try {
    const body = await request.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw error; // Let error handler format it
    }
    throw new Error('Invalid JSON in request body');
  }
}

/**
 * Validate query parameters against Zod schema
 */
export function validateQuery<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): T {
  const searchParams = request.nextUrl.searchParams;
  const params: Record<string, any> = {};

  // Convert search params to object
  searchParams.forEach((value, key) => {
    // Handle arrays
    if (params[key]) {
      if (Array.isArray(params[key])) {
        params[key].push(value);
      } else {
        params[key] = [params[key], value];
      }
    } else {
      params[key] = value;
    }
  });

  try {
    return schema.parse(params) as T;
  } catch (error) {
    if (error instanceof ZodError) {
      throw error;
    }
    throw new Error('Invalid query parameters');
  }
}

/**
 * Validate URL parameters against Zod schema
 */
export function validateParams<T>(
  params: Record<string, string> | { id: string },
  schema: ZodSchema<T>
): T {
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof ZodError) {
      throw error;
    }
    throw new Error('Invalid URL parameters');
  }
}

/**
 * Middleware to validate request body
 */
export function withBodyValidation<T>(
  schema: ZodSchema<T>,
  handler: (request: NextRequest, body: T, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const body = await validateBody(request, schema);
    return handler(request, body, context);
  };
}

/**
 * Middleware to validate query parameters
 */
export function withQueryValidation<T>(
  schema: ZodSchema<T>,
  handler: (request: NextRequest, query: T, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const query = schema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    return handler(request, query as T, context);
  };
}

/**
 * Middleware to validate URL parameters
 */
export function withParamsValidation<T>(
  schema: ZodSchema<T>,
  handler: (request: NextRequest, params: T, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    // URL params are passed in context.params in Next.js App Router
    const params = context?.params || {};
    const validatedParams = validateParams(params, schema);
    return handler(request, validatedParams, context);
  };
}

/**
 * Combined validation middleware for body and params
 */
export function withValidation<TBody, TParams>(
  bodySchema: ZodSchema<TBody>,
  paramsSchema: ZodSchema<TParams>,
  handler: (
    request: NextRequest,
    body: TBody,
    params: TParams,
    context?: any
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const body = await validateBody(request, bodySchema);
    const params = validateParams(context?.params || {}, paramsSchema);
    return handler(request, body, params, context);
  };
}

/**
 * Sanitize string input
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Basic XSS prevention
    .slice(0, 10000); // Max length limit
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === 'string' ? sanitizeString(item) : item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}
