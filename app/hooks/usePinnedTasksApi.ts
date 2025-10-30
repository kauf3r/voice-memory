'use client'

import { useCallback } from 'react'
import { PinnedTasksService } from '@/app/services/PinnedTasksService'
import { OptimisticUpdater } from '@/app/services/OptimisticUpdater'
import { useToast } from '@/app/components/ToastProvider'

interface UsePinnedTasksApiProps {
  user: any
  pinnedTaskIds: string[]
  maxPins: number
  getAuthToken: () => Promise<string>
  setPinnedTaskIds: React.Dispatch<React.SetStateAction<string[]>>
  setIsLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export function usePinnedTasksApi({
  user,
  pinnedTaskIds,
  maxPins,
  getAuthToken,
  setPinnedTaskIds,
  setIsLoading,
  setError
}: UsePinnedTasksApiProps) {
  const { showToast } = useToast()

  // Fetch pinned tasks from the API
  const refreshPinnedTasks = useCallback(async () => {
    if (!user) {
      setPinnedTaskIds([])
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const accessToken = await getAuthToken()
      const data = await PinnedTasksService.fetchPinnedTasks(accessToken)
      
      if (data.success) {
        setPinnedTaskIds(data.pinnedTasks.map((pt: any) => pt.taskId))
      }
    } catch (err) {
      console.error('Error fetching pinned tasks:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch pinned tasks')
    } finally {
      setIsLoading(false)
    }
  }, [user?.id, getAuthToken, setPinnedTaskIds, setIsLoading, setError])

  // Pin a task with enhanced optimistic updates and conflict resolution
  const pinTask = useCallback(async (taskId: string) => {
    if (!user) return

    try {
      setError(null)
      const accessToken = await getAuthToken()

      // Handle optimistic update
      let shouldProceed = true
      let errorMessage = ''
      
      setPinnedTaskIds(prev => {
        const result = OptimisticUpdater.handleOptimisticPin(taskId, prev, maxPins)
        shouldProceed = result.shouldProceed
        errorMessage = result.errorMessage || ''
        
        if (!result.shouldProceed) {
          return prev // No change if validation failed
        }

        return [...prev, taskId]
      })

      // Check if we should proceed after state update
      if (!shouldProceed) {
        if (errorMessage) {
          throw new Error(errorMessage)
        }
        return // Early exit if already pinned
      }

      // Call API
      await PinnedTasksService.pinTask(taskId, accessToken)
      console.log('✅ Pin operation confirmed by server:', taskId)
      
    } catch (err) {
      // Rollback optimistic update on error
      setPinnedTaskIds(OptimisticUpdater.createPinRollback(taskId))
      
      console.error('Error pinning task:', err)
      const errorMsg = err instanceof Error ? err.message : 'Failed to pin task'
      setError(errorMsg)
      showToast(errorMsg, 'error')
      throw err
    }
  }, [user, maxPins, showToast, getAuthToken, setPinnedTaskIds, setError])

  // Unpin a task with enhanced optimistic updates and conflict resolution
  const unpinTask = useCallback(async (taskId: string) => {
    if (!user) return

    try {
      setError(null)
      const accessToken = await getAuthToken()

      // Handle optimistic update
      let shouldProceed = true
      let originalTaskIds: string[] = []
      
      setPinnedTaskIds(prev => {
        const result = OptimisticUpdater.handleOptimisticUnpin(taskId, prev)
        shouldProceed = result.shouldProceed
        originalTaskIds = result.originalState || []
        
        if (!result.shouldProceed) {
          return prev // No change if not pinned
        }

        return prev.filter(id => id !== taskId)
      })

      // Check if we should proceed after state update
      if (!shouldProceed) {
        return // Early exit if not pinned
      }

      // Call API
      await PinnedTasksService.unpinTask(taskId, accessToken)
      console.log('✅ Unpin operation confirmed by server:', taskId)

    } catch (err) {
      // Rollback optimistic update on error
      setPinnedTaskIds(OptimisticUpdater.createUnpinRollback(taskId, originalTaskIds))
      
      console.error('Error unpinning task:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to unpin task'
      setError(errorMessage)
      showToast(errorMessage, 'error')
      throw err
    }
  }, [user, showToast, getAuthToken, setPinnedTaskIds, setError])

  // Reorder a pinned task
  const reorderPin = useCallback(async (taskId: string, newIndex: number) => {
    if (!user) return

    try {
      setError(null)
      const accessToken = await getAuthToken()

      // Handle optimistic update
      let shouldProceed = true
      let originalOrder: string[] = []
      let currentIndex = -1
      
      setPinnedTaskIds(prev => {
        const result = OptimisticUpdater.handleOptimisticReorder(taskId, newIndex, prev)
        shouldProceed = result.shouldProceed
        originalOrder = result.originalState || []
        currentIndex = result.currentIndex || -1
        
        if (!result.shouldProceed) {
          return prev // No change if validation failed
        }

        return OptimisticUpdater.performReorder(prev, currentIndex, newIndex)
      })

      // Check if we should proceed after state update
      if (!shouldProceed) {
        return // Early exit if validation failed
      }

      // Call API
      await PinnedTasksService.reorderPin(taskId, newIndex, accessToken)
      console.log('✅ Pin reorder confirmed by server:', taskId)
      showToast('Tasks reordered', 'success')

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
  }, [user, showToast, getAuthToken, setPinnedTaskIds, setError])

  return {
    refreshPinnedTasks,
    pinTask,
    unpinTask,
    reorderPin
  }
}