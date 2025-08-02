'use client'

import { useState, useEffect, useRef } from 'react'
import { VoiceMemoryTask } from '@/lib/types'
import EnhancedTaskList from './EnhancedTaskList'
import { usePinnedTasks } from './PinnedTasksProvider'
import { useAuth } from './AuthProvider'
import { supabase } from '@/lib/supabase'
import { useToast } from './ToastProvider'

interface TaskSlideoutPanelProps {
  isOpen: boolean
  onClose: () => void
  initialTasks?: VoiceMemoryTask[]
  highlightTaskId?: string
}

export default function TaskSlideoutPanel({ 
  isOpen, 
  onClose, 
  initialTasks,
  highlightTaskId 
}: TaskSlideoutPanelProps) {
  const { user } = useAuth()
  const { pinTask, unpinTask } = usePinnedTasks()
  const { showToast } = useToast()
  const [tasks, setTasks] = useState<VoiceMemoryTask[]>(initialTasks || [])
  const [loading, setLoading] = useState(!initialTasks)
  const [loadingTasks, setLoadingTasks] = useState<Set<string>>(new Set())
  const [taskFilter, setTaskFilter] = useState('all')
  const [autoUnpinOnComplete, setAutoUnpinOnComplete] = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)
  const [touchStartX, setTouchStartX] = useState(0)

  useEffect(() => {
    if (!isOpen || !user || initialTasks) return

    fetchTasks()
  }, [isOpen, user])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when panel is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  // Handle swipe to close on mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX
    const swipeDistance = touchEndX - touchStartX
    
    // If swiped right more than 100px, close the panel
    if (swipeDistance > 100) {
      onClose()
    }
  }

  const fetchTasks = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('No valid session')
      }

      const response = await fetch('/api/tasks 2', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch tasks')
      }

      const data = await response.json()
      setTasks(data.tasks || [])
    } catch (error) {
      console.error('Error fetching tasks:', error)
      showToast('Failed to load tasks', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleTaskCompletion = async (task: VoiceMemoryTask, completed: boolean) => {
    setLoadingTasks(prev => new Set(prev).add(task.id))

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('No valid session')
      }

      let response
      if (completed) {
        // Mark task as complete using POST
        response = await fetch(`/api/tasks 2/${task.id}/complete`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        })
      } else {
        // Mark task as incomplete using DELETE
        response = await fetch(`/api/tasks 2/${task.id}/complete`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        })
      }

      if (!response.ok) {
        throw new Error('Failed to update task')
      }

      // Update local state
      setTasks(prev => prev.map(t => 
        t.id === task.id ? { ...t, completed } : t
      ))

      showToast(
        completed ? 'Task marked as completed' : 'Task marked as incomplete',
        'success'
      )

      // Auto-unpin if enabled and task is completed
      if (completed && autoUnpinOnComplete && usePinnedTasks().isPinned(task.id)) {
        await unpinTask(task.id)
      }
    } catch (error) {
      console.error('Error updating task:', error)
      showToast('Failed to update task', 'error')
    } finally {
      setLoadingTasks(prev => {
        const next = new Set(prev)
        next.delete(task.id)
        return next
      })
    }
  }

  const handlePin = async (taskId: string) => {
    try {
      await pinTask(taskId)
      showToast('Task pinned successfully', 'success')
    } catch (error) {
      console.error('Error pinning task:', error)
      showToast('Failed to pin task', 'error')
    }
  }

  const handleUnpin = async (taskId: string) => {
    try {
      await unpinTask(taskId)
      showToast('Task unpinned successfully', 'success')
    } catch (error) {
      console.error('Error unpinning task:', error)
      showToast('Failed to unpin task', 'error')
    }
  }

  const handleArchive = async (task: VoiceMemoryTask) => {
    // For now, just hide the task from the current view
    // We'll implement full archive functionality later
    setTasks(prev => prev.filter(t => t.id !== task.id))
    showToast('Task hidden from view (archive feature coming soon)', 'success')
  }

  const handleUnarchive = async (task: VoiceMemoryTask) => {
    // Placeholder for unarchive functionality
    showToast('Unarchive feature coming soon', 'info')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black transition-opacity duration-300 z-40 ${
          isOpen ? 'bg-opacity-50' : 'bg-opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Slide-out Panel */}
      <div
        ref={panelRef}
        className={`fixed top-0 right-0 h-full bg-white shadow-xl z-50 transition-transform duration-300 transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } w-full md:w-[400px] lg:w-[500px]`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-center p-4 md:p-6 border-b">
            <h2 className="text-xl md:text-2xl font-bold">Tasks</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 p-2"
              aria-label="Close tasks panel"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="px-4 md:px-6 pt-4 border-b">
            <div className="flex space-x-4 overflow-x-auto scrollbar-hide">
              {[
                { id: 'all', label: 'All Tasks' },
                { id: 'myTasks', label: 'My Tasks' },
                { id: 'delegatedTasks', label: 'Delegated' },
                { id: 'completed', label: 'Completed' }
              ].map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setTaskFilter(filter.id)}
                  className={`pb-2 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                    taskFilter === filter.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Task List */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2">Loading tasks...</span>
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No tasks found</p>
              </div>
            ) : (
              <EnhancedTaskList
                tasks={tasks}
                onPin={handlePin}
                onUnpin={handleUnpin}
                onTaskCompletion={handleTaskCompletion}
                onArchive={handleArchive}
                onUnarchive={handleUnarchive}
                loadingTasks={loadingTasks}
                formatDate={formatDate}
                setFilter={(filter) => setTaskFilter(filter.value)}
                taskFilter={taskFilter}
                autoUnpinOnComplete={autoUnpinOnComplete}
                onAutoUnpinToggle={setAutoUnpinOnComplete}
              />
            )}
          </div>

          {/* Mobile swipe indicator */}
          <div className="md:hidden absolute left-0 top-1/2 -translate-y-1/2 w-1 h-20 bg-gray-300 rounded-r-full" />
        </div>
      </div>
    </>
  )
}