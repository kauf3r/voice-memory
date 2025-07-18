'use client'

import { useState, useEffect } from 'react'
import { useAuth } from './AuthProvider'
import LoadingSpinner from './LoadingSpinner'
import ErrorMessage from './ErrorMessage'

interface ProcessingStats {
  total: number
  pending: number
  processing: number
  completed: number
  failed: number
}

interface ProcessingStatusProps {
  onStatsUpdate?: (stats: ProcessingStats) => void
}

export default function ProcessingStatus({ onStatsUpdate }: ProcessingStatusProps) {
  const { user } = useAuth()
  const [stats, setStats] = useState<ProcessingStats>({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const fetchStats = async () => {
    if (!user) return

    try {
      setError(null)
      const response = await fetch('/api/process/batch')
      
      if (!response.ok) {
        throw new Error('Failed to fetch processing stats')
      }

      const data = await response.json()
      setStats(data.stats)
      onStatsUpdate?.(data.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats')
    } finally {
      setLoading(false)
    }
  }

  const triggerBatchProcessing = async () => {
    if (!user || isProcessing) return

    setIsProcessing(true)
    setError(null)

    try {
      const response = await fetch('/api/process/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ batchSize: 5 }),
      })

      if (!response.ok) {
        throw new Error('Batch processing failed')
      }

      const result = await response.json()
      
      if (result.errors && result.errors.length > 0) {
        console.warn('Processing completed with errors:', result.errors)
      }

      // Refresh stats after processing
      await fetchStats()

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch processing failed')
    } finally {
      setIsProcessing(false)
    }
  }

  useEffect(() => {
    fetchStats()
    
    // Auto-refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [user])

  if (!user) return null

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center">
          <LoadingSpinner size="sm" />
          <span className="ml-2 text-sm text-gray-600">Loading processing status...</span>
        </div>
      </div>
    )
  }

  const hasPendingWork = stats.pending > 0 || stats.processing > 0

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Processing Status</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchStats}
            disabled={loading}
            className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          {hasPendingWork && (
            <button
              onClick={triggerBatchProcessing}
              disabled={isProcessing}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-3 py-1 rounded-md font-medium"
            >
              {isProcessing ? (
                <div className="flex items-center">
                  <LoadingSpinner size="sm" />
                  <span className="ml-1">Processing...</span>
                </div>
              ) : (
                'Process Now'
              )}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorMessage message={error} onRetry={() => setError(null)} />
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="text-center">
          <div className="text-2xl font-semibold text-gray-900">{stats.total}</div>
          <div className="text-xs text-gray-500">Total</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-semibold text-yellow-600">{stats.pending}</div>
          <div className="text-xs text-gray-500">Pending</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-semibold text-blue-600">{stats.processing}</div>
          <div className="text-xs text-gray-500">Processing</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-semibold text-green-600">{stats.completed}</div>
          <div className="text-xs text-gray-500">Completed</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-semibold text-red-600">{stats.failed}</div>
          <div className="text-xs text-gray-500">Failed</div>
        </div>
      </div>

      {/* Progress Bar */}
      {stats.total > 0 && (
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Progress</span>
            <span>{Math.round((stats.completed / stats.total) * 100)}%</span>
          </div>
          <div className="bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(stats.completed / stats.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Status Messages */}
      <div className="mt-4 text-sm">
        {stats.total === 0 ? (
          <p className="text-gray-500">No notes to process</p>
        ) : stats.pending === 0 && stats.processing === 0 && stats.failed === 0 ? (
          <p className="text-green-600">✅ All notes processed successfully</p>
        ) : stats.pending > 0 ? (
          <p className="text-yellow-600">
            ⏳ {stats.pending} note{stats.pending !== 1 ? 's' : ''} waiting to be processed
          </p>
        ) : stats.processing > 0 ? (
          <p className="text-blue-600">
            🔄 {stats.processing} note{stats.processing !== 1 ? 's' : ''} currently processing
          </p>
        ) : stats.failed > 0 ? (
          <p className="text-red-600">
            ❌ {stats.failed} note{stats.failed !== 1 ? 's' : ''} failed to process
          </p>
        ) : null}
      </div>
    </div>
  )
}