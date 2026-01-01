/**
 * Centralized Error Handler for Knowledge Services
 */

import { NextResponse } from 'next/server'

export interface ServiceError {
  message: string
  code?: string
  status?: number
  details?: any
  stack?: string
}

export class ErrorHandler {
  /**
   * Handle authentication errors
   */
  static handleAuthError(error: any): NextResponse {
    console.error('❌ Authentication error:', error)
    
    const message = error.message || 'Authentication failed'
    const status = message.includes('Authorization header required') ? 401 : 401

    return NextResponse.json(
      { error: message },
      { status }
    )
  }

  /**
   * Handle database errors
   */
  static handleDatabaseError(error: any, operation: string): NextResponse {
    console.error(`❌ Database error during ${operation}:`, error)
    
    return NextResponse.json(
      { error: `Failed to ${operation}` },
      { status: 500 }
    )
  }

  /**
   * Handle validation errors
   */
  static handleValidationError(error: any): NextResponse {
    console.error('❌ Validation error:', error)
    
    return NextResponse.json(
      { error: error.message || 'Invalid request data' },
      { status: 400 }
    )
  }

  /**
   * Handle aggregation errors
   */
  static handleAggregationError(error: any, fallbackData?: any): any {
    console.error('❌ Error aggregating knowledge data:', {
      error: error,
      message: error.message,
      stack: error.stack
    })

    // Return safe fallback structure if provided
    if (fallbackData) {
      return fallbackData
    }

    // Return minimal safe structure
    return {
      stats: {
        totalNotes: 0,
        totalInsights: 0,
        totalTasks: 0,
        totalMessages: 0,
        totalOutreach: 0,
        completedTasks: 0,
        taskCompletionRate: 0,
        sentimentDistribution: { positive: 0, neutral: 0, negative: 0 },
        timeRange: { earliest: null, latest: null }
      },
      content: {
        recentInsights: [],
        topTopics: {},
        keyContacts: {},
        commonTasks: {},
        allTasks: [],
        sentimentTrends: [],
        knowledgeTimeline: []
      },
      generatedAt: new Date().toISOString()
    }
  }

  /**
   * Handle generic service errors
   */
  static handleServiceError(error: any, service: string): NextResponse {
    console.error(`❌ ${service} service error:`, error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }

  /**
   * Handle task state service errors
   */
  static handleTaskStateError(error: any): any[] {
    console.warn('⚠️ Could not fetch task states:', error instanceof Error ? error.message : 'Unknown error')
    return []
  }

  /**
   * Create service error object
   */
  static createServiceError(
    message: string,
    code?: string,
    status?: number,
    details?: any
  ): ServiceError {
    return {
      message,
      code,
      status,
      details,
      stack: new Error().stack
    }
  }

  /**
   * Log error with context
   */
  static logError(error: any, context: string, additionalInfo?: any): void {
    console.error(`❌ Error in ${context}:`, {
      error: error,
      message: error.message || 'Unknown error',
      stack: error.stack,
      additionalInfo: additionalInfo || {}
    })
  }

  /**
   * Handle and transform errors for API responses
   */
  static transformErrorForResponse(error: any): { message: string, code?: string } {
    if (typeof error === 'string') {
      return { message: error }
    }

    if (error.message) {
      return {
        message: error.message,
        code: error.code
      }
    }

    return { message: 'An unexpected error occurred' }
  }

  /**
   * Check if error is retryable
   */
  static isRetryableError(error: any): boolean {
    const retryableCodes = ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT']
    const retryableMessages = ['network', 'timeout', 'connection']
    
    const code = error.code || ''
    const message = (error.message || '').toLowerCase()
    
    return retryableCodes.includes(code) || 
           retryableMessages.some(keyword => message.includes(keyword))
  }
}