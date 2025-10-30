/**
 * Cache Manager for Knowledge Service
 * Handles response caching logic
 */

import { NextResponse } from 'next/server'
import { getCachedProcessedContent, CACHE_CONFIGS } from '../cache/response-cache'
import { ProcessedNote } from './KnowledgeTypes'

export class CacheManager {
  /**
   * Create cached response for knowledge data
   */
  static createCachedResponse(
    content: any,
    notes: ProcessedNote[],
    requestHeaders?: Headers
  ): NextResponse {
    // Determine last modified date for caching
    const lastModified = this.calculateLastModified(notes)
    
    // Return cached response with appropriate headers
    return getCachedProcessedContent(
      content,
      new Date(lastModified),
      CACHE_CONFIGS.KNOWLEDGE,
      requestHeaders
    )
  }

  /**
   * Calculate last modified timestamp for caching
   */
  private static calculateLastModified(notes: ProcessedNote[]): number {
    if (!notes || notes.length === 0) {
      return Date.now()
    }

    return Math.max(
      ...notes
        .filter(n => n.processed_at)
        .map(n => new Date(n.processed_at!).getTime())
    )
  }

  /**
   * Generate cache key for knowledge data
   */
  static generateCacheKey(userId: string, options: Record<string, any> = {}): string {
    const baseKey = `knowledge:${userId}`
    
    if (Object.keys(options).length === 0) {
      return baseKey
    }

    const optionsKey = Object.entries(options)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join('|')

    return `${baseKey}:${optionsKey}`
  }

  /**
   * Check if cache should be invalidated
   */
  static shouldInvalidateCache(
    lastCacheTime: Date,
    lastDataUpdate: Date,
    maxAge: number = 300 // 5 minutes default
  ): boolean {
    const now = new Date()
    const cacheAge = (now.getTime() - lastCacheTime.getTime()) / 1000
    const dataIsNewer = lastDataUpdate > lastCacheTime

    return cacheAge > maxAge || dataIsNewer
  }

  /**
   * Create cache headers for manual cache control
   */
  static createCacheHeaders(maxAge: number = 300): Record<string, string> {
    return {
      'Cache-Control': `private, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
      'Vary': 'Authorization',
      'Last-Modified': new Date().toUTCString()
    }
  }
}