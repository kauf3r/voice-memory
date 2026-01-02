/**
 * Cache utilities for Voice Memory
 *
 * Exports:
 * - CacheInvalidationManager: Central manager for cache invalidation
 * - Response cache utilities: HTTP caching helpers
 * - useCacheInvalidation: React hook for cache invalidation
 */

// Cache Invalidation Manager
export {
  CacheInvalidationManager,
  createRealtimeInvalidationCallbacks,
  MutationInvalidators,
  type CacheScope,
  type InvalidationEvent
} from './CacheInvalidationManager'

// Response Cache (HTTP caching)
export {
  CACHE_CONFIGS,
  CACHE_DURATIONS,
  generateETag,
  generateCacheHeaders,
  createCachedResponse,
  addCacheHeaders,
  getCacheKey,
  getCachedProcessedContent,
  checkClientCache,
  checkLastModified,
  shouldCacheData,
  type CacheConfig,
  type CacheableData
} from './response-cache'
