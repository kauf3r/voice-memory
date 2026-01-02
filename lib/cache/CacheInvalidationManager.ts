/**
 * Cache Invalidation Manager for Real-Time App
 *
 * Provides centralized cache invalidation that coordinates with:
 * - Supabase realtime subscriptions
 * - Polling fallback updates
 * - Manual user actions
 *
 * Design principles:
 * - Event-driven invalidation (not time-based expiration alone)
 * - Scoped invalidation (user-specific, resource-specific)
 * - Integration with existing realtime callbacks
 */

export type CacheScope =
  | 'notes'
  | 'tasks'
  | 'knowledge'
  | 'search'
  | 'pins'
  | 'all'

export type InvalidationEvent = {
  scope: CacheScope
  userId: string
  resourceId?: string
  reason: 'realtime' | 'polling' | 'mutation' | 'manual'
  timestamp: number
}

type InvalidationListener = (event: InvalidationEvent) => void

/**
 * Central manager for coordinating cache invalidation across the app
 */
class CacheInvalidationManagerClass {
  private listeners: Map<CacheScope, Set<InvalidationListener>> = new Map()
  private lastInvalidation: Map<string, number> = new Map()
  private invalidationHistory: InvalidationEvent[] = []
  private readonly maxHistorySize = 100
  private readonly debounceMs = 100

  constructor() {
    // Initialize listener sets for each scope
    const scopes: CacheScope[] = ['notes', 'tasks', 'knowledge', 'search', 'pins', 'all']
    scopes.forEach(scope => {
      this.listeners.set(scope, new Set())
    })
  }

  /**
   * Subscribe to invalidation events for a specific scope
   */
  subscribe(scope: CacheScope, listener: InvalidationListener): () => void {
    const scopeListeners = this.listeners.get(scope)
    if (scopeListeners) {
      scopeListeners.add(listener)
    }

    // Return unsubscribe function
    return () => {
      scopeListeners?.delete(listener)
    }
  }

  /**
   * Invalidate cache for a specific scope and user
   */
  invalidate(
    scope: CacheScope,
    userId: string,
    options: {
      resourceId?: string
      reason?: InvalidationEvent['reason']
    } = {}
  ): void {
    const { resourceId, reason = 'manual' } = options
    const cacheKey = this.getCacheKey(scope, userId, resourceId)
    const now = Date.now()

    // Debounce rapid invalidations for the same cache key
    const lastTime = this.lastInvalidation.get(cacheKey)
    if (lastTime && now - lastTime < this.debounceMs) {
      return
    }
    this.lastInvalidation.set(cacheKey, now)

    const event: InvalidationEvent = {
      scope,
      userId,
      resourceId,
      reason,
      timestamp: now
    }

    // Record in history
    this.addToHistory(event)

    // Notify scope-specific listeners
    this.notifyListeners(scope, event)

    // Also notify 'all' listeners
    if (scope !== 'all') {
      this.notifyListeners('all', event)
    }

    console.log(`🔄 Cache invalidated: ${scope}${resourceId ? `:${resourceId}` : ''} for user ${userId.slice(0, 8)}... (${reason})`)
  }

  /**
   * Invalidate multiple scopes at once (e.g., after a bulk operation)
   */
  invalidateMultiple(
    scopes: CacheScope[],
    userId: string,
    reason: InvalidationEvent['reason'] = 'mutation'
  ): void {
    scopes.forEach(scope => {
      this.invalidate(scope, userId, { reason })
    })
  }

  /**
   * Invalidate all caches for a user (e.g., after logout or major sync)
   */
  invalidateAll(userId: string, reason: InvalidationEvent['reason'] = 'manual'): void {
    this.invalidate('all', userId, { reason })
  }

  /**
   * Get the last invalidation time for a specific cache
   */
  getLastInvalidation(scope: CacheScope, userId: string, resourceId?: string): number | undefined {
    const cacheKey = this.getCacheKey(scope, userId, resourceId)
    return this.lastInvalidation.get(cacheKey)
  }

  /**
   * Check if cache is stale based on last invalidation
   */
  isStale(
    scope: CacheScope,
    userId: string,
    cachedAt: number,
    resourceId?: string
  ): boolean {
    const lastInvalidation = this.getLastInvalidation(scope, userId, resourceId)
    if (!lastInvalidation) {
      return false // No invalidation recorded, cache is fresh
    }
    return lastInvalidation > cachedAt
  }

