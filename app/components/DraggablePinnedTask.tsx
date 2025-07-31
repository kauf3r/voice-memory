'use client'

import { useState, useRef } from 'react'
import { VoiceMemoryTask } from '@/lib/types'
import PinButton from './PinButton'

interface DraggablePinnedTaskProps {
  task: VoiceMemoryTask
  index: number
  onPin: (taskId: string) => Promise<void>
  onUnpin: (taskId: string) => Promise<void>
  onTaskCompletion: (task: VoiceMemoryTask, completed: boolean) => Promise<void>
  onReorder: (taskId: string, newIndex: number) => Promise<void>
  loadingTasks: Set<string>
  formatDate: (dateString: string) => string
  setFilter: (filter: { type: 'date', value: string }) => void
  totalPinnedTasks: number
}

export default function DraggablePinnedTask({
  task,
  index,
  onPin,
  onUnpin,
  onTaskCompletion,
  onReorder,
  loadingTasks,
  formatDate,
  setFilter,
  totalPinnedTasks
}: DraggablePinnedTaskProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const dragItemRef = useRef<HTMLDivElement>(null)
  const dragCounter = useRef(0)

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true)
    e.dataTransfer.setData('text/plain', JSON.stringify({
      taskId: task.id,
      sourceIndex: index
    }))
    e.dataTransfer.effectAllowed = 'move'
    
    // Add drag image styling
    if (dragItemRef.current) {
      dragItemRef.current.style.opacity = '0.5'
    }
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    setDragOverIndex(null)
    
    // Reset styling
    if (dragItemRef.current) {
      dragItemRef.current.style.opacity = '1'
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    setDragOverIndex(index)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    dragCounter.current--
    if (dragCounter.current === 0) {
      setDragOverIndex(null)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setDragOverIndex(null)

    try {
      const dragData = JSON.parse(e.dataTransfer.getData('text/plain'))
      const { taskId, sourceIndex } = dragData

      // Don't reorder if dropping on the same position
      if (sourceIndex === index) {
        return
      }

      console.log(`🔄 Reordering task ${taskId} from ${sourceIndex} to ${index}`)
      await onReorder(taskId, index)
    } catch (error) {
      console.error('Error handling drop:', error)
    }
  }

  const dragIndicatorClass = dragOverIndex === index 
    ? index < (totalPinnedTasks - 1) 
      ? 'border-t-4 border-blue-400' 
      : 'border-b-4 border-blue-400'
    : ''

  return (
    <div
      ref={dragItemRef}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        bg-yellow-100/80 rounded-lg border border-yellow-300/50 p-4 
        hover:shadow-lg hover:bg-yellow-100 hover:-translate-y-1
        transition-all duration-300 ease-out cursor-move
        ${task.completed ? 'opacity-75' : ''}
        ${isDragging ? 'opacity-50 transform rotate-2 scale-105' : ''}
        ${dragIndicatorClass}
        relative animate-in slide-in-from-top-2 fade-in
      `}
      style={{
        transform: `rotate(${isDragging ? 2 : (index % 2 === 0 ? -0.5 : 0.5)}deg)`,
        transformOrigin: 'center',
        animationDelay: `${index * 100}ms`
      }}
      data-testid="draggable-pinned-task"
    >
      {/* Drag handle indicator */}
      <div className="absolute top-2 left-2 text-yellow-600 opacity-50 hover:opacity-100 transition-opacity">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
        </svg>
      </div>
      
      {/* Cork board pin effect */}
      <div className="absolute -top-1 -right-1 text-yellow-600 text-sm">📍</div>
      
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1 ml-6"> {/* Add margin for drag handle */}
          {/* Completion Checkbox */}
          <div className="pt-1">
            <input
              type="checkbox"
              checked={task.completed}
              onChange={(e) => onTaskCompletion(task, e.target.checked)}
              disabled={loadingTasks.has(task.id)}
              className="w-5 h-5 text-green-600 bg-yellow-50 border-yellow-400 rounded focus:ring-green-500 focus:ring-2 disabled:opacity-50"
            />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={task.completed ? 'text-green-500' : 'text-yellow-600'}>
                {task.completed ? '✅' : (task.type === 'myTasks' ? '📋' : '👥')}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                task.completed
                  ? 'bg-green-100 text-green-700'
                  : task.type === 'myTasks'
                  ? 'bg-yellow-200 text-yellow-800'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {task.completed ? 'Completed' : task.type === 'myTasks' ? 'My Task' : 'Delegated'}
              </span>
              <span className="text-sm text-yellow-700">
                {formatDate(task.date)}
              </span>
              {task.completed && task.completedAt && (
                <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                  ✓ {formatDate(task.completedAt)}
                </span>
              )}
              {task.pinnedAt && (
                <span className="text-xs text-yellow-600 bg-yellow-200 px-2 py-1 rounded">
                  📌 {formatDate(task.pinnedAt)}
                </span>
              )}
            </div>
            
            <p className={`font-medium mb-2 ${
              task.completed ? 'text-yellow-600 line-through' : 'text-yellow-900'
            }`}>
              {task.description}
            </p>
          
            {/* Additional task details */}
            {task.assignedTo && (
              <div className="mb-2">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  👤 Assigned to: {task.assignedTo}
                </span>
              </div>
            )}
            
            {task.nextSteps && (
              <div className="mb-2">
                <div className="text-xs text-yellow-600 mb-1">Next Steps:</div>
                <p className={`text-sm ${task.completed ? 'text-yellow-600' : 'text-yellow-800'}`}>
                  {task.nextSteps}
                </p>
              </div>
            )}
            
            {task.completed && task.completedBy && (
              <div className="mb-2">
                <div className="text-xs text-green-600 mb-1">Completed by:</div>
                <p className="text-sm text-green-700 font-medium">{task.completedBy}</p>
              </div>
            )}
            
            {task.noteContext && (
              <div className={`rounded p-3 ${task.completed ? 'bg-yellow-100' : 'bg-yellow-50'}`}>
                <div className="text-xs text-yellow-600 mb-1">Context from note:</div>
                <p className={`text-sm italic ${task.completed ? 'text-yellow-600' : 'text-yellow-700'}`}>
                  "{task.noteContext}"
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 ml-4">
          <PinButton
            task={task}
            onPin={onPin}
            onUnpin={onUnpin}
            disabled={loadingTasks.has(task.id)}
          />
          <button
            onClick={() => setFilter({ type: 'date', value: task.date.split('T')[0] })}
            className="text-yellow-500 hover:text-yellow-700 transition-colors"
            title="View source note"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Drop indicator */}
      {dragOverIndex === index && (
        <div className="absolute -inset-1 border-2 border-dashed border-blue-400 rounded-lg pointer-events-none opacity-50" />
      )}
    </div>
  )
}