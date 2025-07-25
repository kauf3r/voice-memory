'use client'

import { useProcessingStats } from '@/lib/hooks/use-processing-stats'
import { SummaryMetrics } from '@/lib/types'

function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) return `${Math.round(milliseconds)}ms`
  if (milliseconds < 60000) return `${(milliseconds / 1000).toFixed(1)}s`
  if (milliseconds < 3600000) return `${(milliseconds / 60000).toFixed(1)}m`
  return `${(milliseconds / 3600000).toFixed(1)}h`
}

function formatUptime(uptimeMs: number): string {
  const seconds = Math.floor(uptimeMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

function getTrendIndicator(current: number, threshold: number, type: 'success' | 'error' = 'success') {
  if (type === 'success') {
    if (current >= threshold) return { icon: '↗️', color: 'text-green-600', label: 'Good' }
    if (current >= threshold * 0.8) return { icon: '→', color: 'text-yellow-600', label: 'Fair' }
    return { icon: '↘️', color: 'text-red-600', label: 'Poor' }
  } else {
    if (current <= threshold) return { icon: '↘️', color: 'text-green-600', label: 'Good' }
    if (current <= threshold * 2) return { icon: '→', color: 'text-yellow-600', label: 'Fair' }
    return { icon: '↗️', color: 'text-red-600', label: 'Poor' }
  }
}

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: string
  trend?: {
    icon: string
    color: string
    label: string
  }
  color?: string
}

function MetricCard({ title, value, subtitle, icon, trend, color = 'text-gray-900' }: MetricCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {icon && <span className="text-2xl mr-3">{icon}</span>}
          <div>
            <h3 className="text-sm font-medium text-gray-700">{title}</h3>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
          </div>
        </div>
        {trend && (
          <div className="text-right">
            <div className={`text-lg ${trend.color}`}>{trend.icon}</div>
            <span className={`text-xs ${trend.color}`}>{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function ProcessingMetricsSummary() {
  const { data: stats, loading, error, lastUpdated } = useProcessingStats({
    scope: 'global',
    refreshInterval: 10000
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">Processing Metrics Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6 border border-gray-200">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border border-red-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Processing Metrics Overview</h2>
        <div className="text-red-600 text-sm">
          Error loading processing metrics: {error}
        </div>
      </div>
    )
  }

  const globalMetrics = stats?.global_metrics as SummaryMetrics | undefined
  
  if (!globalMetrics) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Processing Metrics Overview</h2>
        <div className="text-gray-600 text-sm">
          Global metrics not available. You may need admin permissions to view this data.
        </div>
      </div>
    )
  }

  // Calculate trends and health indicators
  const successRateTrend = getTrendIndicator(globalMetrics.success_rate, 90, 'success')
  const processingTimeTrend = getTrendIndicator(globalMetrics.average_processing_time, 5000, 'error')
  const circuitBreakerHealthy = !globalMetrics.circuit_breaker_status.isOpen
  const currentlyProcessingCount = globalMetrics.currently_processing || 0

  // System health score
  let healthScore = 0
  if (globalMetrics.success_rate >= 90) healthScore += 25
  else if (globalMetrics.success_rate >= 75) healthScore += 15
  else if (globalMetrics.success_rate >= 50) healthScore += 5

  if (globalMetrics.average_processing_time <= 5000) healthScore += 25
  else if (globalMetrics.average_processing_time <= 10000) healthScore += 15
  else if (globalMetrics.average_processing_time <= 20000) healthScore += 5

  if (circuitBreakerHealthy) healthScore += 25
  if (globalMetrics.currently_processing <= 5) healthScore += 25
  else if (globalMetrics.currently_processing <= 10) healthScore += 15
  else if (globalMetrics.currently_processing <= 20) healthScore += 5

  const healthColor = healthScore >= 85 ? 'text-green-600' : 
                     healthScore >= 65 ? 'text-yellow-600' : 'text-red-600'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Processing Metrics Overview</h2>
        {lastUpdated && (
          <span className="text-sm text-gray-500">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Success Rate"
          value={`${globalMetrics.success_rate.toFixed(1)}%`}
          subtitle={`${globalMetrics.total_successful} of ${globalMetrics.total_processed} processed`}
          icon="✅"
          trend={successRateTrend}
          color={globalMetrics.success_rate >= 90 ? 'text-green-600' : 
                 globalMetrics.success_rate >= 75 ? 'text-yellow-600' : 'text-red-600'}
        />

        <MetricCard
          title="Avg Processing Time"
          value={formatDuration(globalMetrics.average_processing_time)}
          subtitle="Per note processing time"
          icon="⏱️"
          trend={processingTimeTrend}
          color={globalMetrics.average_processing_time <= 5000 ? 'text-green-600' : 
                 globalMetrics.average_processing_time <= 10000 ? 'text-yellow-600' : 'text-red-600'}
        />

        <MetricCard
          title="Currently Processing"
          value={currentlyProcessingCount}
          subtitle="Notes being processed now"
          icon="🔄"
          color={currentlyProcessingCount <= 5 ? 'text-green-600' : 
                 currentlyProcessingCount <= 10 ? 'text-yellow-600' : 'text-red-600'}
        />

        <MetricCard
          title="System Health"
          value={`${healthScore}%`}
          subtitle="Overall system performance"
          icon={healthScore >= 85 ? '🟢' : healthScore >= 65 ? '🟡' : '🔴'}
          color={healthColor}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Total Processed"
          value={globalMetrics.total_processed.toLocaleString()}
          subtitle="All time processing count"
          icon="📊"
        />

        <MetricCard
          title="System Uptime"
          value={formatUptime(globalMetrics.uptime)}
          subtitle="Processing service uptime"
          icon="⏰"
          color="text-blue-600"
        />

        <MetricCard
          title="Circuit Breaker"
          value={circuitBreakerHealthy ? 'Healthy' : 'Open'}
          subtitle={`${globalMetrics.circuit_breaker_status.failures} failures`}
          icon={circuitBreakerHealthy ? '🟢' : '🚨'}
          color={circuitBreakerHealthy ? 'text-green-600' : 'text-red-600'}
        />
      </div>

      {/* Performance Indicators */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Indicators</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Success Rate Indicator */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium text-gray-700">Success Rate</span>
              <span className="text-gray-900">{globalMetrics.success_rate.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${
                  globalMetrics.success_rate >= 90 ? 'bg-green-500' :
                  globalMetrics.success_rate >= 75 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, globalMetrics.success_rate)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Processing Efficiency */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium text-gray-700">Processing Efficiency</span>
              <span className="text-gray-900">
                {globalMetrics.average_processing_time <= 5000 ? 'Excellent' :
                 globalMetrics.average_processing_time <= 10000 ? 'Good' :
                 globalMetrics.average_processing_time <= 20000 ? 'Fair' : 'Poor'}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${
                  globalMetrics.average_processing_time <= 5000 ? 'bg-green-500' :
                  globalMetrics.average_processing_time <= 10000 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ 
                  width: `${Math.max(10, Math.min(100, 100 - (globalMetrics.average_processing_time / 30000) * 100))}%` 
                }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Fast</span>
              <span>Average</span>
              <span>Slow</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}