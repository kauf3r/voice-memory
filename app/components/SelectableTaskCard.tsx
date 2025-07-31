'use client'

import { VoiceMemoryTask } from '@/lib/types'
import PinButton from './PinButton'
import { usePinnedTasks } from './PinnedTasksProvider'

interface SelectableTaskCardProps {
  task: VoiceMemoryTask
  isSelected: boolean
  onSelectionChange: (taskId: string, selected: boolean) => void
  onPin: (taskId: string) => Promise<void>
  onUnpin: (taskId: string) => Promise<void>
  onTaskCompletion: (task: VoiceMemoryTask, completed: boolean) => Promise<void>
  loadingTasks: Set<string>
  formatDate: (dateString: string) => string
  setFilter: (filter: { type: 'date', value: string }) => void
  className?: string
}

export default function SelectableTaskCard({
  task,
  isSelected,
  onSelectionChange,
  onPin,
  onUnpin,
  onTaskCompletion,
  loadingTasks,
  formatDate,
  setFilter,
  className = ''
}: SelectableTaskCardProps) {
  const { isPinned } = usePinnedTasks()
  const pinned = isPinned(task.id)

  const handleSelectionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelectionChange(task.id, e.target.checked)
  }

  return (
    <div
      className={`
        bg-white rounded-lg border p-4 transition-all duration-200
        ${isSelected 
          ? 'border-blue-300 bg-blue-50 shadow-md ring-2 ring-blue-200' 
          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
        }
        ${task.completed ? 'opacity-75' : ''}
        ${pinned ? 'border-l-4 border-l-yellow-400' : ''}
        ${className}
      `}
      data-testid="selectable-task-card"
    >
      <div className="flex items-start gap-3">
        {/* Selection Checkbox */}
        <div className="pt-1 flex-shrink-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleSelectionChange}
            className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
            data-testid="task-selection-checkbox"
          />
        </div>

        {/* Task Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {/* Task Icon */}
                <span className={task.completed ? 'text-green-500' : 'text-gray-600'}>
                  {task.completed ? '✅' : (task.type === 'myTasks' ? '📋' : '👥')}
                </span>

                {/* Task Type Badge */}
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  task.completed
                    ? 'bg-green-100 text-green-700'
                    : task.type === 'myTasks'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {task.completed ? 'Completed' : task.type === 'myTasks' ? 'My Task' : 'Delegated'}
                </span>

                {/* Pin Badge */}
                {pinned && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                    📌 Pinned
                  </span>
                )}

                {/* Date */}
                <span className="text-sm text-gray-500">
                  {formatDate(task.date)}
                </span>
              </div>

              {/* Task Description */}
              <p className={`font-medium mb-2 ${
                task.completed ? 'text-gray-500 line-through' : 'text-gray-900'
              }`}>
                {task.description}
              </p>

              {/* Additional Details */}
              <div className="space-y-1">
                {task.assignedTo && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">Assigned to:</span>
                    <span className="text-xs font-medium text-gray-700">{task.assignedTo}</span>
                  </div>
                )}

                {task.nextSteps && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Next Steps:</div>
                    <p className="text-sm text-gray-600">{task.nextSteps}</p>
                  </div>
                )}

                {task.completed && task.completedAt && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-green-600">Completed:</span>
                    <span className="text-xs text-green-700">{formatDate(task.completedAt)}</span>
                    {task.completedBy && (
                      <span className="text-xs text-green-700">by {task.completedBy}</span>
                    )}
                  </div>
                )}

                {task.noteContext && (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                    <div className="text-xs text-gray-500 mb-1">Context:</div>
                    <p className="text-gray-600 italic">"{task.noteContext}"</p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 ml-4 flex-shrink-0">
              {/* Completion Toggle */}
              <input
                type="checkbox"
                checked={task.completed}
                onChange={(e) => onTaskCompletion(task, e.target.checked)}
                disabled={loadingTasks.has(task.id)}
                className="w-5 h-5 text-green-600 bg-white border-gray-300 rounded focus:ring-green-500 focus:ring-2 disabled:opacity-50"
                title={task.completed ? 'Mark as incomplete' : 'Mark as complete'}
              />

              {/* Pin Button */}
              <PinButton
                task={{ ...task, pinned }}
                onPin={onPin}
                onUnpin={onUnpin}
                disabled={loadingTasks.has(task.id)}
              />

              {/* View Source Note */}
              <button
                onClick={() => setFilter({ type: 'date', value: task.date.split('T')[0] })}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="View source note"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}