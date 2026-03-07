/**
 * Utility function to get the appropriate API URL based on environment
 */
export function getApiUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  
  if (envUrl) {
    return envUrl;
  }
  
  // Fallback based on environment
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_API_URL must be set in production');
  }
  
  return 'http://localhost:3001';
}

/**
 * Utility function to get the app URL based on environment
 */
export function getAppUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  
  if (envUrl) {
    return envUrl;
  }
  
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_APP_URL must be set in production');
  }
  
  return 'http://localhost:3000';
}
