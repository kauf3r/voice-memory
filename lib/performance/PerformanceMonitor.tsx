'use client'

import { useEffect, useState, useRef } from 'react'
import { initWebVitals, getPageLoadMetrics, analyzeResourceTiming, startCustomMetric } from './webVitals'

interface PerformanceMetric {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number
  id: string
  timestamp: number
  navigationType: string
}

interface CustomMetric {
  name: string
  duration: number
  timestamp: number
}

interface PerformanceData {
  webVitals: PerformanceMetric[]
  customMetrics: CustomMetric[]
  pageLoad: ReturnType<typeof getPageLoadMetrics>
  resources: ReturnType<typeof analyzeResourceTiming>
  componentRenders: Record<string, number>
  apiCalls: Array<{
    url: string
    method: string
    duration: number
    status: number
    timestamp: number
  }>
}

interface PerformanceMonitorProps {
  children: React.ReactNode
  debug?: boolean
  enableRUM?: boolean // Real User Monitoring
  sampleRate?: number // 0-1, percentage of users to monitor
}

const STORAGE_KEY = 'voice-memory-performance'
const MAX_STORED_METRICS = 100

export function PerformanceMonitor({ 
  children, 
  debug = false, 
  enableRUM = true,
  sampleRate = 1.0 
}: PerformanceMonitorProps) {
  const [performanceData, setPerformanceData] = useState<PerformanceData>({
    webVitals: [],
    customMetrics: [],
    pageLoad: null,
    resources: [],
    componentRenders: {},
    apiCalls: []
  })
  
  const apiCallTimers = useRef<Map<string, number>>(new Map())
  const renderCounts = useRef<Record<string, number>>({})
  const shouldMonitor = useRef(Math.random() < sampleRate)

  useEffect(() => {
    if (!enableRUM || !shouldMonitor.current) return

    // Initialize Web Vitals monitoring
    initWebVitals({
      sendMetric: (metric: PerformanceMetric) => {
        setPerformanceData(prev => ({
          ...prev,
          webVitals: [...prev.webVitals.slice(-MAX_STORED_METRICS), metric]
        }))

        // Store in localStorage for persistence
        const stored = localStorage.getItem(STORAGE_KEY)
        const existing = stored ? JSON.parse(stored) : { webVitals: [] }
        existing.webVitals = [...existing.webVitals.slice(-MAX_STORED_METRICS), metric]
        localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))

        if (debug) {
          console.log('📊 Performance Metric Recorded:', metric)
        }
      },
      debug
    })

    // Capture page load metrics after initial load
    const timer = setTimeout(() => {
      const pageLoadMetrics = getPageLoadMetrics()
      const resourceMetrics = analyzeResourceTiming()
      
      setPerformanceData(prev => ({
        ...prev,
        pageLoad: pageLoadMetrics,
        resources: resourceMetrics
      }))

      if (debug && pageLoadMetrics) {
        console.log('📄 Page Load Metrics:', pageLoadMetrics)
        console.log('📦 Resource Timing:', resourceMetrics)
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [enableRUM, debug, sampleRate])

  useEffect(() => {
    if (!enableRUM || !shouldMonitor.current) return

    // Intercept fetch for API monitoring with exclusions to prevent circular dependencies
    const originalFetch = window.fetch
    window.fetch = function(...args) {
      const [url, options] = args
      const urlString = typeof url === 'string' ? url : url.toString()
      
      // CRITICAL: Exclude monitoring/performance endpoints to prevent infinite loops
      const excludedEndpoints = [
        '/api/monitoring',
        '/api/performance', 
        '/api/metrics',
        '/api/error'
      ]
      
      const shouldSkipMonitoring = excludedEndpoints.some(endpoint => urlString.includes(endpoint))
      
      if (shouldSkipMonitoring) {
        // Skip monitoring for these endpoints to prevent circular dependencies
        return originalFetch.apply(this, args)
      }

      const startTime = performance.now()
      const method = options?.method || 'GET'
      const requestId = `${method}-${urlString}-${startTime}`
      
      apiCallTimers.current.set(requestId, startTime)

      return originalFetch.apply(this, args).then(response => {
        const endTime = performance.now()
        const duration = endTime - startTime
        
        const apiCall = {
          url: urlString,
          method,
          duration: Math.round(duration),
          status: response.status,
          timestamp: Date.now()
        }

        // Use functional update to prevent dependency on current state
        setPerformanceData(prev => ({
          ...prev,
          apiCalls: [...prev.apiCalls.slice(-49), apiCall] // Keep last 50 API calls
        }))

        if (debug) {
          console.log('🌐 API Call:', apiCall)
        }

        apiCallTimers.current.delete(requestId)
        return response
      }).catch(error => {
        const endTime = performance.now()
        const duration = endTime - startTime
        
        const apiCall = {
          url: urlString,
          method,
          duration: Math.round(duration),
          status: 0,
          timestamp: Date.now()
        }

        setPerformanceData(prev => ({
          ...prev,
          apiCalls: [...prev.apiCalls.slice(-49), apiCall]
        }))

        if (debug) {
          console.log('❌ API Call Failed:', apiCall)
        }

        apiCallTimers.current.delete(requestId)
        throw error
      })
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [enableRUM, debug])

  // Performance Dashboard (only shown in debug mode)
  if (debug && enableRUM && shouldMonitor.current) {
    return (
      <>
        {children}
        <PerformanceDashboard performanceData={performanceData} />
      </>
    )
  }

  return <>{children}</>
}

function PerformanceDashboard({ performanceData }: { performanceData: PerformanceData }) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'vitals' | 'page' | 'api' | 'resources'>('vitals')

  const latestVitals = performanceData.webVitals.reduce((acc, metric) => {
    acc[metric.name] = metric
    return acc
  }, {} as Record<string, PerformanceMetric>)

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        title="Performance Dashboard"
      >
        📊
      </button>

      {isOpen && (
        <div className="absolute bottom-16 right-0 w-96 bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Performance Monitor</h3>
            <div className="flex space-x-2 mt-2">
              {(['vitals', 'page', 'api', 'resources'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-xs px-2 py-1 rounded ${
                    activeTab === tab 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 overflow-y-auto max-h-80">
            {activeTab === 'vitals' && (
              <div className="space-y-3">
                {Object.entries(latestVitals).map(([name, metric]) => (
                  <div key={name} className="flex justify-between items-center">
                    <span className="text-sm font-medium">{name}</span>
                    <div className="text-right">
                      <div className={`text-sm font-mono ${
                        metric.rating === 'good' ? 'text-green-600' : 
                        metric.rating === 'needs-improvement' ? 'text-yellow-600' : 
                        'text-red-600'
                      }`}>
                        {Math.round(metric.value)}
                        {name === 'CLS' ? '' : 'ms'}
                      </div>
                      <div className={`text-xs px-1 rounded ${
                        metric.rating === 'good' ? 'bg-green-100 text-green-700' : 
                        metric.rating === 'needs-improvement' ? 'bg-yellow-100 text-yellow-700' : 
                        'bg-red-100 text-red-700'
                      }`}>
                        {metric.rating}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'page' && performanceData.pageLoad && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>TTFB</span>
                  <span className="font-mono">{Math.round(performanceData.pageLoad.ttfb)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Page Load</span>
                  <span className="font-mono">{Math.round(performanceData.pageLoad.pageLoad)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span>DOM Complete</span>
                  <span className="font-mono">{Math.round(performanceData.pageLoad.domComplete)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Transfer Size</span>
                  <span className="font-mono">{(performanceData.pageLoad.transferSize / 1024).toFixed(1)}KB</span>
                </div>
              </div>
            )}

            {activeTab === 'api' && (
              <div className="space-y-2">
                {performanceData.apiCalls.slice(-10).map((call, index) => (
                  <div key={index} className="text-xs border-b border-gray-100 pb-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{call.method}</span>
                      <span className={`px-1 rounded ${
                        call.status >= 200 && call.status < 300 ? 'bg-green-100 text-green-700' :
                        call.status >= 400 ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {call.status || 'ERR'}
                      </span>
                    </div>
                    <div className="text-gray-600 truncate">{call.url}</div>
                    <div className="flex justify-between">
                      <span>{call.duration}ms</span>
                      <span>{new Date(call.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'resources' && (
              <div className="space-y-2">
                {performanceData.resources.slice(0, 10).map((resource, index) => (
                  <div key={index} className="text-xs border-b border-gray-100 pb-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{resource.type}</span>
                      <span className="text-gray-600">{Math.round(resource.duration)}ms</span>
                    </div>
                    <div className="text-gray-600 truncate">{resource.name}</div>
                    <div className="flex justify-between">
                      <span>{resource.cached ? '💾 Cached' : '🌐 Network'}</span>
                      <span>{resource.size ? `${(resource.size / 1024).toFixed(1)}KB` : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Hook for measuring component render performance
export function useComponentPerformance(componentName: string) {
  const renderCount = useRef(0)
  const startTime = useRef<number>()

  useEffect(() => {
    startTime.current = performance.now()
    renderCount.current++
  })

  useEffect(() => {
    if (startTime.current) {
      const renderTime = performance.now() - startTime.current
      
      // Only log slow renders (>16ms for 60fps)
      if (renderTime > 16) {
        console.log(`🐌 Slow render: ${componentName} took ${renderTime.toFixed(2)}ms (render #${renderCount.current})`)
      }
    }
  })

  return {
    renderCount: renderCount.current,
    measureRender: (callback: () => void) => {
      const start = performance.now()
      callback()
      const end = performance.now()
      console.log(`⏱️ ${componentName} render: ${(end - start).toFixed(2)}ms`)
    }
  }
}

// Hook for measuring async operations
export function useAsyncPerformance() {
  return {
    measureAsync: async <T>(name: string, asyncFn: () => Promise<T>): Promise<T> => {
      const metric = startCustomMetric(name)
      try {
        const result = await asyncFn()
        const measurement = metric.end()
        console.log(`⏱️ Async operation ${name}: ${measurement.duration.toFixed(2)}ms`)
        return result
      } catch (error) {
        const measurement = metric.end()
        console.log(`❌ Failed async operation ${name}: ${measurement.duration.toFixed(2)}ms`)
        throw error
      }
    }
  }
}