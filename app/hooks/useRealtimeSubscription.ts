'use client'

import { useEffect, useRef } from 'react'
import { RealtimeManager, type RealtimeCallbacks } from '@/app/services/RealtimeManager'
import type { ConnectionStatus } from './useConnectionStatus'
import { createRealtimeInvalidationCallbacks } from '@/lib/cache/CacheInvalidationManager'

interface UseRealtimeSubscriptionProps {
  user: any
  setPinnedTaskIds: React.Dispatch<React.SetStateAction<string[]>>
  updateConnectionStatus: (status: ConnectionStatus) => void
  setError: (error: string) => void
  updateSyncTime: () => void
  showToast: (message: string, type: 'success' | 'info' | 'error') => void
  refreshPinnedTasks: () => Promise<void>
}

export function useRealtimeSubscription({
  user,
  setPinnedTaskIds,
  updateConnectionStatus,
  setError,
  updateSyncTime,
  showToast,
  refreshPinnedTasks
}: UseRealtimeSubscriptionProps) {
  const realtimeManagerRef = useRef<RealtimeManager | null>(null)

  useEffect(() => {
    // Early return if no user
    if (!user) {
      updateConnectionStatus('disconnected')
      return
    }

    // Get cache invalidation callbacks for this user
    const cacheInvalidation = createRealtimeInvalidationCallbacks(user.id)

    const callbacks: RealtimeCallbacks = {
      onConnectionStatusChange: updateConnectionStatus,
      onError: setError,
      onSyncTimeUpdate: updateSyncTime,
      onTaskPinned: (taskId: string) => {
        // Update local state
        setPinnedTaskIds(prev => {
          if (!prev.includes(taskId)) {
            return [...prev, taskId]
          }
          return prev
        })
        // Invalidate relevant caches
        cacheInvalidation.onTaskPinned(taskId)
      },
      onTaskUnpinned: (taskId: string) => {
        // Update local state
        setPinnedTaskIds(prev => prev.filter(id => id !== taskId))
        // Invalidate relevant caches
        cacheInvalidation.onTaskUnpinned(taskId)
      },
      onPinUpdated: () => {
        // Debounced refresh for order changes
        setTimeout(() => refreshPinnedTasks(), 500)
        // Invalidate relevant caches
        cacheInvalidation.onPinUpdated()
      },
      onToast: showToast
    }

    // Create and start realtime manager with enhanced configuration
    const realtimeManager = new RealtimeManager(
      { 
        userId: user.id,
        maxReconnectAttempts: 5,
        baseRetryDelay: 1000,
        circuitBreakerThreshold: 3,
        healthCheckInterval: 30000 // 30 seconds
      },
      callbacks
    )

    realtimeManagerRef.current = realtimeManager
    realtimeManager.start()

    // Cleanup on unmount or user change
    return () => {
      realtimeManager.stop()
      realtimeManagerRef.current = null
    }
  }, [
    user, 
    setPinnedTaskIds, 
    updateConnectionStatus, 
    setError, 
    updateSyncTime, 
    showToast, 
    refreshPinnedTasks
  ])

  // Expose useful methods and state
  return {
    isActive: !!realtimeManagerRef.current,
    getConnectionMetrics: () => realtimeManagerRef.current?.getConnectionMetrics(),
    switchToPollingFallback: () => realtimeManagerRef.current?.switchToPollingFallback(),
    switchToRealtimeMode: () => realtimeManagerRef.current?.switchToRealtimeMode(),
    // Method to force retry connection
    retryConnection: () => {
      const manager = realtimeManagerRef.current
      if (manager) {
        manager.stop()
        setTimeout(() => manager.start(), 1000) // Restart after 1 second
      }
    }
  }
}