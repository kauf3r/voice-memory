'use client'

import { useState, useCallback } from 'react'
import { VoiceMemoryTask } from '@/lib/types'
import PinnedTasksSection from './PinnedTasksSection'
import BulkTaskActions from './BulkTaskActions'
import SelectableTaskCard from './SelectableTaskCard'
import { usePinnedTasks } from './PinnedTasksProvider'

interface EnhancedTaskListProps {
  tasks: VoiceMemoryTask[]
  onPin: (taskId: string) => Promise<void>
  onUnpin: (taskId: string) => Promise<void>
  onTaskCompletion: (task: VoiceMemoryTask, completed: boolean) => Promise<void>
  onArchive?: (task: VoiceMemoryTask) => Promise<void>
  onUnarchive?: (task: VoiceMemoryTask) => Promise<void>
  loadingTasks: Set<string>
  formatDate: (dateString: string) => string
  setFilter: (filter: { type: 'date', value: string }) => void
  taskFilter: string
  autoUnpinOnComplete: boolean
  onAutoUnpinToggle: (enabled: boolean) => void
}

export default function EnhancedTaskList({
  tasks,
  onPin,
  onUnpin,
  onTaskCompletion,
  onArchive,
  onUnarchive,
  loadingTasks,
  formatDate,
  setFilter,
  taskFilter,
  autoUnpinOnComplete,
  onAutoUnpinToggle
}: EnhancedTaskListProps) {
  const { isPinned } = usePinnedTasks()
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [bulkSelectionMode, setBulkSelectionMode] = useState(false)

  // Separate pinned and unpinned tasks
  const pinnedTasks = tasks.filter(task => isPinned(task.id))
  const unpinnedTasks = tasks.filter(task => !isPinned(task.id))

  // Filter unpinned tasks based on current filter
  const filteredUnpinnedTasks = unpinnedTasks.filter(task => {
    if (taskFilter === 'all') return true
    if (taskFilter === 'completed') return task.completed
    if (taskFilter === 'myTasks') return task.type === 'myTasks' && !task.completed
    if (taskFilter === 'delegatedTasks') return task.type === 'delegatedTasks' && !task.completed
    return task.type === taskFilter
  })

  // Toggle bulk selection mode
  const toggleBulkMode = useCallback(() => {
    setBulkSelectionMode(prev => {
      if (prev) {
        // Exiting bulk mode - clear selections
        setSelectedTaskIds([])
      }
      return !prev
    })
  }, [])

  // Handle individual task selection
  const handleTaskSelection = useCallback((taskId: string, selected: boolean) => {
    setSelectedTaskIds(prev => {
      if (selected) {
        return [...prev, taskId]
      } else {
        return prev.filter(id => id !== taskId)
      }
    })
  }, [])

  // Handle bulk selection changes
  const handleBulkSelectionChange = useCallback((taskIds: string[]) => {
    setSelectedTaskIds(taskIds)
  }, [])

  // Get all available tasks for bulk operations (both pinned and filtered unpinned)
  const allAvailableTasks = [...pinnedTasks, ...filteredUnpinnedTasks]

  return (
    <div className="space-y-6">
      {/* Pinned Tasks Section */}
      <PinnedTasksSection
        pinnedTasks={pinnedTasks}
        onPin={onPin}
        onUnpin={onUnpin}
        onTaskCompletion={onTaskCompletion}
        loadingTasks={loadingTasks}
        formatDate={formatDate}
        setFilter={setFilter}
        autoUnpinOnComplete={autoUnpinOnComplete}
        onAutoUnpinToggle={onAutoUnpinToggle}
      />

      {/* Task List Header with Bulk Selection Toggle */}
      {filteredUnpinnedTasks.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Tasks ({filteredUnpinnedTasks.length})
            </h3>
            
            {/* Filter Summary */}
            {taskFilter !== 'all' && (
              <span className="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-700">
                {taskFilter === 'completed' ? 'Completed Tasks' :
                 taskFilter === 'myTasks' ? 'My Tasks' :
                 taskFilter === 'delegatedTasks' ? 'Delegated Tasks' :
                 taskFilter}
              </span>
            )}
          </div>

          {/* Bulk Selection Toggle */}
          <button
            onClick={toggleBulkMode}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              bulkSelectionMode
                ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            data-testid="bulk-mode-toggle"
          >
            {bulkSelectionMode ? (
              <>
                <span className="mr-2">✓</span>
                Exit Bulk Mode
              </>
            ) : (
              <>
                <span className="mr-2">☐</span>
                Bulk Select
              </>
            )}
          </button>
        </div>
      )}

      {/* Bulk Actions Bar */}
      {bulkSelectionMode && (
        <BulkTaskActions
          tasks={allAvailableTasks}
          selectedTaskIds={selectedTaskIds}
          onSelectionChange={handleBulkSelectionChange}
          onPin={onPin}
          onUnpin={onUnpin}
          onTaskCompletion={onTaskCompletion}
        />
      )}

      {/* Task List */}
      {filteredUnpinnedTasks.length > 0 ? (
        <div className="space-y-3">
          {filteredUnpinnedTasks.map((task) => (
            bulkSelectionMode ? (
              <SelectableTaskCard
                key={task.id}
                task={task}
                isSelected={selectedTaskIds.includes(task.id)}
                onSelectionChange={handleTaskSelection}
                onPin={onPin}
                onUnpin={onUnpin}
                onTaskCompletion={onTaskCompletion}
                loadingTasks={loadingTasks}
                formatDate={formatDate}
                setFilter={setFilter}
              />
            ) : (
              <div
                key={task.id}
                className={`
                  bg-white rounded-lg border border-gray-200 p-4 
                  hover:border-gray-300 hover:shadow-sm transition-all duration-200
                  ${task.completed ? 'opacity-75' : ''}
                  ${isPinned(task.id) ? 'border-l-4 border-l-yellow-400' : ''}
                `}
                data-testid="regular-task-card"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {/* Completion Checkbox */}
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={(e) => onTaskCompletion(task, e.target.checked)}
                        disabled={loadingTasks.has(task.id)}
                        className="w-5 h-5 text-green-600 bg-white border-gray-300 rounded focus:ring-green-500 focus:ring-2 disabled:opacity-50"
                      />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={task.completed ? 'text-green-500' : 'text-gray-600'}>
                          {task.completed ? '✅' : (task.type === 'myTasks' ? '📋' : '👥')}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          task.completed
                            ? 'bg-green-100 text-green-700'
                            : task.type === 'myTasks'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {task.completed ? 'Completed' : task.type === 'myTasks' ? 'My Task' : 'Delegated'}
                        </span>
                        <span className="text-sm text-gray-500">
                          {formatDate(task.date)}
                        </span>
                        {task.completed && task.completedAt && (
                          <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                            ✓ {formatDate(task.completedAt)}
                          </span>
                        )}
                      </div>
                      
                      <p className={`font-medium mb-2 ${
                        task.completed ? 'text-gray-500 line-through' : 'text-gray-900'
                      }`}>
                        {task.description}
                      </p>
                    
                      {/* Additional task details */}
                      {task.assignedTo && (
                        <div className="mb-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            👤 Assigned to: {task.assignedTo}
                          </span>
                        </div>
                      )}
                      
                      {task.nextSteps && (
                        <div className="mb-2">
                          <div className="text-xs text-gray-500 mb-1">Next Steps:</div>
                          <p className="text-sm text-gray-600">{task.nextSteps}</p>
                        </div>
                      )}
                      
                      {task.completed && task.completedBy && (
                        <div className="mb-2">
                          <div className="text-xs text-green-600 mb-1">Completed by:</div>
                          <p className="text-sm text-green-700 font-medium">{task.completedBy}</p>
                        </div>
                      )}
                      
                      {task.noteContext && (
                        <div className="rounded p-3 bg-gray-50">
                          <div className="text-xs text-gray-500 mb-1">Context from note:</div>
                          <p className="text-sm italic text-gray-600">
                            "{task.noteContext}"
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    {/* Pin/Unpin Button */}
                    <button
                      onClick={() => isPinned(task.id) ? onUnpin(task.id) : onPin(task.id)}
                      disabled={loadingTasks.has(task.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        isPinned(task.id)
                          ? 'text-yellow-600 bg-yellow-50 hover:bg-yellow-100'
                          : 'text-gray-400 hover:text-yellow-600 hover:bg-yellow-50'
                      } ${loadingTasks.has(task.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={isPinned(task.id) ? 'Unpin task' : 'Pin task'}
                    >
                      {loadingTasks.has(task.id) ? (
                        <div className="w-4 h-4 animate-spin border-2 border-current border-t-transparent rounded-full" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16a2 2 0 01-2 2H7a2 2 0 01-2-2V5z" />
                        </svg>
                      )}
                    </button>
                    
                    {/* Archive Button (simplified for now) */}
                    {onArchive && (
                      <button
                        onClick={() => onArchive(task)}
                        disabled={loadingTasks.has(task.id)}
                        className={`p-2 rounded-lg transition-colors text-gray-400 hover:text-orange-600 hover:bg-orange-50 ${
                          loadingTasks.has(task.id) ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        title="Hide task"
                      >
                        {loadingTasks.has(task.id) ? (
                          <div className="w-4 h-4 animate-spin border-2 border-current border-t-transparent rounded-full" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    )}
                    
                    {/* View Source Note Button */}
                    <button
                      onClick={() => setFilter({ type: 'date', value: task.date.split('T')[0] })}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      title="View source note"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p>No tasks found for the current filter.</p>
          {taskFilter !== 'all' && (
            <button
              onClick={() => setFilter({ type: 'all', value: '' })}
              className="mt-2 text-blue-600 hover:text-blue-800 underline"
            >
              Show all tasks
            </button>
          )}
        </div>
      )}
    </div>
  )
}