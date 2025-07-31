'use client'

import React, { useState, useEffect } from 'react'
import { errorTracker } from '@/lib/monitoring/errorTracking'

interface ErrorReport {
  id: string
  timestamp: Date
  level: 'error' | 'warning' | 'info'
  message: string
  stack?: string
  context: {
    user_id?: string
    route: string
    component?: string
    browser?: string
    device?: string
    session_id?: string
  }
  metadata?: Record<string, any>
}

interface MetricStats {
  count: number
  avg: number
  min: number
  max: number
  percentiles: {
    p50: number
    p90: number
    p95: number
    p99: number
  }
}

export default function MonitoringDashboard() {
  const [errors, setErrors] = useState<ErrorReport[]>([])
  const [metrics, setMetrics] = useState<any[]>([])
  const [metricStats, setMetricStats] = useState<MetricStats | null>(null)
  const [selectedLevel, setSelectedLevel] = useState<'all' | 'error' | 'warning' | 'info'>('all')
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    loadErrors()
    loadMetrics()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadErrors()
      loadMetrics()
    }, 30000)

    return () => clearInterval(interval)
  }, [selectedLevel])

  const loadErrors = async () => {
    try {
      const url = selectedLevel === 'all' 
        ? '/api/monitoring/error' 
        : `/api/monitoring/error?level=${selectedLevel}`
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.errors) {
        setErrors(data.errors.map((e: any) => ({
          ...e,
          timestamp: new Date(e.timestamp)
        })))
      }
    } catch (error) {
      console.error('Failed to load errors:', error)
    }
  }

  const loadMetrics = async () => {
    try {
      const response = await fetch('/api/monitoring/metrics')
      const data = await response.json()
      
      if (data.metrics) {
        setMetrics(data.metrics)
        setMetricStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to load metrics:', error)
    }
  }

  const getErrorCountByLevel = (level: string) => {
    return errors.filter(e => e.level === level).length
  }

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleString()
  }

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsVisible(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-full text-sm font-medium shadow-lg"
          title="Open Monitoring Dashboard"
        >
          📊 Monitor
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <h2 className="text-xl font-semibold text-gray-900">Production Monitoring Dashboard</h2>
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-500 hover:text-gray-700 text-xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[80vh]">
          {/* Error Summary */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Error Summary</h3>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="bg-red-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{getErrorCountByLevel('error')}</div>
                <div className="text-sm text-red-800">Errors</div>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{getErrorCountByLevel('warning')}</div>
                <div className="text-sm text-yellow-800">Warnings</div>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{getErrorCountByLevel('info')}</div>
                <div className="text-sm text-blue-800">Info</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">{errors.length}</div>
                <div className="text-sm text-gray-800">Total</div>
              </div>
            </div>

            {/* Filter */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Level:</label>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value as any)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="all">All Levels</option>
                <option value="error">Errors Only</option>
                <option value="warning">Warnings Only</option>
                <option value="info">Info Only</option>
              </select>
            </div>
          </div>

          {/* Performance Metrics */}
          {metricStats && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Performance Statistics</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="text-lg font-bold text-green-600">{metricStats.avg}ms</div>
                  <div className="text-sm text-green-800">Average</div>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-lg font-bold text-blue-600">{metricStats.percentiles.p95}ms</div>
                  <div className="text-sm text-blue-800">95th Percentile</div>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <div className="text-lg font-bold text-purple-600">{metricStats.count}</div>
                  <div className="text-sm text-purple-800">Total Metrics</div>
                </div>
              </div>
            </div>
          )}

          {/* Recent Errors */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Recent Errors</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {errors.length === 0 ? (
                <div className="text-gray-500 text-center py-4">No errors found</div>
              ) : (
                errors.slice(0, 20).map((error) => (
                  <div key={error.id} className={`p-3 rounded-lg border-l-4 ${
                    error.level === 'error' ? 'bg-red-50 border-red-400' :
                    error.level === 'warning' ? 'bg-yellow-50 border-yellow-400' :
                    'bg-blue-50 border-blue-400'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{error.message}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          Route: {error.context.route} | Component: {error.context.component || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {formatTimestamp(error.timestamp)} | Session: {error.context.session_id?.slice(-8)}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        error.level === 'error' ? 'bg-red-100 text-red-800' :
                        error.level === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {error.level.toUpperCase()}
                      </span>
                    </div>
                    {error.stack && (
                      <details className="mt-2">
                        <summary className="text-sm text-gray-600 cursor-pointer">Show Stack Trace</summary>
                        <pre className="text-xs text-gray-800 mt-2 bg-gray-100 p-2 rounded overflow-x-auto">
                          {error.stack}
                        </pre>
                      </details>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                loadErrors()
                loadMetrics()
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium"
            >
              🔄 Refresh
            </button>
            <button
              onClick={() => {
                errorTracker.clearErrors()
                setErrors([])
              }}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium"
            >
              🗑️ Clear Local
            </button>
            <div className="text-sm text-gray-500">
              Auto-refreshes every 30 seconds
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}