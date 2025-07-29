'use client'

import { useProcessingStats } from '@/lib/hooks/use-processing-stats'

interface ErrorCategory {
  category: string
  count: number
  percentage: number
  color: string
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    'timeout': 'bg-red-500',
    'rate_limit': 'bg-yellow-500',
    'network': 'bg-blue-500',
    'auth': 'bg-purple-500',
    'quota': 'bg-orange-500',
    'api': 'bg-pink-500',
    'processing': 'bg-indigo-500',
    'storage': 'bg-teal-500',
    'unknown': 'bg-gray-500'
  }
  
  // Normalize category name for lookup
  const normalizedCategory = category.toLowerCase().replace(/[^a-z0-9]/g, '_')
  
  // Check for partial matches
  for (const [key, color] of Object.entries(colors)) {
    if (normalizedCategory.includes(key) || key.includes(normalizedCategory)) {
      return color
    }
  }
  
  return colors.unknown
}

function formatCategoryName(category: string): string {
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function ErrorBreakdownChart() {
  const { data: stats, loading, error } = useProcessingStats({
    scope: 'global',
    refreshInterval: 15000
  })

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Error Breakdown</h3>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-full mb-3"></div>
          <div className="h-4 bg-gray-200 rounded w-4/5 mb-3"></div>
          <div className="h-4 bg-gray-200 rounded w-3/5 mb-3"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Error Breakdown</h3>
        <div className="text-red-600 text-sm">
          Error loading error breakdown: {error}
        </div>
      </div>
    )
  }

  const errorBreakdown = stats?.global_metrics?.errorCategoryBreakdown || {}
  const totalErrors = Object.values(errorBreakdown).reduce((sum, count) => sum + count, 0)

  if (totalErrors === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Error Breakdown</h3>
        <div className="text-center py-8">
          <div className="text-green-500 text-4xl mb-2">✅</div>
          <p className="text-gray-600 text-sm">No errors to display</p>
          <p className="text-gray-500 text-xs mt-1">System is running smoothly</p>
        </div>
      </div>
    )
  }

  // Prepare error categories for display
  const errorCategories: ErrorCategory[] = Object.entries(errorBreakdown)
    .map(([category, count]) => ({
      category,
      count,
      percentage: (count / totalErrors) * 100,
      color: getCategoryColor(category)
    }))
    .sort((a, b) => b.count - a.count) // Sort by count descending

  const maxCount = Math.max(...errorCategories.map(cat => cat.count))

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Error Breakdown</h3>
        <span className="text-sm text-gray-600">
          {totalErrors} total error{totalErrors !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Error Categories */}
      <div className="space-y-3">
        {errorCategories.map((errorCategory) => (
          <div key={errorCategory.category} className="flex items-center">
            {/* Category Name */}
            <div className="w-24 flex-shrink-0">
              <span className="text-sm font-medium text-gray-700">
                {formatCategoryName(errorCategory.category)}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="flex-1 mx-3">
              <div className="flex items-center">
                <div className="flex-1 bg-gray-200 rounded-full h-3 relative">
                  <div
                    className={`h-3 rounded-full ${errorCategory.color} transition-all duration-300`}
                    style={{
                      width: `${(errorCategory.count / maxCount) * 100}%`
                    }}
                  ></div>
                  {/* Tooltip on hover */}
                  <div className="absolute inset-0 rounded-full opacity-0 hover:opacity-100 transition-opacity duration-200">
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 px-2 py-1 bg-gray-800 text-white text-xs rounded shadow-lg z-10">
                      {errorCategory.percentage.toFixed(1)}% of errors
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Count and Percentage */}
            <div className="w-16 text-right flex-shrink-0">
              <span className="text-sm font-semibold text-gray-900">
                {errorCategory.count}
              </span>
              <span className="text-xs text-gray-500 ml-1">
                ({errorCategory.percentage.toFixed(1)}%)
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <div className="flex flex-wrap gap-4">
          {errorCategories.slice(0, 6).map((errorCategory) => ( // Show top 6 in legend
            <div key={errorCategory.category} className="flex items-center">
              <div className={`w-3 h-3 rounded-full ${errorCategory.color} mr-2`}></div>
              <span className="text-xs text-gray-600">
                {formatCategoryName(errorCategory.category)}
              </span>
            </div>
          ))}
          {errorCategories.length > 6 && (
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-gray-400 mr-2"></div>
              <span className="text-xs text-gray-600">
                +{errorCategories.length - 6} more
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Most common error:</span>
          <span className="font-medium text-gray-900">
            {formatCategoryName(errorCategories[0]?.category || 'None')}
          </span>
        </div>
        {errorCategories.length > 1 && (
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-600">Error diversity:</span>
            <span className="font-medium text-gray-900">
              {errorCategories.length} categor{errorCategories.length !== 1 ? 'ies' : 'y'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}