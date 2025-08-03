'use client'

export interface OptimisticUpdateResult {
  shouldProceed: boolean
  errorMessage?: string
  originalState?: string[]
  currentIndex?: number
}

export class OptimisticUpdater {
  /**
   * Handles optimistic pin update with validation
   */
  static handleOptimisticPin(
    taskId: string,
    currentPinnedIds: string[],
    maxPins: number
  ): OptimisticUpdateResult {
    // Check if task is already pinned
    if (currentPinnedIds.includes(taskId)) {
      console.log('⚠️ Task already pinned, skipping:', taskId)
      return { shouldProceed: false }
    }

    // Check pin limit
    if (currentPinnedIds.length >= maxPins) {
      return {
        shouldProceed: false,
        errorMessage: `Pin limit exceeded. You can only pin up to ${maxPins} tasks at a time.`
      }
    }

    // Proceed with optimistic update
    const optimisticTimestamp = Date.now()
    console.log('🚀 Optimistic pin update:', taskId, 'at', optimisticTimestamp)
    return { shouldProceed: true }
  }

  /**
   * Handles optimistic unpin update with validation
   */
  static handleOptimisticUnpin(
    taskId: string,
    currentPinnedIds: string[]
  ): OptimisticUpdateResult {
    // Check if task is actually pinned
    if (!currentPinnedIds.includes(taskId)) {
      console.log('⚠️ Task not pinned, skipping unpin:', taskId)
      return { shouldProceed: false }
    }

    // Store original state for rollback
    const originalState = [...currentPinnedIds]
    const optimisticTimestamp = Date.now()
    console.log('🚀 Optimistic unpin update:', taskId, 'at', optimisticTimestamp)
    
    return { 
      shouldProceed: true, 
      originalState 
    }
  }

  /**
   * Handles optimistic reorder update with validation
   */
  static handleOptimisticReorder(
    taskId: string,
    newIndex: number,
    currentPinnedIds: string[]
  ): OptimisticUpdateResult {
    // Validate the task is actually pinned
    const currentIndex = currentPinnedIds.indexOf(taskId)
    if (currentIndex === -1) {
      console.log('⚠️ Cannot reorder - task not pinned:', taskId)
      return { shouldProceed: false }
    }

    // Don't reorder if already in the correct position
    if (currentIndex === newIndex) {
      console.log('⚠️ Task already in correct position:', taskId, 'at index', newIndex)
      return { shouldProceed: false }
    }

    // Store original order for rollback
    const originalState = [...currentPinnedIds]
    console.log('🚀 Optimistic reorder:', taskId, 'from', currentIndex, 'to', newIndex)
    
    return { 
      shouldProceed: true, 
      originalState, 
      currentIndex 
    }
  }

  /**
   * Performs the actual reorder operation
   */
  static performReorder(
    taskIds: string[],
    currentIndex: number,
    newIndex: number
  ): string[] {
    const newOrder = [...taskIds]
    const [movedItem] = newOrder.splice(currentIndex, 1)
    newOrder.splice(newIndex, 0, movedItem)
    return newOrder
  }

  /**
   * Creates rollback function for pin operation
   */
  static createPinRollback(taskId: string) {
    return (prevIds: string[]) => {
      const rolled = prevIds.filter(id => id !== taskId)
      console.log('🔄 Rolling back optimistic pin for:', taskId)
      return rolled
    }
  }

  /**
   * Creates rollback function for unpin operation
   */
  static createUnpinRollback(taskId: string, originalState: string[]) {
    return () => {
      console.log('🔄 Rolling back optimistic unpin for:', taskId)
      return originalState
    }
  }

  /**
   * Creates rollback function for error scenarios
   */
  static createErrorRollback(taskId: string, operation: 'pin' | 'unpin') {
    if (operation === 'pin') {
      return (prevIds: string[]) => {
        const rolled = prevIds.filter(id => id !== taskId)
        console.log('❌ Error rollback for pin:', taskId)
        return rolled
      }
    } else {
      return (prevIds: string[]) => {
        if (!prevIds.includes(taskId)) {
          console.log('❌ Error rollback for unpin:', taskId)
          return [...prevIds, taskId]
        }
        return prevIds
      }
    }
  }
}