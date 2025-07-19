'use client'

import { useState, useEffect } from 'react'
import { useAuth } from './AuthProvider'
import { supabase } from '@/lib/supabase'
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
      
      // Get current session for authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session?.access_token) {
        throw new Error('Not authenticated')
      }
      
      const response = await fetch('/api/process/batch', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })
      
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
      // Get current session for authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session?.access_token) {
        throw new Error('Not authenticated')
      }
      
      const response = await fetch('/api/process/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
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

      {/* Simplified Status Display */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-lg font-medium text-gray-900">{stats.completed}</span>
            <span className="text-sm text-gray-500 ml-1">processed</span>
          </div>
          <div>
            <span className="text-lg font-medium text-orange-600">{stats.pending + stats.processing}</span>
            <span className="text-sm text-gray-500 ml-1">in queue</span>
          </div>
          <div>
            <span className="text-lg font-medium text-blue-600">{stats.total}</span>
            <span className="text-sm text-gray-500 ml-1">total</span>
          </div>
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

      {/* Status Message */}
      <div className="mt-4 text-sm text-center">
        {stats.total === 0 ? (
          <p className="text-gray-500">Upload audio files to get started</p>
        ) : stats.pending === 0 && stats.processing === 0 ? (
          <p className="text-green-600">✅ All notes processed</p>
        ) : (
          <p className="text-orange-600">
            🔄 Processing {stats.pending + stats.processing} notes...
          </p>
        )}
      </div>
    </div>
  )
}