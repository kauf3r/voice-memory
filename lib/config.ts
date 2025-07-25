/**
 * Configuration utility for environment-based URL management
 */

export interface Config {
  baseUrl: string;
  apiUrl: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

function getBaseUrl(): string {
  // In browser environment
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // Server-side environment variables (in order of preference)
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }

  // Default fallback for development
  return process.env.NODE_ENV === 'production' 
    ? 'https://voice-memory-tau.vercel.app' 
    : 'http://localhost:3000';
}

function createConfig(): Config {
  const baseUrl = getBaseUrl();
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    baseUrl,
    apiUrl: `${baseUrl}/api`,
    isDevelopment,
    isProduction,
  };
}

export const config = createConfig();

// Convenience functions
export const getApiUrl = (path: string = ''): string => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${config.apiUrl}${cleanPath}`;
};

export const getBaseUrl = (): string => config.baseUrl;