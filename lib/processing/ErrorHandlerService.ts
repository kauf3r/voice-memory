/**
 * Error Handler Service - Handles error classification and retry logic
 */

import { ErrorHandler, ErrorClassification, ProcessingContext } from './interfaces'

export class ErrorHandlerService implements ErrorHandler {
  private readonly maxAttempts: number
  private readonly baseRetryDelay: number

  constructor(maxAttempts: number = 3, baseRetryDelay: number = 1000) {
    this.maxAttempts = maxAttempts
    this.baseRetryDelay = baseRetryDelay
  }

  classifyError(error: Error | string): ErrorClassification {
    const message = typeof error === 'string' ? error : error.message
    const lowerMessage = message.toLowerCase()
    
    // Database/Migration specific errors (highest priority)
    if (lowerMessage.includes('column') && lowerMessage.includes('does not exist')) {
      return {
        category: 'missing_migration',
        severity: 'critical',
        retryable: false
      }
    }
    
    if (lowerMessage.includes('relation') && lowerMessage.includes('does not exist')) {
      return {
        category: 'missing_table',
        severity: 'critical',
        retryable: false
      }
    }
    
    if (lowerMessage.includes('function') && lowerMessage.includes('does not exist')) {
      return {
        category: 'missing_function',
        severity: 'critical',
        retryable: false
      }
    }
    
    // Timeout errors
    if (lowerMessage.includes('timeout') || lowerMessage.includes('time out')) {
      return {
        category: 'timeout',
        severity: 'medium',
        retryable: true,
        retryDelayMs: 2000
      }
    }
    
    // Rate limit errors
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests')) {
      return {
        category: 'rate_limit',
        severity: 'medium',
        retryable: true,
        retryDelayMs: 5000
      }
    }
    
    // OpenAI API errors
    if (lowerMessage.includes('openai') || lowerMessage.includes('api') || lowerMessage.includes('model')) {
      const severity = lowerMessage.includes('quota') || lowerMessage.includes('billing') ? 'high' : 'medium'
      return {
        category: 'api_error',
        severity,
        retryable: !lowerMessage.includes('quota') && !lowerMessage.includes('authentication'),
        retryDelayMs: 3000
      }
    }
    
