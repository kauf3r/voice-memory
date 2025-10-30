'use client'

import { useEffect, useRef, useCallback } from 'react'
import { initWebVitals, startCustomMetric } from '@/lib/performance/webVitals'

interface PerformanceConfig {
  enableWebVitals?: boolean
  enableCustomMetrics?: boolean
  enableAPITracking?: boolean
  sampleRate?: number
  endpoint?: string
  debug?: boolean
}

interface CustomMetric {
  name: string
  duration: number
  timestamp: number
  metadata?: Record<string, any>
}

const DEFAULT_CONFIG: PerformanceConfig = {
  enableWebVitals: true,
  enableCustomMetrics: true,
  enableAPITracking: true,
  sampleRate: 0.1, // 10% of users in production
  endpoint: '/api/performance',
  debug: false
}

export function usePerformanceTracking(config: PerformanceConfig = {}) {
  const configRef = useRef({ ...DEFAULT_CONFIG, ...config })
  const sessionId = useRef(generateSessionId())
  const metricsBuffer = useRef<any[]>([])
  const lastFlush = useRef(Date.now())
  const customMetrics = useRef<CustomMetric[]>([])

  // Determine if this session should be tracked
  const shouldTrack = useRef(Math.random() < configRef.current.sampleRate!)

  const flushMetrics = useCallback(async () => {
    if (!shouldTrack.current || metricsBuffer.current.length === 0) return

    try {
      const payload = {
        sessionId: sessionId.current,
        metrics: [...metricsBuffer.current],
        customMetrics: [...customMetrics.current],
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent
      }

      // Send to analytics endpoint
      await fetch(configRef.current.endpoint!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      // Clear buffers
      metricsBuffer.current = []
      customMetrics.current = []
      lastFlush.current = Date.now()

      if (configRef.current.debug) {
        console.log('📤 Performance metrics sent:', payload)
      }
    } catch (error) {
      if (configRef.current.debug) {
        console.error('❌ Failed to send performance metrics:', error)
      }
    }
  }, [])

  // Initialize Web Vitals tracking
  useEffect(() => {
    if (!shouldTrack.current || !configRef.current.enableWebVitals) return

    initWebVitals({
      sendMetric: (metric) => {
        metricsBuffer.current.push(metric)
        
        // Auto-flush if buffer is getting full or enough time has passed
        if (metricsBuffer.current.length >= 5 || Date.now() - lastFlush.current > 30000) {
          flushMetrics()
        }
      },
      debug: configRef.current.debug
    })
  }, [flushMetrics])

  // Flush metrics before page unload
  useEffect(() => {
    if (!shouldTrack.current) return

    const handleBeforeUnload = () => {
      if (metricsBuffer.current.length > 0 || customMetrics.current.length > 0) {
        // Use sendBeacon for more reliable delivery
        const payload = JSON.stringify({
          sessionId: sessionId.current,
          metrics: metricsBuffer.current,
          customMetrics: customMetrics.current,
          timestamp: Date.now()
        })
        
        navigator.sendBeacon(configRef.current.endpoint!, payload)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  // Periodic flush
  useEffect(() => {
    if (!shouldTrack.current) return

    const interval = setInterval(() => {
      if (metricsBuffer.current.length > 0 || customMetrics.current.length > 0) {
        flushMetrics()
      }
    }, 60000) // Flush every minute

    return () => clearInterval(interval)
  }, [flushMetrics])

  // Track custom metrics
  const trackCustomMetric = useCallback((name: string, duration: number, metadata?: Record<string, any>) => {
    if (!shouldTrack.current || !configRef.current.enableCustomMetrics) return

    const metric: CustomMetric = {
      name,
      duration,
      timestamp: Date.now(),
      metadata
    }

    customMetrics.current.push(metric)

    if (configRef.current.debug) {
      console.log('📊 Custom metric tracked:', metric)
    }
  }, [])

  // Track async operations
  const trackAsyncOperation = useCallback(async <T>(
    name: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> => {
    if (!shouldTrack.current || !configRef.current.enableCustomMetrics) {
      return await operation()
    }

    const startTime = performance.now()
    
    try {
      const result = await operation()
      const duration = performance.now() - startTime
      
      trackCustomMetric(name, duration, { 
        ...metadata, 
        status: 'success' 
      })
      
      return result
    } catch (error) {
      const duration = performance.now() - startTime
      
      trackCustomMetric(name, duration, {
        ...metadata,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      throw error
    }
  }, [trackCustomMetric])

  // Track component render performance
  const trackRenderPerformance = useCallback((componentName: string) => {
    if (!shouldTrack.current || !configRef.current.enableCustomMetrics) return { end: () => {} }

    const metric = startCustomMetric(`render-${componentName}`)
    
    return {
      end: () => {
        const measurement = metric.end()
        trackCustomMetric(`render-${componentName}`, measurement.duration, {
          component: componentName
        })
      }
    }
  }, [trackCustomMetric])

  // Manual flush function
  const flush = useCallback(() => {
    flushMetrics()
  }, [flushMetrics])

  return {
    trackCustomMetric,
    trackAsyncOperation,
    trackRenderPerformance,
    flush,
    isTracking: shouldTrack.current,
    sessionId: sessionId.current
  }
}

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Hook for tracking page transitions
export function usePageTransitionTracking() {
  const { trackCustomMetric } = usePerformanceTracking()
  const pageStartTime = useRef(performance.now())

  useEffect(() => {
    pageStartTime.current = performance.now()
  }, [])

  useEffect(() => {
    const handleBeforeUnload = () => {
      const timeOnPage = performance.now() - pageStartTime.current
      trackCustomMetric('page-view-duration', timeOnPage, {
        url: window.location.href,
        pathname: window.location.pathname
      })
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [trackCustomMetric])

  return {
    trackPageTransition: useCallback((from: string, to: string) => {
      const transitionTime = performance.now() - pageStartTime.current
      trackCustomMetric('page-transition', transitionTime, {
        from,
        to
      })
      pageStartTime.current = performance.now()
    }, [trackCustomMetric])
  }
}

// Hook for tracking user interactions
export function useInteractionTracking() {
  const { trackCustomMetric } = usePerformanceTracking()

  return {
    trackClick: useCallback((element: string, metadata?: Record<string, any>) => {
      trackCustomMetric('user-click', 0, {
        element,
        timestamp: Date.now(),
        ...metadata
      })
    }, [trackCustomMetric]),

    trackFormSubmission: useCallback((formName: string, duration: number, success: boolean) => {
      trackCustomMetric('form-submission', duration, {
        formName,
        success,
        timestamp: Date.now()
      })
    }, [trackCustomMetric]),

    trackSearch: useCallback((query: string, results: number, duration: number) => {
      trackCustomMetric('search', duration, {
        queryLength: query.length,
        resultCount: results,
        timestamp: Date.now()
      })
    }, [trackCustomMetric])
  }
}