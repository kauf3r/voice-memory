'use client'

import { useState, useCallback } from 'react'
import { VoiceMemoryTask } from '@/lib/types'
import { usePinnedTasks } from './PinnedTasksProvider'
import { useToast } from './ToastProvider'

interface BulkTaskActionsProps {
  tasks: VoiceMemoryTask[]
  selectedTaskIds: string[]
  onSelectionChange: (taskIds: string[]) => void
  onPin: (taskId: string) => Promise<void>
  onUnpin: (taskId: string) => Promise<void>
  onTaskCompletion: (task: VoiceMemoryTask, completed: boolean) => Promise<void>
  className?: string
}

export default function BulkTaskActions({
  tasks,
  selectedTaskIds,
  onSelectionChange,
  onPin,
  onUnpin,
  onTaskCompletion,
  className = ''
}: BulkTaskActionsProps) {
  const { isPinned, pinCount, maxPins } = usePinnedTasks()
  const { showToast } = useToast()
  const [isOperating, setIsOperating] = useState(false)

  const selectedTasks = tasks.filter(task => selectedTaskIds.includes(task.id))
  const selectedPinnedTasks = selectedTasks.filter(task => isPinned(task.id))
  const selectedUnpinnedTasks = selectedTasks.filter(task => !isPinned(task.id))
  const selectedCompletedTasks = selectedTasks.filter(task => task.completed)
  const selectedIncompleteTasks = selectedTasks.filter(task => !task.completed)

  const canPinMore = (pinCount + selectedUnpinnedTasks.length) <= maxPins

  // Select all tasks
  const selectAll = useCallback(() => {
    if (selectedTaskIds.length === tasks.length) {
      onSelectionChange([])
    } else {
      onSelectionChange(tasks.map(task => task.id))
    }
  }, [tasks, selectedTaskIds.length, onSelectionChange])

  // Clear selection
  const clearSelection = useCallback(() => {
    onSelectionChange([])
  }, [onSelectionChange])

  // Bulk pin selected tasks
  const bulkPin = useCallback(async () => {
    if (selectedUnpinnedTasks.length === 0) return
    if (!canPinMore) {
      showToast(`Cannot pin ${selectedUnpinnedTasks.length} tasks. Pin limit would be exceeded (${maxPins} max).`, 'error')
      return
    }

    setIsOperating(true)
    let successCount = 0
    let failureCount = 0

    try {
      console.log(`🚀 Bulk pinning ${selectedUnpinnedTasks.length} tasks...`)
      
      for (const task of selectedUnpinnedTasks) {
        try {
          await onPin(task.id)
          successCount++
        } catch (error) {
          console.error(`Failed to pin task ${task.id}:`, error)
          failureCount++
        }
      }

      if (successCount > 0) {
        showToast(`Successfully pinned ${successCount} task${successCount > 1 ? 's' : ''}`, 'success')
      }
      if (failureCount > 0) {
        showToast(`Failed to pin ${failureCount} task${failureCount > 1 ? 's' : ''}`, 'error')
      }

      // Clear selection after successful operations
      if (successCount > 0) {
        clearSelection()
      }

    } catch (error) {
      console.error('Bulk pin operation failed:', error)
      showToast('Bulk pin operation failed', 'error')
    } finally {
      setIsOperating(false)
    }
  }, [selectedUnpinnedTasks, canPinMore, maxPins, onPin, showToast, clearSelection])

  // Bulk unpin selected tasks
  const bulkUnpin = useCallback(async () => {
    if (selectedPinnedTasks.length === 0) return

    setIsOperating(true)
    let successCount = 0
    let failureCount = 0

    try {
      console.log(`🚀 Bulk unpinning ${selectedPinnedTasks.length} tasks...`)
      
      for (const task of selectedPinnedTasks) {
        try {
          await onUnpin(task.id)
          successCount++
        } catch (error) {
          console.error(`Failed to unpin task ${task.id}:`, error)
          failureCount++
        }
      }

      if (successCount > 0) {
        showToast(`Successfully unpinned ${successCount} task${successCount > 1 ? 's' : ''}`, 'success')
      }
      if (failureCount > 0) {
        showToast(`Failed to unpin ${failureCount} task${failureCount > 1 ? 's' : ''}`, 'error')
      }

      // Clear selection after successful operations
      if (successCount > 0) {
        clearSelection()
      }

    } catch (error) {
      console.error('Bulk unpin operation failed:', error)
      showToast('Bulk unpin operation failed', 'error')
    } finally {
      setIsOperating(false)
    }
  }, [selectedPinnedTasks, onUnpin, showToast, clearSelection])

  // Bulk complete selected tasks
  const bulkComplete = useCallback(async () => {
    if (selectedIncompleteTasks.length === 0) return

    setIsOperating(true)
    let successCount = 0
    let failureCount = 0

    try {
      console.log(`🚀 Bulk completing ${selectedIncompleteTasks.length} tasks...`)
      
      for (const task of selectedIncompleteTasks) {
        try {
          await onTaskCompletion(task, true)
          successCount++
        } catch (error) {
          console.error(`Failed to complete task ${task.id}:`, error)
          failureCount++
        }
      }

      if (successCount > 0) {
        showToast(`Successfully completed ${successCount} task${successCount > 1 ? 's' : ''}`, 'success')
      }
      if (failureCount > 0) {
        showToast(`Failed to complete ${failureCount} task${failureCount > 1 ? 's' : ''}`, 'error')
      }

      // Clear selection after successful operations
      if (successCount > 0) {
        clearSelection()
      }

    } catch (error) {
      console.error('Bulk complete operation failed:', error)
      showToast('Bulk complete operation failed', 'error')
    } finally {
      setIsOperating(false)
    }
  }, [selectedIncompleteTasks, onTaskCompletion, showToast, clearSelection])

  // Bulk uncomplete selected tasks
  const bulkUncomplete = useCallback(async () => {
    if (selectedCompletedTasks.length === 0) return

    setIsOperating(true)
    let successCount = 0
    let failureCount = 0

    try {
      console.log(`🚀 Bulk uncompleting ${selectedCompletedTasks.length} tasks...`)
      
      for (const task of selectedCompletedTasks) {
        try {
          await onTaskCompletion(task, false)
          successCount++
        } catch (error) {
          console.error(`Failed to uncomplete task ${task.id}:`, error)
          failureCount++
        }
      }

      if (successCount > 0) {
        showToast(`Successfully uncompleted ${successCount} task${successCount > 1 ? 's' : ''}`, 'success')
      }
      if (failureCount > 0) {
        showToast(`Failed to uncomplete ${failureCount} task${failureCount > 1 ? 's' : ''}`, 'error')
      }

      // Clear selection after successful operations
      if (successCount > 0) {
        clearSelection()
      }

    } catch (error) {
      console.error('Bulk uncomplete operation failed:', error)
      showToast('Bulk uncomplete operation failed', 'error')
    } finally {
      setIsOperating(false)
    }
  }, [selectedCompletedTasks, onTaskCompletion, showToast, clearSelection])

  if (selectedTaskIds.length === 0) {
    return null
  }

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 ${className}`} data-testid="bulk-task-actions">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-blue-700 font-medium">
              {selectedTaskIds.length} task{selectedTaskIds.length > 1 ? 's' : ''} selected
            </span>
            <button
              onClick={clearSelection}
              className="text-blue-600 hover:text-blue-800 underline text-sm"
              data-testid="clear-selection"
            >
              Clear
            </button>
          </div>

          {/* Selection summary */}
          <div className="flex items-center gap-4 text-sm text-blue-600">
            {selectedPinnedTasks.length > 0 && (
              <span>📌 {selectedPinnedTasks.length} pinned</span>
            )}
            {selectedUnpinnedTasks.length > 0 && (
              <span>📋 {selectedUnpinnedTasks.length} unpinned</span>
            )}
            {selectedCompletedTasks.length > 0 && (
              <span>✅ {selectedCompletedTasks.length} completed</span>
            )}
            {selectedIncompleteTasks.length > 0 && (
              <span>⏳ {selectedIncompleteTasks.length} incomplete</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Select All/None Toggle */}
          <button
            onClick={selectAll}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
            data-testid="select-all-toggle"
          >
            {selectedTaskIds.length === tasks.length ? 'Deselect All' : 'Select All'}
          </button>

          {/* Bulk Actions */}
          {selectedUnpinnedTasks.length > 0 && (
            <button
              onClick={bulkPin}
              disabled={isOperating || !canPinMore}
              className={`px-3 py-1 text-sm rounded font-medium transition-colors ${
                isOperating || !canPinMore
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
              }`}
              title={!canPinMore ? `Pin limit would be exceeded (${maxPins} max)` : `Pin ${selectedUnpinnedTasks.length} tasks`}
              data-testid="bulk-pin"
            >
              {isOperating ? '⏳' : '📌'} Pin ({selectedUnpinnedTasks.length})
            </button>
          )}

          {selectedPinnedTasks.length > 0 && (
            <button
              onClick={bulkUnpin}
              disabled={isOperating}
              className={`px-3 py-1 text-sm rounded font-medium transition-colors ${
                isOperating
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
              }`}
              title={`Unpin ${selectedPinnedTasks.length} tasks`}
              data-testid="bulk-unpin"
            >
              {isOperating ? '⏳' : '📌'} Unpin ({selectedPinnedTasks.length})
            </button>
          )}

          {selectedIncompleteTasks.length > 0 && (
            <button
              onClick={bulkComplete}
              disabled={isOperating}
              className={`px-3 py-1 text-sm rounded font-medium transition-colors ${
                isOperating
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
              title={`Complete ${selectedIncompleteTasks.length} tasks`}
              data-testid="bulk-complete"
            >
              {isOperating ? '⏳' : '✅'} Complete ({selectedIncompleteTasks.length})
            </button>
          )}

          {selectedCompletedTasks.length > 0 && (
            <button
              onClick={bulkUncomplete}
              disabled={isOperating}
              className={`px-3 py-1 text-sm rounded font-medium transition-colors ${
                isOperating
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title={`Mark ${selectedCompletedTasks.length} tasks as incomplete`}
              data-testid="bulk-uncomplete"
            >
              {isOperating ? '⏳' : '🔄'} Uncomplete ({selectedCompletedTasks.length})
            </button>
          )}
        </div>
      </div>

      {/* Pin limit warning */}
      {selectedUnpinnedTasks.length > 0 && !canPinMore && (
        <div className="mt-2 p-2 bg-orange-100 border border-orange-200 rounded text-sm text-orange-700">
          ⚠️ Cannot pin {selectedUnpinnedTasks.length} tasks. You would exceed the pin limit of {maxPins} tasks. 
          Current pins: {pinCount}, Selected to pin: {selectedUnpinnedTasks.length}
        </div>
      )}
    </div>
  )
}