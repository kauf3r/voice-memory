'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class PerformanceErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 Performance monitoring error caught:', error)
    console.error('Error info:', errorInfo)
    
    // Log to external service if needed (but don't cause more errors)
    try {
      // Could send to external error tracking service here
      // But we don't want to cause more circular dependencies
    } catch (loggingError) {
      console.error('Failed to log performance error:', loggingError)
    }
  }

  public render() {
    if (this.state.hasError) {
      // Render nothing if performance monitoring fails
      // This prevents performance issues from breaking the entire app
      console.warn('⚠️ Performance monitoring disabled due to error')
      return null
    }

    return this.props.children
  }
}

export default PerformanceErrorBoundary