import { NextRequest } from 'next/server'

// Vercel cron authentication headers
const VERCEL_CRON_HEADERS = {
  'vercel-cron': 'vercel-cron',
  'x-vercel-cron': 'x-vercel-cron'
}

/**
 * Checks if the request is coming from Vercel's cron system
 */
export function isVercelCronRequest(request: NextRequest): boolean {
  // Check for Vercel's cron-specific headers
  for (const [headerName, expectedValue] of Object.entries(VERCEL_CRON_HEADERS)) {
    const headerValue = request.headers.get(headerName)
    if (headerValue === expectedValue) {
      return true
    }
  }
  
  // Check for Vercel's user-agent pattern
  const userAgent = request.headers.get('user-agent')
  if (userAgent && userAgent.includes('vercel-cron')) {
    return true
  }
  
  return false
}

/**
 * Authenticates a cron request using multiple methods:
 * 1. Vercel cron headers (primary method)
 * 2. Bearer token authentication (fallback)
 */
export function isAuthorizedCronRequest(request: NextRequest, cronSecret?: string): boolean {
  // First, check if it's a Vercel cron request
  if (isVercelCronRequest(request)) {
    console.log('Authenticated via Vercel cron headers')
    return true
  }
  
  // Fallback to Bearer token authentication
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader === `Bearer ${cronSecret}`) {
      console.log('Authenticated via Bearer token')
      return true
    }
  }
  
  return false
}

/**
 * Gets the authentication method used for the request
 */
export function getAuthMethod(request: NextRequest, cronSecret?: string): 'vercel-cron' | 'bearer-token' | 'none' {
  if (isVercelCronRequest(request)) {
    return 'vercel-cron'
  }
  
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader === `Bearer ${cronSecret}`) {
      return 'bearer-token'
    }
  }
  
  return 'none'
} 