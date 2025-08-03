'use client'

import { useState, useEffect } from 'react'
import { useAuth } from './AuthProvider'

interface QuotaData {
  usage: {
    notesCount: number
    processingThisHour: number
    tokensToday: number
    storageMB: number
  }
  limits: {
    maxNotesPerUser: number
    maxProcessingPerHour: number
    maxTokensPerDay: number
    maxStorageMB: number
  }
  percentages: {
    notes: number
    processing: number
    tokens: number
    storage: number
  }
}

interface QuotaStatusProps {
  compact?: boolean
  showAll?: boolean
}

export default function QuotaStatus({ compact = false, showAll = false }: QuotaStatusProps) {
  const [quotaData, setQuotaData] = useState<QuotaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    fetchQuotaData()
  }, [user])

  const fetchQuotaData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/quota')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch quota data')
      }

      setQuotaData(data)
    } catch (err) {
      console.error('Error fetching quota data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load quota information')
    } finally {
      setLoading(false)
    }
  }

  if (!user || loading) {
    return compact ? null : (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
        <div className="h-2 bg-gray-200 rounded w-full"></div>
      </div>
    )
  }

  if (error) {
    return compact ? null : (
      <div className="text-sm text-red-600">
        Failed to load quota information
      </div>
    )
  }

  if (!quotaData) return null

  const getStatusColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 bg-red-100'
    if (percentage >= 75) return 'text-yellow-600 bg-yellow-100'
    return 'text-green-600 bg-green-100'
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 75) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const quotaItems = [
    {
      label: 'Notes',
      usage: quotaData.usage.notesCount,
      limit: quotaData.limits.maxNotesPerUser,
      percentage: quotaData.percentages.notes,
      unit: ''
    },
    {
      label: 'Processing (hourly)',
      usage: quotaData.usage.processingThisHour,
      limit: quotaData.limits.maxProcessingPerHour,
      percentage: quotaData.percentages.processing,
      unit: ''
    },
    {
      label: 'Storage',
      usage: Math.round(quotaData.usage.storageMB),
      limit: quotaData.limits.maxStorageMB,
      percentage: quotaData.percentages.storage,
      unit: 'MB'
    }
  ]

  // Show API tokens only if requested or if close to limit
  if (showAll || quotaData.percentages.tokens > 50) {
    quotaItems.push({
      label: 'API Tokens (daily)',
      usage: quotaData.usage.tokensToday,
      limit: quotaData.limits.maxTokensPerDay,
      percentage: quotaData.percentages.tokens,
      unit: ''
    })
  }

  if (compact) {
    // Show only the highest usage percentage
    const maxItem = quotaItems.reduce((max, item) => 
      item.percentage > max.percentage ? item : max
    )

    if (maxItem.percentage < 50) return null // Don't show if all usage is low

    return (
      <div className="flex items-center gap-2 text-sm">
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(maxItem.percentage)}`}>
          {maxItem.label}: {maxItem.percentage}%
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Usage & Limits</h3>
        <button
          onClick={fetchQuotaData}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        {quotaItems.map((item) => (
          <div key={item.label}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-medium text-gray-700">
                {item.label}
              </span>
              <span className="text-xs text-gray-500">
                {item.usage.toLocaleString()}/{item.limit.toLocaleString()} {item.unit}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(item.percentage)}`}
                style={{ width: `${Math.min(item.percentage, 100)}%` }}
              />
            </div>
            {item.percentage >= 75 && (
              <p className="text-xs text-gray-600 mt-1">
                {item.percentage >= 90 ? (
                  <span className="text-red-600 font-medium">
                    ⚠️ Limit almost reached
                  </span>
                ) : (
                  <span className="text-yellow-600">
                    ⚠️ Approaching limit
                  </span>
                )}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Usage tips */}
      {quotaItems.some(item => item.percentage >= 75) && (
        <div className="mt-4 p-3 bg-gray-50 rounded border">
          <h4 className="text-xs font-medium text-gray-700 mb-2">💡 Tips to manage usage:</h4>
          <ul className="text-xs text-gray-600 space-y-1">
            {quotaData.percentages.notes >= 75 && (
              <li>• Delete old notes you no longer need</li>
            )}
            {quotaData.percentages.processing >= 75 && (
              <li>• Processing resets every hour</li>
            )}
            {quotaData.percentages.storage >= 75 && (
              <li>• Delete large audio files to free up space</li>
            )}
            {quotaData.percentages.tokens >= 75 && (
              <li>• API token quota resets daily</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

// Hook for checking quota status
export function useQuotaStatus() {
  const [quotaData, setQuotaData] = useState<QuotaData | null>(null)
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()

  const checkQuota = async () => {
    if (!user) return null

    try {
      setLoading(true)
      const response = await fetch('/api/quota')
      const data = await response.json()
      
      if (response.ok) {
        setQuotaData(data)
        return data
      }
    } catch (error) {
      console.error('Quota check failed:', error)
    } finally {
      setLoading(false)
    }
    return null
  }

  return { quotaData, loading, checkQuota }
}