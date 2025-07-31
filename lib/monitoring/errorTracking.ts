/**
 * Production Error Tracking and Monitoring System
 * Captures, categorizes, and reports application errors
 */

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

interface PerformanceMetric {
  name: string
  value: number
  timestamp: Date
  context: Record<string, any>
}

class ErrorTracker {
  private static instance: ErrorTracker
  private errors: ErrorReport[] = []
  private metrics: PerformanceMetric[] = []
  private userId?: string
  private sessionId: string
  private isProduction: boolean

  constructor() {
    this.sessionId = this.generateSessionId()
    this.isProduction = process.env.NODE_ENV === 'production'
    this.setupGlobalErrorHandlers()
  }

  static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker()
    }
    return ErrorTracker.instance
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private setupGlobalErrorHandlers(): void {
    if (typeof window === 'undefined') return

    // Global error handler
    window.addEventListener('error', (event) => {
      this.captureError({
        message: event.message,
        stack: event.error?.stack,
        context: {
          route: window.location.pathname,
          filename: event.filename,
          line: event.lineno,
          column: event.colno
        }
      })
    })

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        context: {
          route: window.location.pathname,
          type: 'unhandled_promise'
        }
      })
    })

    // React error boundary integration
    if (typeof window !== 'undefined') {
      (window as any).__ERROR_TRACKER__ = this
    }
  }

  setUserId(userId: string): void {
    this.userId = userId
  }

  captureError(error: {
    message: string
    stack?: string
    level?: 'error' | 'warning' | 'info'
    context?: Partial<ErrorReport['context']>
    metadata?: Record<string, any>
  }): void {
    const errorReport: ErrorReport = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level: error.level || 'error',
      message: error.message,
      stack: error.stack,
      context: {
        user_id: this.userId,
        route: typeof window !== 'undefined' ? window.location.pathname : '/',
        browser: this.getBrowserInfo(),
        device: this.getDeviceInfo(),
        session_id: this.sessionId,
        ...error.context
      },
      metadata: error.metadata
    }

    this.errors.push(errorReport)

    // Send to monitoring service in production
    if (this.isProduction) {
      this.sendToMonitoringService(errorReport)
    } else {
      console.error('🚨 Error Captured:', errorReport)
    }

    // Keep only last 100 errors in memory
    if (this.errors.length > 100) {
      this.errors = this.errors.slice(-100)
    }
  }

  capturePerformanceMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric)

    // Send to monitoring service in production
    if (this.isProduction) {
      this.sendMetricToService(metric)
    }

    // Keep only last 1000 metrics in memory
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }
  }

  private async sendToMonitoringService(error: ErrorReport): Promise<void> {
    try {
      // Send to your monitoring service (Sentry, LogRocket, etc.)
      await fetch('/api/monitoring/error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(error)
      })
    } catch (err) {
      console.error('Failed to send error to monitoring service:', err)
    }
  }

  private async sendMetricToService(metric: PerformanceMetric): Promise<void> {
    try {
      await fetch('/api/monitoring/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metric)
      })
    } catch (err) {
      console.error('Failed to send metric to monitoring service:', err)
    }
  }

  private getBrowserInfo(): string {
    if (typeof navigator === 'undefined') return 'Unknown'
    return `${navigator.userAgent.split(' ').slice(-2).join(' ')}`
  }

  private getDeviceInfo(): string {
    if (typeof navigator === 'undefined') return 'Unknown'
    return `${navigator.platform} - Screen: ${screen?.width}x${screen?.height}`
  }

  // API for retrieving errors and metrics
  getRecentErrors(limit: number = 50): ErrorReport[] {
    return this.errors.slice(-limit)
  }

  getErrorsByLevel(level: ErrorReport['level']): ErrorReport[] {
    return this.errors.filter(error => error.level === level)
  }

  getMetrics(name?: string, limit: number = 100): PerformanceMetric[] {
    const metrics = name 
      ? this.metrics.filter(m => m.name === name)
      : this.metrics
    return metrics.slice(-limit)
  }

  clearErrors(): void {
    this.errors = []
  }

  clearMetrics(): void {
    this.metrics = []
  }
}

// Error tracking utilities
export const errorTracker = ErrorTracker.getInstance()

export const captureError = (error: Error | string, context?: any) => {
  errorTracker.captureError({
    message: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
    context,
    level: 'error'
  })
}

export const captureWarning = (message: string, context?: any) => {
  errorTracker.captureError({
    message,
    context,
    level: 'warning'
  })
}

export const captureInfo = (message: string, context?: any) => {
  errorTracker.captureError({
    message,
    context,
    level: 'info'
  })
}

// Performance tracking utilities
export const trackPerformance = (name: string, value: number, context?: any) => {
  errorTracker.capturePerformanceMetric({
    name,
    value,
    timestamp: new Date(),
    context: context || {}
  })
}

// React Error Boundary integration
export const handleReactError = (error: Error, errorInfo: any) => {
  errorTracker.captureError({
    message: error.message,
    stack: error.stack,
    context: {
      component: errorInfo.componentStack?.split('\n')[1]?.trim(),
      route: typeof window !== 'undefined' ? window.location.pathname : '/'
    },
    metadata: {
      componentStack: errorInfo.componentStack,
      errorBoundary: true
    }
  })
}

export default errorTracker