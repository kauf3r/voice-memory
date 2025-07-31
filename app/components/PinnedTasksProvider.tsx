'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useAuth } from './AuthProvider'
import { supabase } from '@/lib/supabase'
import { useToast } from './ToastProvider'

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
  // Always call hooks at the top level, regardless of conditions
  const { user } = useAuth()
  const { showToast } = useToast()
  const [pinnedTaskIds, setPinnedTaskIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const maxPins = 10

  // Fetch pinned tasks from the API
  const refreshPinnedTasks = useCallback(async () => {
    // Early return after hooks are established
    if (!user) {
      setPinnedTaskIds([])
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        throw new Error('Authentication required')
      }

      const response = await fetch('/api/tasks/pinned', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch pinned tasks')
      }

      const data = await response.json()
      if (data.success) {
        setPinnedTaskIds(data.pinnedTasks.map((pt: any) => pt.taskId))
      }
    } catch (err) {
      console.error('Error fetching pinned tasks:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch pinned tasks')
    } finally {
      setIsLoading(false)
    }
  }, [user])

  // Pin a task with enhanced optimistic updates and conflict resolution
  const pinTask = useCallback(async (taskId: string) => {
    // Early return after hooks are established
    if (!user) return

    // Check pin limit
    if (pinnedTaskIds.length >= maxPins) {
      throw new Error(`Pin limit exceeded. You can only pin up to ${maxPins} tasks at a time.`)
    }

    // Check if task is already pinned (avoid duplicate operations)
    if (pinnedTaskIds.includes(taskId)) {
      console.log('⚠️ Task already pinned, skipping:', taskId)
      return
    }

    try {
      setError(null)

      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        throw new Error('Authentication required')
      }

      // Optimistic update with timestamp for conflict resolution
      const optimisticTimestamp = Date.now()
      setPinnedTaskIds(prev => {
        const updated = [...prev, taskId]
        console.log('🚀 Optimistic pin update:', taskId, 'at', optimisticTimestamp)
        return updated
      })

      const response = await fetch(`/api/tasks/${taskId}/pin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      const data = await response.json()

      if (!response.ok) {
        // Rollback optimistic update
        setPinnedTaskIds(prev => {
          const rolled = prev.filter(id => id !== taskId)
          console.log('🔄 Rolling back optimistic pin for:', taskId)
          return rolled
        })
        throw new Error(data.error || 'Failed to pin task')
      }

      console.log('✅ Pin operation confirmed by server:', taskId)
      // Note: Real-time subscription will handle the actual state update
      // No need to update state again here to avoid conflicts

    } catch (err) {
      // Rollback optimistic update on error
      setPinnedTaskIds(prev => {
        const rolled = prev.filter(id => id !== taskId)
        console.log('❌ Error rollback for pin:', taskId)
        return rolled
      })
      console.error('Error pinning task:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to pin task'
      setError(errorMessage)
      showToast(errorMessage, 'error')
      throw err
    }
  }, [user, pinnedTaskIds, maxPins])

  // Unpin a task with enhanced optimistic updates and conflict resolution
  const unpinTask = useCallback(async (taskId: string) => {
    // Early return after hooks are established
    if (!user) return

    // Check if task is actually pinned (avoid unnecessary operations)
    if (!pinnedTaskIds.includes(taskId)) {
      console.log('⚠️ Task not pinned, skipping unpin:', taskId)
      return
    }

    try {
      setError(null)

      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        throw new Error('Authentication required')
      }

      // Store original state for rollback
      const originalTaskIds = [...pinnedTaskIds]
      
      // Optimistic update with timestamp for conflict resolution
      const optimisticTimestamp = Date.now()
      setPinnedTaskIds(prev => {
        const updated = prev.filter(id => id !== taskId)
        console.log('🚀 Optimistic unpin update:', taskId, 'at', optimisticTimestamp)
        return updated
      })

      const response = await fetch(`/api/tasks/${taskId}/pin`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      const data = await response.json()

      if (!response.ok) {
        // Rollback optimistic update
        setPinnedTaskIds(originalTaskIds)
        console.log('🔄 Rolling back optimistic unpin for:', taskId)
        throw new Error(data.error || 'Failed to unpin task')
      }

      console.log('✅ Unpin operation confirmed by server:', taskId)
      // Note: Real-time subscription will handle the actual state update
      // No need to update state again here to avoid conflicts

    } catch (err) {
      // Rollback optimistic update on error
      setPinnedTaskIds(prev => {
        if (!prev.includes(taskId)) {
          console.log('❌ Error rollback for unpin:', taskId)
          return [...prev, taskId]
        }
        return prev
      })
      console.error('Error unpinning task:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to unpin task'
      setError(errorMessage)
      showToast(errorMessage, 'error')
      throw err
    }
  }, [user, pinnedTaskIds])

  // Reorder a pinned task
  const reorderPin = useCallback(async (taskId: string, newIndex: number) => {
    // Early return after hooks are established
    if (!user) return

    // Validate the task is actually pinned
    const currentIndex = pinnedTaskIds.indexOf(taskId)
    if (currentIndex === -1) {
      console.log('⚠️ Cannot reorder - task not pinned:', taskId)
      return
    }

    // Don't reorder if already in the correct position
    if (currentIndex === newIndex) {
      console.log('⚠️ Task already in correct position:', taskId, 'at index', newIndex)
      return
    }

    try {
      setError(null)

      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !session) {
        throw new Error('Authentication required')
      }

      // Optimistic update - reorder in local state immediately
      const originalOrder = [...pinnedTaskIds]
      setPinnedTaskIds(prev => {
        const newOrder = [...prev]
        const [movedItem] = newOrder.splice(currentIndex, 1)
        newOrder.splice(newIndex, 0, movedItem)
        console.log('🚀 Optimistic reorder:', taskId, 'from', currentIndex, 'to', newIndex)
        return newOrder
      })

      const response = await fetch('/api/tasks/reorder-pins', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          taskId,
          newOrder: newIndex
        })
      })

      const data = await response.json()

      if (!response.ok) {
        // Rollback optimistic update
        setPinnedTaskIds(originalOrder)
        console.log('🔄 Rolling back optimistic reorder for:', taskId)
        throw new Error(data.error || 'Failed to reorder pin')
      }

      console.log('✅ Pin reorder confirmed by server:', taskId)
      showToast('Tasks reordered', 'success')

      // The real-time subscription will handle syncing the final order
      // But we may want to refresh to ensure consistency
      setTimeout(() => refreshPinnedTasks(), 1000)

    } catch (err) {
      // Rollback optimistic update on error
      setPinnedTaskIds(originalOrder)
      console.log('❌ Error rollback for reorder:', taskId)
      console.error('Error reordering pin:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to reorder pins'
      setError(errorMessage)
      showToast(errorMessage, 'error')
      throw err
    }
  }, [user, pinnedTaskIds, showToast, refreshPinnedTasks])

  // Check if a task is pinned
  const isPinned = useCallback((taskId: string) => {
    return pinnedTaskIds.includes(taskId)
  }, [pinnedTaskIds])

  // Load pinned tasks when user changes
  useEffect(() => {
    refreshPinnedTasks()
  }, [refreshPinnedTasks])

  // Real-time subscription for pin changes
  useEffect(() => {
    let subscription: any = null
    
    // Early return after state setup
    if (!user) {
      setConnectionStatus('disconnected')
      return
    }

    setConnectionStatus('connecting')

    const setupRealtimeSubscription = async () => {
      try {
        console.log('🔄 Setting up real-time pin subscription...')
        
        subscription = supabase
          .channel('task_pins_changes')
          .on(
            'postgres_changes',
            {
              event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
              schema: 'public',
              table: 'task_pins',
              filter: `user_id=eq.${user.id}`
            },
            (payload) => {
              console.log('📌 Real-time pin change detected:', payload)
              setLastSyncTime(new Date())
              
              // Handle different types of changes
              switch (payload.eventType) {
                case 'INSERT':
                  // Task was pinned
                  const newTaskId = payload.new.task_id
                  setPinnedTaskIds(prev => {
                    if (!prev.includes(newTaskId)) {
                      const updated = [...prev, newTaskId]
                      console.log('➕ Task pinned via real-time:', newTaskId)
                      showToast('Task pinned!', 'success')
                      return updated
                    }
                    return prev
                  })
                  break
                  
                case 'DELETE':
                  // Task was unpinned
                  const removedTaskId = payload.old.task_id
                  setPinnedTaskIds(prev => {
                    const updated = prev.filter(id => id !== removedTaskId)
                    console.log('➖ Task unpinned via real-time:', removedTaskId)
                    showToast('Task unpinned', 'info')
                    return updated
                  })
                  break
                  
                case 'UPDATE':
                  // Pin was updated (shouldn't happen often, but handle it)
                  console.log('🔄 Pin updated via real-time')
                  refreshPinnedTasks()
                  break
                  
                default:
                  console.log('🤷 Unknown pin change event:', payload.eventType)
              }
            }
          )
          .subscribe((status) => {
            console.log('📡 Pin subscription status:', status)
            switch (status) {
              case 'SUBSCRIBED':
                setConnectionStatus('connected')
                setLastSyncTime(new Date())
                console.log('✅ Real-time pin updates active')
                break
              case 'CHANNEL_ERROR':
              case 'TIMED_OUT':
                setConnectionStatus('error')
                console.error('❌ Pin subscription error')
                setError('Real-time updates disconnected')
                break
              case 'CLOSED':
                setConnectionStatus('disconnected')
                break
              default:
                setConnectionStatus('connecting')
            }
          })
      } catch (err) {
        console.error('Failed to setup real-time pin subscription:', err)
        setConnectionStatus('error')
      }
    }

    setupRealtimeSubscription()

    // Cleanup subscription on unmount or user change
    return () => {
      if (subscription) {
        console.log('🧹 Cleaning up pin subscription')
        supabase.removeChannel(subscription)
        setConnectionStatus('disconnected')
      }
    }
  }, [user, showToast, refreshPinnedTasks])

  const value: PinnedTasksContextType = {
    pinnedTaskIds,
    isPinned,
    pinTask,
    unpinTask,
    reorderPin,
    refreshPinnedTasks,
    pinCount: pinnedTaskIds.length,
    maxPins,
    isLoading,
    error,
    connectionStatus,
    lastSyncTime
  }

  return (
    <PinnedTasksContext.Provider value={value}>
      {children}
    </PinnedTasksContext.Provider>
  )
}