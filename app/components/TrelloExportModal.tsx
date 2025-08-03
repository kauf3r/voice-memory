'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface TrelloExportModalProps {
  tasksCount: number
  onClose: () => void
}

interface ExportOptions {
  boardName: string
  includeCompleted: boolean
  taskTypes: ('myTasks' | 'delegatedTasks')[]
  assignedTo: string[]
  dateRange?: {
    start: string
    end: string
  }
}

interface ExportResult {
  success: boolean
  boardId?: string
  boardUrl?: string
  tasksExported: number
  errors: string[]
  summary: {
    myTasks: number
    delegatedTasks: number
    withAssignments: number
    withNextSteps: number
  }
}

export default function TrelloExportModal({ tasksCount, onClose }: TrelloExportModalProps) {
  const [options, setOptions] = useState<ExportOptions>({
    boardName: `Voice Memory Tasks - ${new Date().toLocaleDateString()}`,
    includeCompleted: false,
    taskTypes: ['myTasks', 'delegatedTasks'],
    assignedTo: []
  })
  
  const [isExporting, setIsExporting] = useState(false)
  const [exportResult, setExportResult] = useState<ExportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [trelloConfigured, setTrelloConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    checkTrelloConfiguration()
  }, [])

  const checkTrelloConfiguration = async () => {
    try {
      const response = await fetch('/api/trello/export')
      const data = await response.json()
      setTrelloConfigured(data.configured)
    } catch (err) {
      console.error('Failed to check Trello configuration:', err)
      setTrelloConfigured(false)
    }
  }

  const handleExport = async () => {
    if (!trelloConfigured) {
      setError('Trello integration is not configured. Please contact your administrator.')
      return
    }

    setIsExporting(true)
    setError(null)
    
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        throw new Error('Authentication required. Please log in again.')
      }

      const response = await fetch('/api/trello/export', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(options)
      })

      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || data.details || 'Export failed')
      }

      setExportResult(data.result)
    } catch (err) {
      console.error('Export failed:', err)
      setError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const handleClose = () => {
    if (!isExporting) {
      onClose()
    }
  }

  // If Trello is not configured, show configuration message
  if (trelloConfigured === false) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Trello Export</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>
          
          <div className="text-center py-8">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Trello Integration Required</h3>
            <p className="text-gray-600 mb-4">
              To export tasks to Trello, the administrator needs to configure Trello API credentials.
            </p>
            <p className="text-sm text-gray-500">
              Contact your system administrator to set up the TRELLO_API_KEY and TRELLO_TOKEN environment variables.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleClose}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Show export success
  if (exportResult && exportResult.success) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
          <div className="text-center">
            <div className="mb-4">
              <svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Export Successful!</h2>
            <p className="text-gray-600 mb-6">
              Successfully exported {exportResult.tasksExported} tasks to Trello
            </p>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-gray-900 mb-2">Export Summary</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">My Tasks:</span>
                  <span className="font-medium ml-2">{exportResult.summary.myTasks}</span>
                </div>
                <div>
                  <span className="text-gray-600">Delegated:</span>
                  <span className="font-medium ml-2">{exportResult.summary.delegatedTasks}</span>
                </div>
                <div>
                  <span className="text-gray-600">With Assignments:</span>
                  <span className="font-medium ml-2">{exportResult.summary.withAssignments}</span>
                </div>
                <div>
                  <span className="text-gray-600">With Next Steps:</span>
                  <span className="font-medium ml-2">{exportResult.summary.withNextSteps}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <a
                href={exportResult.boardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 text-center"
              >
                Open Trello Board
              </a>
              <button
                onClick={handleClose}
                className="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Main export modal
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Export to Trello</h2>
            <p className="text-gray-600 mt-1">
              Export {tasksCount} tasks to a new Trello board
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isExporting}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold disabled:cursor-not-allowed"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {/* Board Name */}
            <div>
              <label htmlFor="boardName" className="block text-sm font-medium text-gray-700 mb-2">
                Board Name
              </label>
              <input
                type="text"
                id="boardName"
                name="boardName"
                value={options.boardName}
                onChange={(e) => setOptions(prev => ({ ...prev, boardName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter Trello board name"
                disabled={isExporting}
              />
            </div>

            {/* Task Types */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Task Types to Export
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    id="trello-my-tasks"
                    name="trello-my-tasks"
                    checked={options.taskTypes.includes('myTasks')}
                    onChange={(e) => {
                      const newTypes = e.target.checked
                        ? [...options.taskTypes, 'myTasks' as const]
                        : options.taskTypes.filter(t => t !== 'myTasks')
                      setOptions(prev => ({ ...prev, taskTypes: newTypes as ('myTasks' | 'delegatedTasks')[] }))
                    }}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    disabled={isExporting}
                    aria-label="Include my tasks in Trello export"
                  />
                  <span className="ml-2 text-sm text-gray-700">My Tasks</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    id="trello-delegated-tasks"
                    name="trello-delegated-tasks"
                    checked={options.taskTypes.includes('delegatedTasks')}
                    onChange={(e) => {
                      const newTypes = e.target.checked
                        ? [...options.taskTypes, 'delegatedTasks' as const]
                        : options.taskTypes.filter(t => t !== 'delegatedTasks')
                      setOptions(prev => ({ ...prev, taskTypes: newTypes as ('myTasks' | 'delegatedTasks')[] }))
                    }}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    disabled={isExporting}
                  />
                  <span className="ml-2 text-sm text-gray-700">Delegated Tasks</span>
                </label>
              </div>
            </div>

            {/* Include Completed */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  id="trello-include-completed"
                  name="trello-include-completed"
                  checked={options.includeCompleted}
                  onChange={(e) => setOptions(prev => ({ ...prev, includeCompleted: e.target.checked }))}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  disabled={isExporting}
                  aria-label="Include completed tasks in Trello export"
                />
                <span className="ml-2 text-sm text-gray-700">Include completed tasks</span>
              </label>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Range (Optional)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="startDate" className="block text-xs text-gray-500 mb-1">From</label>
                  <input
                    type="date"
                    id="startDate"
                    name="startDate"
                    value={options.dateRange?.start || ''}
                    onChange={(e) => setOptions(prev => ({
                      ...prev,
                      dateRange: e.target.value ? {
                        start: e.target.value,
                        end: prev.dateRange?.end || e.target.value
                      } : undefined
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={isExporting}
                  />
                </div>
                <div>
                  <label htmlFor="endDate" className="block text-xs text-gray-500 mb-1">To</label>
                  <input
                    type="date"
                    id="endDate"
                    name="endDate"
                    value={options.dateRange?.end || ''}
                    onChange={(e) => setOptions(prev => ({
                      ...prev,
                      dateRange: prev.dateRange?.start ? {
                        start: prev.dateRange.start,
                        end: e.target.value
                      } : undefined
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={isExporting}
                    min={options.dateRange?.start}
                  />
                </div>
              </div>
            </div>

            {/* Export Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">Export Details</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Creates a new Trello board with organized lists</li>
                      <li>Preserves all task metadata and context</li>
                      <li>Includes assignments and next steps for delegated tasks</li>
                      <li>Links back to original Voice Memory notes</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              {options.taskTypes.length === 0 ? 'Please select at least one task type' : 
               `Ready to export ${options.taskTypes.join(' and ')} to Trello`}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                disabled={isExporting}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting || options.taskTypes.length === 0 || !options.boardName.trim()}
                className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 flex items-center"
              >
                {isExporting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Exporting...
                  </>
                ) : (
                  'Export to Trello'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}