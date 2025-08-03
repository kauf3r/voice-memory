'use client'

import React, { createContext, useContext, useEffect, useMemo } from 'react'
import { useToast } from './ToastProvider'
import {
  useAuthToken,
  usePinnedTasksState,
  useConnectionStatus,
  usePinnedTasksApi,
  useRealtimeSubscription
} from '@/app/hooks'

interface PinnedTasksContextType {
  pinnedTaskIds: string[]
  isPinned: (taskId: string) => boolean
  pinTask: (taskId: string) => Promise<void>
  unpinTask: (taskId: string) => Promise<void>
  reorderPin: (taskId: string, newIndex: number) => Promise<void>
  refreshPinnedTasks: () => Promise<void>
  pinCount: number
  maxPins: number
  isLoading: boolean
  error: string | null
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  lastSyncTime: Date | null
}

const PinnedTasksContext = createContext<PinnedTasksContextType | undefined>(undefined)

export function usePinnedTasks() {
  const context = useContext(PinnedTasksContext)
  if (context === undefined) {
    throw new Error('usePinnedTasks must be used within a PinnedTasksProvider')
  }
  return context
}

interface PinnedTasksProviderProps {
  children: React.ReactNode
}

export function PinnedTasksProvider({ children }: PinnedTasksProviderProps) {
  const { showToast } = useToast()
  
  // Authentication hook
  const { getAuthToken, user } = useAuthToken()
  
  // State management hook
  const {
    pinnedTaskIds,
    isLoading,
    error,
    lastSyncTime,
    maxPins,
    pinCount,
    isPinned,
    setPinnedTaskIds,
    setIsLoading,
    setError,
    updateSyncTime,
    resetState
  } = usePinnedTasksState()
  
  // Connection status hook
  const { connectionStatus, updateStatus: updateConnectionStatus } = useConnectionStatus()
  
  // API operations hook
  const { refreshPinnedTasks, pinTask, unpinTask, reorderPin } = usePinnedTasksApi({
    user,
    pinnedTaskIds,
    maxPins,
    getAuthToken,
    setPinnedTaskIds,
    setIsLoading,
    setError
  })
  
  // Real-time subscription hook
  useRealtimeSubscription({
    user,
    setPinnedTaskIds,
    updateConnectionStatus,
    setError,
    updateSyncTime,
    showToast,
    refreshPinnedTasks
  })

  // Reset state when user changes
  useEffect(() => {
    if (!user) {
      resetState()
    }
  }, [user, resetState])

  // Load pinned tasks when user changes
  useEffect(() => {
    if (user) {
      refreshPinnedTasks()
    }
  }, [user?.id, refreshPinnedTasks])

  // Memoize context value to prevent unnecessary re-renders
  const value: PinnedTasksContextType = useMemo(() => ({
    pinnedTaskIds,
    isPinned,
    pinTask,
    unpinTask,
    reorderPin,
    refreshPinnedTasks,
    pinCount,
    maxPins,
    isLoading,
    error,
    connectionStatus,
    lastSyncTime
  }), [
    pinnedTaskIds,
    isPinned,
    pinTask,
    unpinTask,
    reorderPin,
    refreshPinnedTasks,
    pinCount,
    maxPins,
    isLoading,
    error,
    connectionStatus,
    lastSyncTime
  ])

  return (
    <PinnedTasksContext.Provider value={value}>
      {children}
    </PinnedTasksContext.Provider>
  )
}