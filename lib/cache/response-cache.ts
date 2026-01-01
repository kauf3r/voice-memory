/**
 * Response Caching Utilities for Voice Memory APIs
 * 
 * Provides HTTP cache headers and ETag-based caching for processed content APIs
 * to improve performance and reduce database load.
 */

import { NextResponse } from 'next/server'
import { createHash } from 'crypto'

export interface CacheConfig {
  maxAge: number // Cache duration in seconds
  staleWhileRevalidate?: number // SWR duration in seconds
  mustRevalidate?: boolean // Force revalidation
  private?: boolean // Private vs public cache
  etag?: boolean // Enable ETag generation
}

export interface CacheableData {
  data: any
  lastModified?: string | Date
  version?: string
}

/**
 * Default cache configurations for different API types
 */
export const CACHE_CONFIGS = {
  // Processed content that changes infrequently
  KNOWLEDGE: {
    maxAge: 300, // 5 minutes
    staleWhileRevalidate: 600, // 10 minutes SWR
    etag: true,
    private: true
  },
  
  // User notes that may be updated
  NOTES: {
    maxAge: 120, // 2 minutes
    staleWhileRevalidate: 300, // 5 minutes SWR
    etag: true,
    private: true
  },
  
  // Search results
  SEARCH: {
    maxAge: 180, // 3 minutes
    staleWhileRevalidate: 360, // 6 minutes SWR
    etag: true,
    private: true
  },
  
  // Task data
  TASKS: {
    maxAge: 60, // 1 minute
    staleWhileRevalidate: 180, // 3 minutes SWR
    etag: true,
    private: true
  },
  
  // Exported data
  EXPORTS: {
    maxAge: 900, // 15 minutes
    staleWhileRevalidate: 1800, // 30 minutes SWR
    etag: true,
    private: true
  }
} as const

/**
 * Generate ETag from data content
 */
export function generateETag(data: any): string {
  const content = typeof data === 'string' ? data : JSON.stringify(data)
  return `"${createHash('md5').update(content).digest('hex')}"`
}

/**
 * Generate cache headers based on configuration
 */
export function generateCacheHeaders(config: CacheConfig): Record<string, string> {
  const headers: Record<string, string> = {}
  
  // Cache-Control header
  const cacheDirectives: string[] = []
  
  if (config.private) {
    cacheDirectives.push('private')
  } else {
    cacheDirectives.push('public')
  }
  
  if (config.maxAge > 0) {
    cacheDirectives.push(`max-age=${config.maxAge}`)
  }
  
  if (config.staleWhileRevalidate) {
    cacheDirectives.push(`stale-while-revalidate=${config.staleWhileRevalidate}`)
  }
  
  if (config.mustRevalidate) {
    cacheDirectives.push('must-revalidate')
  }
  
  headers['Cache-Control'] = cacheDirectives.join(', ')
  
  // Vary header for conditional requests
  headers['Vary'] = 'Authorization, Accept-Encoding'
  
  return headers
}

/**
 * Check if client has fresh cached version using ETag
 */
export function checkClientCache(
  requestHeaders: Headers,
  etag: string
): boolean {
  const ifNoneMatch = requestHeaders.get('if-none-match')
  return ifNoneMatch === etag
}

/**
 * Check if client cache is stale using Last-Modified
 */
export function checkLastModified(
  requestHeaders: Headers,
  lastModified: Date
): boolean {
  const ifModifiedSince = requestHeaders.get('if-modified-since')
  if (!ifModifiedSince) {
    return false
  }
  
  const clientDate = new Date(ifModifiedSince)
  return clientDate >= lastModified
}

/**
 * Create cached response with appropriate headers
 */
export function createCachedResponse(
  data: CacheableData,
  config: CacheConfig,
  requestHeaders?: Headers
): NextResponse {
  const { data: responseData, lastModified, version } = data
  
  // Generate ETag if enabled
  let etag: string | undefined
  if (config.etag) {
    etag = generateETag({ data: responseData, version, lastModified })
  }
  
  // Check if client has fresh cache
  if (requestHeaders && etag && checkClientCache(requestHeaders, etag)) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ...generateCacheHeaders(config),
        'ETag': etag
      }
    })
  }
  
  // Check Last-Modified
  const lastModifiedDate = lastModified ? new Date(lastModified) : new Date()
  if (requestHeaders && checkLastModified(requestHeaders, lastModifiedDate)) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ...generateCacheHeaders(config),
        'Last-Modified': lastModifiedDate.toUTCString(),
        ...(etag && { 'ETag': etag })
      }
    })
  }
  
  // Generate fresh response with cache headers
  const headers = {
    ...generateCacheHeaders(config),
    'Last-Modified': lastModifiedDate.toUTCString(),
    'Content-Type': 'application/json',
    ...(etag && { 'ETag': etag })
  }
  
  return NextResponse.json(responseData, { headers })
}

/**
 * Middleware to add cache headers to existing responses
 */
export function addCacheHeaders(
  response: NextResponse,
  config: CacheConfig,
  etag?: string
): NextResponse {
  const cacheHeaders = generateCacheHeaders(config)
  
  Object.entries(cacheHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  
  if (etag) {
    response.headers.set('ETag', etag)
  }
  
  response.headers.set('Last-Modified', new Date().toUTCString())
  
  return response
}

/**
 * Helper to get cache key for API responses
 */
export function getCacheKey(
  userId: string,
  endpoint: string,
  params?: Record<string, any>
): string {
  const baseKey = `api:${endpoint}:${userId}`
  
  if (!params || Object.keys(params).length === 0) {
    return baseKey
  }
  
  // Sort params for consistent cache keys
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&')
  
  return `${baseKey}:${createHash('md5').update(sortedParams).digest('hex')}`
}

/**
 * Cache duration helpers
 */
export const CACHE_DURATIONS = {
  SECONDS: (s: number) => s,
  MINUTES: (m: number) => m * 60,
  HOURS: (h: number) => h * 60 * 60,
  DAYS: (d: number) => d * 24 * 60 * 60
} as const

/**
 * Check if data should be cached based on freshness
 */
export function shouldCacheData(
  lastModified: Date,
  maxAge: number = 300
): boolean {
  const now = new Date()
  const ageInSeconds = (now.getTime() - lastModified.getTime()) / 1000
  return ageInSeconds < maxAge
}

/**
 * Get cache-friendly response for processed content
 */
export function getCachedProcessedContent(
  content: any,
  processedAt: string | Date,
  config: CacheConfig = CACHE_CONFIGS.KNOWLEDGE,
  requestHeaders?: Headers
): NextResponse {
  return createCachedResponse(
    {
      data: content,
      lastModified: processedAt,
      version: '1.0'
    },
    config,
    requestHeaders
  )
}