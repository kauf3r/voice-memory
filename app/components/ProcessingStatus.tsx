'use client'

import { useProcessingStats } from '@/lib/hooks/use-processing-stats'

interface ProcessingStatusProps {
  userId?: string
  onRefresh?: () => void
}

export function ProcessingStatus({ userId, onRefresh }: ProcessingStatusProps) {
  const { data: stats, loading: isLoading, error, refresh } = useProcessingStats({
    scope: 'user',
    refreshInterval: 30000,
    enabled: true
  })

  const handleManualRefresh = () => {
    refresh()
  }

  if (isLoading || !stats) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Processing Status</h3>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Processing Status</h3>
        <div className="text-red-600 text-sm">
          Error: {error}
          <button
            onClick={handleManualRefresh}
            className="ml-2 text-blue-600 hover:text-blue-800 underline"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'processing': return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'completed': return 'text-green-600 bg-green-50 border-green-200'
      case 'failed': return 'text-red-600 bg-red-50 border-red-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳'
      case 'processing': return '🔄'
      case 'completed': return '✅'
      case 'failed': return '❌'
      default: return '📊'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Processing Status</h3>
        <button
          onClick={handleManualRefresh}
          className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
          title="Refresh status"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="space-y-3">
        {/* Total */}
        <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 border-gray-200">
          <div className="flex items-center">
            <span className="mr-2">📊</span>
            <span className="font-medium text-gray-900">Total Notes</span>
          </div>
          <span className="text-gray-900 font-semibold">{stats.total}</span>
        </div>

        {/* Pending */}
        <div className={`flex items-center justify-between p-3 border rounded-lg ${getStatusColor('pending')}`}>
          <div className="flex items-center">
            <span className="mr-2">{getStatusIcon('pending')}</span>
            <span className="font-medium">Pending</span>
            <span className="ml-1 text-xs opacity-75">(waiting to process)</span>
          </div>
          <span className="font-semibold">{stats.pending}</span>
        </div>

        {/* Processing */}
        <div className={`flex items-center justify-between p-3 border rounded-lg ${getStatusColor('processing')}`}>
          <div className="flex items-center">
            <span className="mr-2">{getStatusIcon('processing')}</span>
            <span className="font-medium">Processing</span>
            <span className="ml-1 text-xs opacity-75">(actively being processed)</span>
          </div>
          <span className="font-semibold">{stats.processing}</span>
        </div>

        {/* Completed */}
        <div className={`flex items-center justify-between p-3 border rounded-lg ${getStatusColor('completed')}`}>
          <div className="flex items-center">
            <span className="mr-2">{getStatusIcon('completed')}</span>
            <span className="font-medium">Completed</span>
          </div>
          <span className="font-semibold">{stats.completed}</span>
        </div>

        {/* Failed */}
        {stats.failed > 0 && (
          <div className={`flex items-center justify-between p-3 border rounded-lg ${getStatusColor('failed')}`}>
            <div className="flex items-center">
              <span className="mr-2">{getStatusIcon('failed')}</span>
              <span className="font-medium">Failed</span>
              {stats.errorRate && (
                <span className="ml-1 text-xs opacity-75">
                  ({stats.errorRate.toFixed(1)}% error rate)
                </span>
              )}
            </div>
            <span className="font-semibold">{stats.failed}</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {stats.total > 0 && (
        <div className="mt-4">
          <div className="flex text-xs text-gray-600 mb-2">
            <span>Progress: {stats.completed} of {stats.total} completed</span>
            {stats.processing > 0 && (
              <span className="ml-auto text-blue-600">
                {stats.processing} currently processing
              </span>
            )}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(stats.completed / stats.total) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Processing lock info */}
      {stats.processing > 0 && (
        <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
          <div className="flex items-center">
            <span className="mr-1">🔒</span>
            <span>
              Notes marked as "processing" are currently locked to prevent 
              concurrent processing. They will complete automatically or timeout after 15 minutes.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}