    // Validation errors
    if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
      return {
        category: 'validation',
        severity: 'low',
        retryable: false
      }
    }
    
    // Network errors
    if (lowerMessage.includes('network') || lowerMessage.includes('connection') || lowerMessage.includes('fetch')) {
      return {
        category: 'network',
        severity: 'medium',
        retryable: true,
        retryDelayMs: 2000
      }
    }
    
    // Storage errors
    if (lowerMessage.includes('storage') || lowerMessage.includes('file') || lowerMessage.includes('download')) {
      return {
        category: 'storage',
        severity: 'medium',
        retryable: true,
        retryDelayMs: 1500
      }
    }
    
    // Lock/concurrency errors
    if (lowerMessage.includes('lock') || lowerMessage.includes('concurrent')) {
      return {
        category: 'concurrency',
        severity: 'low',
        retryable: true,
        retryDelayMs: 1000
      }
    }
    
    // Authentication errors
    if (lowerMessage.includes('authentication') || lowerMessage.includes('authorization')) {
      return {
        category: 'auth',
        severity: 'high',
        retryable: false
      }
    }
    
    // Quota errors
    if (lowerMessage.includes('quota') || lowerMessage.includes('billing')) {
      return {
        category: 'quota',
        severity: 'high',
        retryable: false
      }
    }
    
    // Circuit breaker errors
    if (lowerMessage.includes('circuit breaker')) {
      return {
        category: 'circuit_breaker',
        severity: 'high',
        retryable: true,
        retryDelayMs: 10000 // Wait longer for circuit breaker to reset
      }
    }
    
    // Resource errors
    if (lowerMessage.includes('memory') || lowerMessage.includes('resource')) {
      return {
        category: 'resource',
        severity: 'high',
        retryable: true,
        retryDelayMs: 5000
      }
    }
    
    // Database errors
    if (lowerMessage.includes('database') || lowerMessage.includes('supabase')) {
      return {
        category: 'database',
        severity: 'medium',
        retryable: true,
        retryDelayMs: 2000
      }
    }
    
    // Video processing errors
    if (lowerMessage.includes('video') || lowerMessage.includes('codec')) {
      return {
        category: 'video_processing',
        severity: 'medium',
        retryable: false // Video processing issues are usually format-related
      }
    }
    
    // Transcription specific errors
    if (lowerMessage.includes('transcription') || lowerMessage.includes('whisper')) {
      return {
        category: 'transcription',
        severity: 'medium',
        retryable: true,
        retryDelayMs: 3000
      }
    }
    
    // Analysis specific errors
    if (lowerMessage.includes('analysis') || lowerMessage.includes('gpt')) {
      return {
        category: 'analysis',
        severity: 'medium',
        retryable: true,
        retryDelayMs: 3000
      }
    }
    
    // Default classification
    return {
      category: 'unknown',
      severity: 'medium',
      retryable: true,
      retryDelayMs: this.baseRetryDelay
    }
  }

  shouldRetry(classification: ErrorClassification, attempts: number): boolean {
    // Never retry if explicitly marked as non-retryable
    if (!classification.retryable) {
      return false
    }
    
    // Never retry if max attempts reached
    if (attempts >= this.maxAttempts) {
      return false
    }
    
    // Never retry critical errors
    if (classification.severity === 'critical') {
      return false
    }
    
    // High severity errors get fewer retry attempts
    if (classification.severity === 'high' && attempts >= 2) {
      return false
    }
    
    return true
  }

  getRetryDelay(classification: ErrorClassification, attempts: number): number {
    const baseDelay = classification.retryDelayMs || this.baseRetryDelay
    
    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, attempts - 1)
    const jitter = Math.random() * 0.1 * exponentialDelay // Add up to 10% jitter
    
    return Math.min(exponentialDelay + jitter, 30000) // Cap at 30 seconds
  }

  logError(context: ProcessingContext, error: Error | string): void {
    const classification = this.classifyError(error)
    const errorMessage = typeof error === 'string' ? error : error.message
    
    console.error('🚨 Processing error occurred:', {
      noteId: context.noteId,
      userId: context.userId,
      stage: context.metrics.processingStage,
      attempts: context.metrics.attempts,
      errorMessage,
      classification: {
        category: classification.category,
        severity: classification.severity,
        retryable: classification.retryable
      },
      timestamp: new Date().toISOString()
    })
    
    // Log stack trace for unknown errors
    if (classification.category === 'unknown' && error instanceof Error && error.stack) {
      console.error('Error stack trace:', error.stack)
    }
  }

  categorizeForMetrics(error: Error | string): string {
    return this.classifyError(error).category
  }

  isRetryableError(error: Error | string): boolean {
    return this.classifyError(error).retryable
  }

  isCriticalError(error: Error | string): boolean {
    return this.classifyError(error).severity === 'critical'
  }

  getErrorSeverity(error: Error | string): 'low' | 'medium' | 'high' | 'critical' {
    return this.classifyError(error).severity
  }

  // Enhanced error reporting for monitoring
  getErrorReport(errors: Array<{ error: Error | string; context?: any }>): any {
    const errorCategories: Record<string, number> = {}
    const severityBreakdown: Record<string, number> = {}
    const retryableCount = { retryable: 0, nonRetryable: 0 }
    
    errors.forEach(({ error }) => {
      const classification = this.classifyError(error)
      
      // Count categories
      errorCategories[classification.category] = (errorCategories[classification.category] || 0) + 1
      
      // Count severity levels
      severityBreakdown[classification.severity] = (severityBreakdown[classification.severity] || 0) + 1
      
      // Count retryable vs non-retryable
      if (classification.retryable) {
        retryableCount.retryable++
      } else {
        retryableCount.nonRetryable++
      }
    })
    
    return {
      totalErrors: errors.length,
      categories: errorCategories,
      severity: severityBreakdown,
      retryability: retryableCount,
      timestamp: new Date().toISOString()
    }
  }
}