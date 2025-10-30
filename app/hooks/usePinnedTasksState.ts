'use client'

import { useState, useCallback, useMemo } from 'react'

export function usePinnedTasksState() {
  const [pinnedTaskIds, setPinnedTaskIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const maxPins = 10

  // Check if a task is pinned
  const isPinned = useCallback((taskId: string) => {
    return pinnedTaskIds.includes(taskId)
  }, [pinnedTaskIds])

  // Get pin count
  const pinCount = useMemo(() => pinnedTaskIds.length, [pinnedTaskIds])

  // Clear error state
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Update sync time
  const updateSyncTime = useCallback(() => {
    setLastSyncTime(new Date())
  }, [])

  // Reset state for new user
  const resetState = useCallback(() => {
    setPinnedTaskIds([])
    setIsLoading(false)
    setError(null)
    setLastSyncTime(null)
  }, [])

  return {
    // State
    pinnedTaskIds,
    isLoading,
    error,
    lastSyncTime,
    maxPins,
    pinCount,
    
    // Computed
    isPinned,
    
    // Actions
    setPinnedTaskIds,
    setIsLoading,
    setError,
    clearError,
    updateSyncTime,
    resetState
  }
}