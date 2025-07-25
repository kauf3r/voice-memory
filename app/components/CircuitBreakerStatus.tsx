'use client'

import { useProcessingStats } from '@/lib/hooks/use-processing-stats'
import { CircuitBreakerStatus as CircuitBreakerStatusType } from '@/lib/types'

function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return 'Never'
  
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  return 'Just now'
}

function getStatusInfo(status: CircuitBreakerStatusType | undefined) {
  if (!status) {
    return {
      color: 'gray',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      textColor: 'text-gray-600',
      label: 'Unknown',
      description: 'Circuit breaker status unavailable'
    }
  }

  if (status.isOpen) {
    return {
      color: 'red',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-600',
      label: 'Open',
      description: 'Processing is currently blocked due to repeated failures'
    }
  }

  if (status.failures > 0) {
    return {
      color: 'yellow',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-600',
      label: 'Degraded',
      description: 'Some failures detected, monitoring for issues'
    }
  }

  return {
    color: 'green',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-600',
    label: 'Healthy',
    description: 'Processing is operating normally'
  }
}

export function CircuitBreakerStatus() {
  const { data: stats, loading, error } = useProcessingStats({
    scope: 'global',
    refreshInterval: 10000
  })

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Circuit Breaker Status</h3>
        <div className="animate-pulse">
          <div className="h-16 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Circuit Breaker Status</h3>
        <div className="text-red-600 text-sm">
          Error loading circuit breaker status: {error}
        </div>
      </div>
    )
  }

  const circuitBreakerStatus = stats?.global_metrics?.circuit_breaker_status
  const statusInfo = getStatusInfo(circuitBreakerStatus)

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Circuit Breaker Status</h3>
      
      {/* Main Status Display */}
      <div className={`p-4 rounded-lg border ${statusInfo.bgColor} ${statusInfo.borderColor} mb-4`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-3 ${
              statusInfo.color === 'green' ? 'bg-green-500' :
              statusInfo.color === 'yellow' ? 'bg-yellow-500' :
              statusInfo.color === 'red' ? 'bg-red-500' : 'bg-gray-500'
            }`}></div>
            <span className={`font-semibold ${statusInfo.textColor}`}>
              {statusInfo.label}
            </span>
          </div>
          {circuitBreakerStatus && (
            <span className="text-sm text-gray-600">
              {circuitBreakerStatus.failures} failures
            </span>
          )}
        </div>
        <p className={`text-sm ${statusInfo.textColor} opacity-90`}>
          {statusInfo.description}
        </p>
      </div>

      {/* Detailed Information */}
      {circuitBreakerStatus && (
        <div className="space-y-3">
          {/* Failure Count */}
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">Current Failures</span>
            <span className="text-sm text-gray-900">{circuitBreakerStatus.failures}</span>
          </div>

          {/* Last Failure Time */}
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-700">Last Failure</span>
            <span className="text-sm text-gray-900">
              {formatRelativeTime(circuitBreakerStatus.lastFailureTime)}
            </span>
          </div>

          {/* Error Types Breakdown */}
          {circuitBreakerStatus.errorTypes && Object.keys(circuitBreakerStatus.errorTypes).length > 0 && (
            <div className="pt-2">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Error Types</h4>
              <div className="space-y-1">
                {Object.entries(circuitBreakerStatus.errorTypes)
                  .sort(([,a], [,b]) => b - a) // Sort by count descending
                  .map(([errorType, count]) => (
                    <div key={errorType} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 capitalize">
                        {errorType.replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-center">
                        <span className="text-gray-900 mr-2">{count}</span>
                        <div className="w-16 bg-gray-200 rounded-full h-1">
                          <div
                            className="bg-red-400 h-1 rounded-full"
                            style={{
                              width: `${Math.min(100, (count / Math.max(...Object.values(circuitBreakerStatus.errorTypes))) * 100)}%`
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status Explanation */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 mb-1">How it works</h4>
        <p className="text-xs text-gray-600">
          The circuit breaker monitors processing failures and automatically stops processing 
          when too many errors occur. It helps prevent cascade failures and gives the system 
          time to recover.
        </p>
      </div>
    </div>
  )
}