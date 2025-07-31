'use client'

import { useState } from 'react'
import { VoiceMemoryTask } from '@/lib/types'
import PinButton from './PinButton'
import RealtimeStatus from './RealtimeStatus'
import DraggablePinnedTask from './DraggablePinnedTask'
import { usePinnedTasks } from './PinnedTasksProvider'

interface PinnedTasksSectionProps {
  pinnedTasks: VoiceMemoryTask[]
  onPin: (taskId: string) => Promise<void>
  onUnpin: (taskId: string) => Promise<void>
  onTaskCompletion: (task: VoiceMemoryTask, completed: boolean) => Promise<void>
  loadingTasks: Set<string>
  formatDate: (dateString: string) => string
  setFilter: (filter: { type: 'date', value: string }) => void
  autoUnpinOnComplete?: boolean
  onAutoUnpinToggle?: (enabled: boolean) => void
}

export default function PinnedTasksSection({
  pinnedTasks,
  onPin,
  onUnpin,
  onTaskCompletion,
  loadingTasks,
  formatDate,
  setFilter,
  autoUnpinOnComplete = true,
  onAutoUnpinToggle
}: PinnedTasksSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { pinCount, maxPins, reorderPin } = usePinnedTasks()

  if (pinnedTasks.length === 0) {
    return null
  }

  return (
    <div className="relative mb-6 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg border border-yellow-200 shadow-sm hover:shadow-md transition-all duration-300" data-testid="pinned-tasks-section">
      {/* Cork board texture background */}
      <div className="absolute inset-0 opacity-5 rounded-lg pointer-events-none" 
           style={{
             backgroundImage: `radial-gradient(circle at 1px 1px, #8B4513 1px, transparent 0)`,
             backgroundSize: '15px 15px'
           }} />
           
      {/* Collapsible Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="relative w-full flex items-center justify-between p-4 hover:bg-yellow-100/50 transition-all duration-300 rounded-t-lg group"
        data-testid="collapse-pinned-tasks"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📌</span>
            <h3 className="text-lg font-semibold text-yellow-900">Pinned Tasks</h3>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            pinCount >= maxPins 
              ? 'bg-red-200 text-red-800 animate-pulse' 
              : pinCount >= maxPins - 2
              ? 'bg-orange-200 text-orange-800'
              : 'bg-yellow-200 text-yellow-800'
          }`} data-testid="pin-counter">
            {pinCount}/{maxPins}
          </span>
          
          {/* Auto-unpin toggle */}
          {onAutoUnpinToggle && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onAutoUnpinToggle(!autoUnpinOnComplete)}
                className={`
                  flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors
                  ${autoUnpinOnComplete 
                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }
                `}
                title={autoUnpinOnComplete ? 'Auto-unpin enabled' : 'Auto-unpin disabled'}
                data-testid="auto-unpin-toggle"
              >
                <span>{autoUnpinOnComplete ? '🔄' : '⏸️'}</span>
                <span>Auto-unpin</span>
              </button>
            </div>
          )}
          
          {/* Real-time status indicator */}
          <RealtimeStatus showLabel={false} className="ml-2" />
        </div>
        <div className={`
          text-yellow-700 transition-transform duration-200
          ${isCollapsed ? 'rotate-180' : 'rotate-0'}
        `}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Pin limit warning */}
      {pinCount >= maxPins - 2 && !isCollapsed && (
        <div className={`px-4 py-2 text-xs ${
          pinCount >= maxPins 
            ? 'text-red-700 bg-red-50 border-t border-red-200' 
            : 'text-orange-700 bg-orange-50 border-t border-orange-200'
        }`}>
          {pinCount >= maxPins 
            ? '⚠️ Pin limit reached! Unpin completed tasks to add more.'
            : `💡 Approaching pin limit (${maxPins - pinCount} remaining). Consider unpinning completed tasks.`
          }
        </div>
      )}

      {/* Collapsible Content */}
      <div className={`
        overflow-hidden transition-all duration-300 ease-in-out
        ${isCollapsed ? 'max-h-0' : 'max-h-none'}
      `}>
        <div className="px-4 pb-4 space-y-3">
          {pinnedTasks.map((task, index) => (
            <DraggablePinnedTask
              key={task.id}
              task={task}
              index={index}
              onPin={onPin}
              onUnpin={onUnpin}
              onTaskCompletion={onTaskCompletion}
              onReorder={reorderPin}
              loadingTasks={loadingTasks}
              formatDate={formatDate}
              setFilter={setFilter}
              totalPinnedTasks={pinnedTasks.length}
            />
          ))}
          
          {/* Empty state hint */}
          {pinnedTasks.length === 0 && (
            <div className="text-center py-8 text-yellow-600">
              <div className="mb-2">
                <svg className="mx-auto h-12 w-12 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </div>
              <p className="text-sm">Pin important tasks to keep them visible at the top</p>
              <p className="text-xs text-yellow-500 mt-1">Click the 📌 icon on any task to pin it</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}