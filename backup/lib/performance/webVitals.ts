'use client'

import { onCLS, onFCP, onLCP, onTTFB, onINP, Metric } from 'web-vitals'

interface PerformanceMetric {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  delta: number
  id: string
  timestamp: number
  navigationType: string
}

interface PerformanceAnalytics {
  sendMetric: (metric: PerformanceMetric) => void
  debug?: boolean
}

// Performance thresholds based on Core Web Vitals recommendations
const THRESHOLDS = {
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 },
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  TTFB: { good: 800, poor: 1800 }
}

function getRating(metricName: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[metricName as keyof typeof THRESHOLDS]
  if (!threshold) return 'good'
  
  if (value <= threshold.good) return 'good'
  if (value <= threshold.poor) return 'needs-improvement'
  return 'poor'
}

function getNavigationType(): string {
  if (typeof window === 'undefined') return 'unknown'
  
  try {
    const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    return navEntry?.type || 'unknown'
  } catch {
    return 'unknown'
  }
}

function createMetric(metric: Metric): PerformanceMetric {
  return {
    name: metric.name,
    value: metric.value,
    rating: getRating(metric.name, metric.value),
    delta: metric.delta,
    id: metric.id,
    timestamp: Date.now(),
    navigationType: getNavigationType()
  }
}

export function initWebVitals(analytics: PerformanceAnalytics) {
  const { sendMetric, debug = false } = analytics

  function handleMetric(metric: Metric) {
    const performanceMetric = createMetric(metric)
    
    if (debug) {
      console.log('📊 Web Vital:', {
        name: performanceMetric.name,
        value: performanceMetric.value,
        rating: performanceMetric.rating,
        timestamp: new Date(performanceMetric.timestamp).toISOString()
      })
    }

    sendMetric(performanceMetric)
  }

  // Register all Core Web Vitals
  onCLS(handleMetric)
  onFCP(handleMetric)
  onLCP(handleMetric)
  onTTFB(handleMetric)
  onINP(handleMetric)
}

// Custom performance metrics
export function measureCustomMetric(name: string, startTime: number, endTime?: number) {
  const now = endTime || performance.now()
  const duration = now - startTime
  
  performance.mark(`${name}-end`)
  performance.measure(name, `${name}-start`, `${name}-end`)
  
  return {
    name,
    duration,
    timestamp: Date.now()
  }
}

export function startCustomMetric(name: string) {
  const startTime = performance.now()
  performance.mark(`${name}-start`)
  
  return {
    end: (endTime?: number) => measureCustomMetric(name, startTime, endTime),
    startTime
  }
}

// Resource timing analysis
export function analyzeResourceTiming() {
  if (typeof window === 'undefined') return []
  
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
  
  return resources.map(resource => ({
    name: resource.name,
    type: resource.initiatorType,
    duration: resource.duration,
    size: resource.transferSize,
    cached: resource.transferSize === 0 && resource.decodedBodySize > 0,
    renderBlocking: resource.renderBlockingStatus === 'blocking'
  }))
}

// Page load performance analysis
export function getPageLoadMetrics() {
  if (typeof window === 'undefined') return null
  
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
  if (!navigation) return null
  
  return {
    // DNS and TCP
    dnsLookup: navigation.domainLookupEnd - navigation.domainLookupStart,
    tcpConnect: navigation.connectEnd - navigation.connectStart,
    
    // Request/Response
    requestTime: navigation.responseStart - navigation.requestStart,
    responseTime: navigation.responseEnd - navigation.responseStart,
    
    // DOM Processing
    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
    domComplete: navigation.domComplete - navigation.navigationStart,
    
    // Load Complete
    loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
    
    // Total times
    ttfb: navigation.responseStart - navigation.navigationStart,
    pageLoad: navigation.loadEventEnd - navigation.navigationStart,
    
    // Page size (approximation)
    transferSize: navigation.transferSize || 0,
    
    // Navigation type
    type: navigation.type
  }
}