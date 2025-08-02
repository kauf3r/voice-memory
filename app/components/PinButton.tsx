'use client'

import { useState } from 'react'
import { VoiceMemoryTask } from '@/lib/types'
import { usePinnedTasks } from './PinnedTasksProvider'

interface PinButtonProps {
  task: VoiceMemoryTask
  onPin: (taskId: string) => Promise<void>
  onUnpin: (taskId: string) => Promise<void>
  disabled?: boolean
}

export default function PinButton({ task, onPin, onUnpin, disabled = false }: PinButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { isPinned } = usePinnedTasks()
  const isTaskPinned = isPinned(task.id)

  const handleClick = async () => {
    if (disabled || isLoading) return

    setIsLoading(true)
    try {
      if (isTaskPinned) {
        await onUnpin(task.id)
      } else {
        await onPin(task.id)
      }
    } catch (error) {
      console.error('Pin operation failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={`
        relative p-2 rounded-md transition-all duration-300 group overflow-hidden
        ${disabled || isLoading 
          ? 'opacity-50 cursor-not-allowed' 
          : 'hover:bg-blue-50 cursor-pointer transform hover:scale-105'
        }
        ${isTaskPinned ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-500'}
      `}
      title={isTaskPinned ? 'Unpin task' : 'Pin task to top'}
      data-testid="pin-button"
    >
      {/* Ripple effect on click */}
      <div className={`
        absolute inset-0 bg-blue-200 rounded-full scale-0 opacity-0
        ${!isLoading ? 'group-active:scale-150 group-active:opacity-30' : ''}
        transition-all duration-300
      `} />
      
      <div className={`
        relative text-lg transition-all duration-300 ease-out
        ${isLoading ? 'animate-bounce' : ''}
        ${isTaskPinned 
          ? 'scale-110 rotate-12 drop-shadow-sm' 
          : 'group-hover:scale-125 group-hover:rotate-12 group-hover:drop-shadow-sm'
        }
      `}>
        {isTaskPinned ? '📍' : '📌'}
      </div>
      
      {/* Success sparkle effect */}
      {isTaskPinned && !isLoading && (
        <div className="absolute -top-1 -right-1 pointer-events-none">
          <div className="w-2 h-2 bg-yellow-400 rounded-full animate-ping opacity-75"></div>
        </div>
      )}
      
      {/* Cork board shadow effect for pinned */}
      {isTaskPinned && (
        <div className="absolute inset-0 rounded-md shadow-inner bg-gradient-to-br from-transparent to-blue-100/30 pointer-events-none" />
      )}
      
      {/* Loading spinner overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-blue-50/80 rounded-md">
          <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </button>
  )
}