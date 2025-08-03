'use client'

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useAuth } from '@/app/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { ProcessingMetricsSummary } from '@/app/components/ProcessingMetricsSummary'
import { CircuitBreakerStatus } from '@/app/components/CircuitBreakerStatus'
import { ErrorBreakdownChart } from '@/app/components/ErrorBreakdownChart'
import { RetryStuckButton } from '@/app/components/RetryStuckButton'
import { useProcessingStats } from '@/lib/hooks/use-processing-stats'
import { isAdminUser } from '@/lib/auth-utils'

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [autoRefresh, setAutoRefresh] = useState(true)
  const { refresh, lastUpdated } = useProcessingStats({
    scope: 'global',
    refreshInterval: autoRefresh ? 10000 : 0
  })

  // Authentication and authorization check
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login')
        return
      }
      
      if (!isAdminUser(user)) {
        router.push('/')
        return
      }
    }
  }, [user, authLoading, router])

  const handleRetrySuccess = () => {
    // Refresh stats after successful retry
    refresh()
  }

  const handleManualRefresh = async () => {
    await refresh()
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // Redirecting to login
  }

  if (!isAdminUser(user)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">🚫</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access the admin dashboard.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-600">
                Voice Memory Processing System Monitoring
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Auto-refresh toggle */}
              <div className="flex items-center">
                <label htmlFor="auto-refresh" className="text-sm text-gray-700 mr-2">
                  Auto-refresh
                </label>
                <input
                  id="auto-refresh"
                  name="auto-refresh"
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>

              {/* Manual refresh button */}
              <button
                onClick={handleManualRefresh}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                🔄 Refresh
              </button>

              {/* Back to app */}
              <button
                onClick={() => router.push('/')}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                ← Back to App
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Processing Metrics Overview */}
          <ProcessingMetricsSummary />

          {/* System Health Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <CircuitBreakerStatus />
            <ErrorBreakdownChart />
          </div>

          {/* Manual Operations Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <RetryStuckButton onSuccess={handleRetrySuccess} />
            </div>
            
            {/* System Status Summary */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">System Status</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm font-medium text-gray-700">Dashboard Mode</span>
                    <span className="text-sm text-gray-900">
                      {autoRefresh ? '🟢 Auto-refreshing' : '⏸️ Manual refresh'}
                    </span>
                  </div>
                  {lastUpdated && (
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-sm font-medium text-gray-700">Last Data Update</span>
                      <span className="text-sm text-gray-900">
                        {lastUpdated.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm font-medium text-gray-700">Admin User</span>
                    <span className="text-sm text-gray-900">
                      {user.email}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium text-gray-700">Dashboard Status</span>
                    <span className="text-sm text-green-600 font-medium">
                      🟢 Operational
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <span>Voice Memory Admin Dashboard</span>
            <span>
              Refresh interval: {autoRefresh ? '10 seconds' : 'Manual only'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}