/**
 * Utilities for managing Supabase real-time subscriptions with debouncing
 * and performance optimizations
 */

import { RealtimeChannel } from '@supabase/supabase-js'

interface DebouncedSubscriptionOptions {
  debounceMs?: number
  maxBatchSize?: number
  onError?: (error: Error) => void
}

/**
 * Creates a debounced handler for real-time updates
 * Batches multiple updates within the debounce window
 */
export function createDebouncedHandler<T>(
  handler: (updates: T[]) => void,
  options: DebouncedSubscriptionOptions = {}
) {
  const { debounceMs = 500, maxBatchSize = 50 } = options
  
  let pendingUpdates: T[] = []
  let debounceTimer: NodeJS.Timeout | null = null
  
  const flushUpdates = () => {
    if (pendingUpdates.length === 0) return
    
    // Process updates in batches if there are too many
    const batches: T[][] = []
    for (let i = 0; i < pendingUpdates.length; i += maxBatchSize) {
      batches.push(pendingUpdates.slice(i, i + maxBatchSize))
    }
    
    // Clear pending updates
    pendingUpdates = []
    
    // Process each batch
    batches.forEach(batch => {
      try {
        handler(batch)
      } catch (error) {
        console.error('Error processing real-time updates:', error)
        options.onError?.(error instanceof Error ? error : new Error('Unknown error'))
      }
    })
  }
  
  const debouncedHandler = (update: T) => {
    pendingUpdates.push(update)
    
    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    
    // Set new timer
    debounceTimer = setTimeout(flushUpdates, debounceMs)
    
    // Flush immediately if we hit the max batch size
    if (pendingUpdates.length >= maxBatchSize) {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
        debounceTimer = null
      }
      flushUpdates()
    }
  }
  
  // Return handler with cleanup function
  return {
    handler: debouncedHandler,
    flush: flushUpdates,
    cleanup: () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
        debounceTimer = null
      }
      flushUpdates()
    }
  }
}

/**
 * Creates a subscription with automatic reconnection and error handling
 */
export function createResilientSubscription(
  channel: RealtimeChannel,
  options: {
    maxRetries?: number
    retryDelay?: number
    onConnect?: () => void
    onDisconnect?: () => void
    onError?: (error: Error) => void
  } = {}
) {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    onConnect,
    onDisconnect,
    onError
  } = options
  
  let retryCount = 0
  let retryTimer: NodeJS.Timeout | null = null
  
  const handleSubscriptionStatus = (status: string) => {
    switch (status) {
      case 'SUBSCRIBED':
        retryCount = 0
        onConnect?.()
        break
        
      case 'CHANNEL_ERROR':
      case 'TIMED_OUT':
        onDisconnect?.()
        
        if (retryCount < maxRetries) {
          retryCount++
          const delay = retryDelay * Math.pow(2, retryCount - 1) // Exponential backoff
          
          console.log(`Subscription error, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`)
          
          retryTimer = setTimeout(() => {
            channel.subscribe()
          }, delay)
        } else {
          const error = new Error(`Subscription failed after ${maxRetries} retries`)
          console.error(error)
          onError?.(error)
        }
        break
        
      case 'CLOSED':
        onDisconnect?.()
        break
    }
  }
  
  // Subscribe and handle status
  channel.subscribe(handleSubscriptionStatus)
  
  // Return cleanup function
  return () => {
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
    channel.unsubscribe()
  }
}

/**
 * Merges updates for the same entity to avoid redundant state updates
 */
export function createUpdateMerger<T extends { id: string }>() {
  const updateMap = new Map<string, T>()
  
  return {
    addUpdate: (update: T) => {
      // Merge with existing update for the same ID
      const existing = updateMap.get(update.id)
      if (existing) {
        updateMap.set(update.id, { ...existing, ...update })
      } else {
        updateMap.set(update.id, update)
      }
    },
    
    getUpdates: (): T[] => {
      const updates = Array.from(updateMap.values())
      updateMap.clear()
      return updates
    },
    
    clear: () => updateMap.clear()
  }
}