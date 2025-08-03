'use client'

import { useEffect, useRef } from 'react'
import { RealtimeManager, type RealtimeCallbacks } from '@/app/services/RealtimeManager'
import type { ConnectionStatus } from './useConnectionStatus'

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

    const callbacks: RealtimeCallbacks = {
      onConnectionStatusChange: updateConnectionStatus,
      onError: setError,
      onSyncTimeUpdate: updateSyncTime,
      onTaskPinned: (taskId: string) => {
        setPinnedTaskIds(prev => {
          if (!prev.includes(taskId)) {
            return [...prev, taskId]
          }
          return prev
        })
      },
      onTaskUnpinned: (taskId: string) => {
        setPinnedTaskIds(prev => prev.filter(id => id !== taskId))
      },
      onPinUpdated: () => {
        // Debounced refresh for order changes
        setTimeout(() => refreshPinnedTasks(), 500)
      },
      onToast: showToast
    }

    // Create and start realtime manager
    const realtimeManager = new RealtimeManager(
      { userId: user.id },
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

  return {
    // Could expose methods here if needed for manual control
    isActive: !!realtimeManagerRef.current
  }
}