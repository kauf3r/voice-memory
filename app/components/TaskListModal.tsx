'use client'

import { useState, useEffect } from 'react'
import { VoiceMemoryTask } from '@/lib/types'
import EnhancedTaskList from './EnhancedTaskList'
import { usePinnedTasks } from './PinnedTasksProvider'
import { useAuth } from './AuthProvider'
import { supabase } from '@/lib/supabase'
import { useToast } from './ToastProvider'

interface TaskListModalProps {
  isOpen: boolean
  onClose: () => void
  initialTasks?: VoiceMemoryTask[]
}

export default function TaskListModal({ isOpen, onClose, initialTasks }: TaskListModalProps) {
  const { user } = useAuth()
  const { pinTask, unpinTask } = usePinnedTasks()
  const { showToast } = useToast()
  const [tasks, setTasks] = useState<VoiceMemoryTask[]>(initialTasks || [])
  const [loading, setLoading] = useState(!initialTasks)
  const [loadingTasks, setLoadingTasks] = useState<Set<string>>(new Set())
  const [taskFilter, setTaskFilter] = useState('all')
  const [autoUnpinOnComplete, setAutoUnpinOnComplete] = useState(true)

  useEffect(() => {
    if (!isOpen || !user || initialTasks) return

    fetchTasks()
  }, [isOpen, user])

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

      const response = await fetch(`/api/tasks 2/${task.id}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ completed })
      })

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold">Tasks</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="px-4 sm:px-6 pt-4 border-b">
          <div className="flex space-x-2 sm:space-x-4 overflow-x-auto">
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
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
              loadingTasks={loadingTasks}
              formatDate={formatDate}
              setFilter={(filter) => setTaskFilter(filter.value)}
              taskFilter={taskFilter}
              autoUnpinOnComplete={autoUnpinOnComplete}
              onAutoUnpinToggle={setAutoUnpinOnComplete}
            />
          )}
        </div>
      </div>
    </div>
  )
}