'use client'

import { useState, useEffect } from 'react'
import { getPageLoadMetrics, analyzeResourceTiming } from '@/lib/performance/webVitals'

interface PerformanceMetrics {
  webVitals: Array<{
    name: string
    value: number
    rating: 'good' | 'needs-improvement' | 'poor'
    timestamp: number
  }>
  pageLoad: ReturnType<typeof getPageLoadMetrics>
  resources: ReturnType<typeof analyzeResourceTiming>
  bundleStats: {
    totalSize: number
    jsSize: number
    cssSize: number
    imageSize: number
    cachedResources: number
    totalResources: number
  }
}

export default function PerformanceDashboard() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isVisible) {
      loadMetrics()
    }
  }, [isVisible])

  const loadMetrics = () => {
    try {
      // Load stored web vitals
      const storedVitals = localStorage.getItem('voice-memory-performance')
      const webVitals = storedVitals ? JSON.parse(storedVitals).webVitals || [] : []

      // Get current page metrics
      const pageLoad = getPageLoadMetrics()
      const resources = analyzeResourceTiming()

      // Calculate bundle stats
      const bundleStats = calculateBundleStats(resources)

      setMetrics({
        webVitals: webVitals.slice(-10), // Last 10 measurements
        pageLoad,
        resources,
        bundleStats
      })
    } catch (error) {
      console.error('Failed to load performance metrics:', error)
    }
  }

  const calculateBundleStats = (resources: ReturnType<typeof analyzeResourceTiming>) => {
    let totalSize = 0
    let jsSize = 0
    let cssSize = 0
    let imageSize = 0
    let cachedResources = 0

    resources.forEach(resource => {
      totalSize += resource.size || 0
      if (resource.cached) cachedResources++

      switch (resource.type) {
        case 'script':
          jsSize += resource.size || 0
          break
        case 'stylesheet':
          cssSize += resource.size || 0
          break
        case 'img':
        case 'image':
          imageSize += resource.size || 0
          break
      }
    })

    return {
      totalSize,
      jsSize,
      cssSize,
      imageSize,
      cachedResources,
      totalResources: resources.length
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'good': return 'text-green-600 bg-green-50'
      case 'needs-improvement': return 'text-yellow-600 bg-yellow-50'
      case 'poor': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getPerformanceScore = () => {
    if (!metrics?.webVitals.length) return null
    
    const latestVitals = metrics.webVitals.reduce((acc, vital) => {
      acc[vital.name] = vital
      return acc
    }, {} as Record<string, any>)

    const scores = {
      good: 100,
      'needs-improvement': 50,
      poor: 0
    }

    const vitalNames = ['CLS', 'FID', 'FCP', 'LCP', 'TTFB']
    const totalScore = vitalNames.reduce((sum, name) => {
      const vital = latestVitals[name]
      return sum + (vital ? scores[vital.rating as keyof typeof scores] : 50)
    }, 0)

    return Math.round(totalScore / vitalNames.length)
  }

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 left-4 bg-gray-800 text-white p-3 rounded-full shadow-lg hover:bg-gray-700 transition-colors z-50"
        title="Performance Dashboard"
      >
        📊
      </button>
    )
  }

  const performanceScore = getPerformanceScore()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-semibold text-gray-900">Performance Dashboard</h2>
            {performanceScore !== null && (
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                performanceScore >= 80 ? 'bg-green-100 text-green-800' :
                performanceScore >= 50 ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                Score: {performanceScore}/100
              </div>
            )}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={loadMetrics}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={() => setIsVisible(false)}
              className="text-gray-400 hover:text-gray-600 p-2"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {metrics ? (
            <div className="space-y-8">
              {/* Core Web Vitals */}
              {metrics.webVitals.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Core Web Vitals</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {metrics.webVitals.slice(-5).map((vital, index) => (
                      <div key={`${vital.name}-${index}`} className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-sm font-medium text-gray-900">{vital.name}</div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">
                          {Math.round(vital.value)}
                          {vital.name === 'CLS' ? '' : 'ms'}
                        </div>
                        <div className={`text-xs px-2 py-1 rounded mt-2 inline-block ${getRatingColor(vital.rating)}`}>
                          {vital.rating}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Page Load Metrics */}
              {metrics.pageLoad && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Page Load Performance</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm font-medium text-gray-900">TTFB</div>
                      <div className="text-xl font-bold text-gray-900 mt-1">{Math.round(metrics.pageLoad.ttfb)}ms</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm font-medium text-gray-900">Page Load</div>
                      <div className="text-xl font-bold text-gray-900 mt-1">{Math.round(metrics.pageLoad.pageLoad)}ms</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm font-medium text-gray-900">DOM Complete</div>
                      <div className="text-xl font-bold text-gray-900 mt-1">{Math.round(metrics.pageLoad.domComplete)}ms</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm font-medium text-gray-900">Transfer Size</div>
                      <div className="text-xl font-bold text-gray-900 mt-1">{formatBytes(metrics.pageLoad.transferSize)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bundle Analysis */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Bundle Analysis</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm font-medium text-gray-900">Total Size</div>
                    <div className="text-xl font-bold text-gray-900 mt-1">{formatBytes(metrics.bundleStats.totalSize)}</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm font-medium text-gray-900">JavaScript</div>
                    <div className="text-xl font-bold text-gray-900 mt-1">{formatBytes(metrics.bundleStats.jsSize)}</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm font-medium text-gray-900">CSS</div>
                    <div className="text-xl font-bold text-gray-900 mt-1">{formatBytes(metrics.bundleStats.cssSize)}</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm font-medium text-gray-900">Images</div>
                    <div className="text-xl font-bold text-gray-900 mt-1">{formatBytes(metrics.bundleStats.imageSize)}</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm font-medium text-gray-900">Cache Hit Rate</div>
                    <div className="text-xl font-bold text-gray-900 mt-1">
                      {metrics.bundleStats.totalResources > 0 
                        ? Math.round((metrics.bundleStats.cachedResources / metrics.bundleStats.totalResources) * 100)
                        : 0}%
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm font-medium text-gray-900">Total Resources</div>
                    <div className="text-xl font-bold text-gray-900 mt-1">{metrics.bundleStats.totalResources}</div>
                  </div>
                </div>
              </div>

              {/* Performance Recommendations */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Recommendations</h3>
                <div className="space-y-3">
                  {metrics.bundleStats.jsSize > 500000 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="text-yellow-800 font-medium">Large JavaScript Bundle</div>
                      <div className="text-yellow-700 text-sm mt-1">
                        JavaScript bundle is {formatBytes(metrics.bundleStats.jsSize)}. Consider code splitting to improve initial load time.
                      </div>
                    </div>
                  )}
                  
                  {metrics.bundleStats.cachedResources / metrics.bundleStats.totalResources < 0.5 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="text-blue-800 font-medium">Low Cache Hit Rate</div>
                      <div className="text-blue-700 text-sm mt-1">
                        Only {Math.round((metrics.bundleStats.cachedResources / metrics.bundleStats.totalResources) * 100)}% of resources are cached. 
                        Review cache headers and CDN configuration.
                      </div>
                    </div>
                  )}

                  {metrics.pageLoad && metrics.pageLoad.ttfb > 1000 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="text-red-800 font-medium">Slow Server Response</div>
                      <div className="text-red-700 text-sm mt-1">
                        TTFB is {Math.round(metrics.pageLoad.ttfb)}ms. Consider server-side optimizations or CDN implementation.
                      </div>
                    </div>
                  )}

                  {performanceScore !== null && performanceScore >= 80 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="text-green-800 font-medium">Excellent Performance</div>
                      <div className="text-green-700 text-sm mt-1">
                        Your application is performing well across all Core Web Vitals metrics!
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading performance metrics...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}