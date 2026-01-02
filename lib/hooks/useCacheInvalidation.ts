'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import {
  CacheInvalidationManager,
  CacheScope,
  InvalidationEvent
} from '@/lib/cache/CacheInvalidationManager'

interface UseCacheInvalidationOptions {
  /**
   * Cache scopes to subscribe to
   */
  scopes: CacheScope[]

  /**
   * User ID for scoped invalidation
   */
  userId: string | undefined

  /**
   * Callback when cache is invalidated
   */
  onInvalidate: () => void | Promise<void>

  /**
   * Whether to enable the subscription
   */
  enabled?: boolean

  /**
   * Debounce multiple invalidations (ms)
   */
  debounceMs?: number
}

/**
 * Hook for components to respond to cache invalidation events
 *
 * @example
 * ```tsx
 * const { refresh } = useNotes()
 *
 * useCacheInvalidation({
 *   scopes: ['notes', 'knowledge'],
 *   userId: user?.id,
 *   onInvalidate: refresh,
 *   enabled: !!user
 * })
 * ```
 */
export function useCacheInvalidation({
  scopes,
  userId,
  onInvalidate,
  enabled = true,
  debounceMs = 300
}: UseCacheInvalidationOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastInvalidationRef = useRef<number>(0)
  const [invalidationCount, setInvalidationCount] = useState(0)

  // Stable callback ref to avoid re-subscriptions
  const onInvalidateRef = useRef(onInvalidate)
  useEffect(() => {
    onInvalidateRef.current = onInvalidate
  }, [onInvalidate])

  // Debounced invalidation handler
  const handleInvalidation = useCallback((event: InvalidationEvent) => {
    // Skip if not for this user
    if (userId && event.userId !== userId) {
      return
    }

    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Debounce the invalidation
    timeoutRef.current = setTimeout(() => {
      const now = Date.now()

      // Extra protection against rapid invalidations
      if (now - lastInvalidationRef.current < debounceMs) {
        return
      }
      lastInvalidationRef.current = now

      console.log(`🔄 Cache invalidation triggered for scopes: ${scopes.join(', ')}`)
      setInvalidationCount(prev => prev + 1)

      // Call the refresh callback
      Promise.resolve(onInvalidateRef.current()).catch(error => {
        console.error('Error in cache invalidation callback:', error)
      })
    }, debounceMs)
  }, [userId, scopes, debounceMs])

  useEffect(() => {
    if (!enabled || !userId) {
      return
    }

    // Subscribe to all specified scopes
    const unsubscribes = scopes.map(scope =>
      CacheInvalidationManager.subscribe(scope, handleInvalidation)
    )

    // Cleanup
    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe())
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [scopes, enabled, userId, handleInvalidation])

  // Manual invalidation trigger
  const invalidate = useCallback((scope?: CacheScope) => {
    if (!userId) return

    if (scope) {
      CacheInvalidationManager.invalidate(scope, userId, { reason: 'manual' })
    } else {
      scopes.forEach(s => {
        CacheInvalidationManager.invalidate(s, userId, { reason: 'manual' })
      })
    }
  }, [userId, scopes])

  return {
    /** Manually trigger cache invalidation */
    invalidate,
    /** Number of times cache was invalidated */
    invalidationCount,
    /** Check if a specific cache is stale */
    isStale: useCallback((cachedAt: number, scope?: CacheScope) => {
      if (!userId) return false
      const checkScope = scope || scopes[0]
      return CacheInvalidationManager.isStale(checkScope, userId, cachedAt)
    }, [userId, scopes])
  }
}

/**
 * Hook to get cache invalidation status for debugging
 */
export function useCacheInvalidationDebug() {
  const [history, setHistory] = useState<InvalidationEvent[]>([])

  useEffect(() => {
    const unsubscribe = CacheInvalidationManager.subscribe('all', () => {
      setHistory(CacheInvalidationManager.getHistory())
    })

    // Initial load
    setHistory(CacheInvalidationManager.getHistory())

    return unsubscribe
  }, [])

  return { history }
}