  /**
   * Get recent invalidation history (useful for debugging)
   */
  getHistory(limit = 20): InvalidationEvent[] {
    return this.invalidationHistory.slice(-limit)
  }

  /**
   * Clear all state (useful for testing or logout)
   */
  reset(): void {
    this.lastInvalidation.clear()
    this.invalidationHistory = []
  }

  private getCacheKey(scope: CacheScope, userId: string, resourceId?: string): string {
    return resourceId
      ? `${scope}:${userId}:${resourceId}`
      : `${scope}:${userId}`
  }

  private notifyListeners(scope: CacheScope, event: InvalidationEvent): void {
    const scopeListeners = this.listeners.get(scope)
    if (scopeListeners) {
      scopeListeners.forEach(listener => {
        try {
          listener(event)
        } catch (error) {
          console.error('Error in cache invalidation listener:', error)
        }
      })
    }
  }

  private addToHistory(event: InvalidationEvent): void {
    this.invalidationHistory.push(event)

    // Trim history if too large
    if (this.invalidationHistory.length > this.maxHistorySize) {
      this.invalidationHistory = this.invalidationHistory.slice(-this.maxHistorySize)
    }
  }
}

// Singleton instance
export const CacheInvalidationManager = new CacheInvalidationManagerClass()

/**
 * Helper to create realtime-aware invalidation callbacks
 * Use this to integrate with RealtimeManager/PollingManager
 */
export function createRealtimeInvalidationCallbacks(userId: string) {
  return {
    onTaskPinned: (taskId: string) => {
      CacheInvalidationManager.invalidate('pins', userId, {
        resourceId: taskId,
        reason: 'realtime'
      })
      CacheInvalidationManager.invalidate('tasks', userId, { reason: 'realtime' })
    },

    onTaskUnpinned: (taskId: string) => {
      CacheInvalidationManager.invalidate('pins', userId, {
        resourceId: taskId,
        reason: 'realtime'
      })
      CacheInvalidationManager.invalidate('tasks', userId, { reason: 'realtime' })
    },

    onPinUpdated: () => {
      CacheInvalidationManager.invalidate('pins', userId, { reason: 'realtime' })
      CacheInvalidationManager.invalidate('tasks', userId, { reason: 'realtime' })
    },

    onNoteProcessed: (noteId: string) => {
      CacheInvalidationManager.invalidate('notes', userId, {
        resourceId: noteId,
        reason: 'realtime'
      })
      // Knowledge and search depend on notes
      CacheInvalidationManager.invalidate('knowledge', userId, { reason: 'realtime' })
      CacheInvalidationManager.invalidate('search', userId, { reason: 'realtime' })
    },

    onNoteDeleted: (noteId: string) => {
      CacheInvalidationManager.invalidate('notes', userId, {
        resourceId: noteId,
        reason: 'realtime'
      })
      CacheInvalidationManager.invalidate('knowledge', userId, { reason: 'realtime' })
      CacheInvalidationManager.invalidate('search', userId, { reason: 'realtime' })
      CacheInvalidationManager.invalidate('tasks', userId, { reason: 'realtime' })
    }
  }
}

/**
 * Helper to invalidate caches after mutations
 */
export const MutationInvalidators = {
  afterNoteUpload: (userId: string) => {
    CacheInvalidationManager.invalidateMultiple(
      ['notes', 'knowledge', 'search'],
      userId,
      'mutation'
    )
  },

  afterNoteDelete: (userId: string, noteId: string) => {
    CacheInvalidationManager.invalidate('notes', userId, {
      resourceId: noteId,
      reason: 'mutation'
    })
    CacheInvalidationManager.invalidateMultiple(
      ['knowledge', 'search', 'tasks'],
      userId,
      'mutation'
    )
  },

  afterTaskUpdate: (userId: string, taskId?: string) => {
    CacheInvalidationManager.invalidate('tasks', userId, {
      resourceId: taskId,
      reason: 'mutation'
    })
  },

  afterPinChange: (userId: string) => {
    CacheInvalidationManager.invalidateMultiple(
      ['pins', 'tasks'],
      userId,
      'mutation'
    )
  },

  afterBulkOperation: (userId: string) => {
    CacheInvalidationManager.invalidateAll(userId, 'mutation')
  }
}
