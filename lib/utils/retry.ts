/**
 * Retry Utility for Transient Failures
 * 
 * Implements exponential backoff with jitter for handling transient errors,
 * particularly for external API calls like OpenAI.
 */

export interface RetryConfig {
  maxAttempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
  jitterMs?: number
  retryableErrors?: string[]
  onRetry?: (attempt: number, error: Error, delayMs: number) => void
}

export interface RetryResult<T> {
  success: boolean
  data?: T
  error?: Error
  attempts: number
  totalDelayMs: number
}

// Default configuration
const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterMs: 500,
  retryableErrors: [
    'rate_limit',
    'rate limit',
    '429',
    'timeout',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    '503',
    '502',
    '504',
    'service_unavailable',
    'service unavailable',
    'temporarily unavailable',
    'gateway_timeout'
  ],
  onRetry: () => {}
}

/**
 * Circuit breaker for tracking failure patterns
 */
export class CircuitBreaker {
  private failures: Map<string, number[]> = new Map()
  private readonly windowMs = 60000 // 1 minute window
  private readonly threshold = 5
  
  isOpen(key: string): boolean {
    const now = Date.now()
    const failures = this.failures.get(key) || []
    
    // Clean old failures
    const recentFailures = failures.filter(time => now - time < this.windowMs)
    
    if (recentFailures.length !== failures.length) {
      this.failures.set(key, recentFailures)
    }
    
    return recentFailures.length >= this.threshold
  }
  
  recordFailure(key: string): void {
    const failures = this.failures.get(key) || []
    failures.push(Date.now())
    this.failures.set(key, failures)
  }
  
  reset(key: string): void {
    this.failures.delete(key)
  }
  
  getFailureCount(key: string): number {
    const now = Date.now()
    const failures = this.failures.get(key) || []
    return failures.filter(time => now - time < this.windowMs).length
  }
}

// Global circuit breaker instance
const circuitBreaker = new CircuitBreaker()

/**
 * Determine if an error is retryable based on the error message
 */
function isRetryableError(error: Error, retryableErrors: string[]): boolean {
  const errorMessage = error.message.toLowerCase()
  
  return retryableErrors.some(pattern => 
    errorMessage.includes(pattern.toLowerCase())
  )
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number,
  jitterMs: number
): number {
  // Exponential backoff
  const exponentialDelay = baseDelayMs * Math.pow(backoffMultiplier, attempt - 1)
  
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * jitterMs
  
  // Cap at maximum delay
  return Math.min(exponentialDelay + jitter, maxDelayMs)
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry an operation with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config?: RetryConfig,
  circuitKey?: string
): Promise<RetryResult<T>> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  let lastError: Error | undefined
  let totalDelayMs = 0
  
  // Check circuit breaker if key provided
  if (circuitKey && circuitBreaker.isOpen(circuitKey)) {
    return {
      success: false,
      error: new Error(`Circuit breaker open for ${circuitKey}. Too many failures in recent time window.`),
      attempts: 0,
      totalDelayMs: 0
    }
  }
  
  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      const result = await operation()
      
      // Reset circuit breaker on success
      if (circuitKey) {
        circuitBreaker.reset(circuitKey)
      }
      
      return {
        success: true,
        data: result,
        attempts: attempt,
        totalDelayMs
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // Check if error is retryable
      if (!isRetryableError(lastError, finalConfig.retryableErrors)) {
        // Record failure for circuit breaker
        if (circuitKey) {
          circuitBreaker.recordFailure(circuitKey)
        }
        
        return {
          success: false,
          error: lastError,
          attempts: attempt,
          totalDelayMs
        }
      }
      
      // Don't retry if this was the last attempt
      if (attempt === finalConfig.maxAttempts) {
        // Record failure for circuit breaker
        if (circuitKey) {
          circuitBreaker.recordFailure(circuitKey)
        }
        
        return {
          success: false,
          error: lastError,
          attempts: attempt,
          totalDelayMs
        }
      }
      
      // Calculate delay and sleep
      const delayMs = calculateDelay(
        attempt,
        finalConfig.baseDelayMs,
        finalConfig.maxDelayMs,
        finalConfig.backoffMultiplier,
        finalConfig.jitterMs
      )
      
      totalDelayMs += delayMs
      
      // Call retry callback
      finalConfig.onRetry(attempt, lastError, delayMs)
      
      // Sleep before next attempt
      await sleep(delayMs)
    }
  }
  
  // Should never reach here, but for TypeScript
  return {
    success: false,
    error: lastError || new Error('Unknown error'),
    attempts: finalConfig.maxAttempts,
    totalDelayMs
  }
}

/**
 * Retry queue for managing failed requests
 */
export class RetryQueue<T = any> {
  private queue: Array<{
    id: string
    operation: () => Promise<T>
    config?: RetryConfig
    timestamp: number
    retryCount: number
  }> = []
  
  private processing = false
  private readonly maxQueueSize = 100
  private readonly maxRetryCount = 5
  
  /**
   * Add an operation to the retry queue
   */
  enqueue(
    id: string,
    operation: () => Promise<T>,
    config?: RetryConfig
  ): boolean {
    if (this.queue.length >= this.maxQueueSize) {
      console.warn('Retry queue is full, dropping request:', id)
      return false
    }
    
    // Check if already in queue
    const existing = this.queue.find(item => item.id === id)
    if (existing) {
      existing.retryCount++
      if (existing.retryCount > this.maxRetryCount) {
        // Remove from queue if too many retries
        this.queue = this.queue.filter(item => item.id !== id)
        console.warn('Max retry count reached for request:', id)
        return false
      }
      return true
    }
    
    this.queue.push({
      id,
      operation,
      config,
      timestamp: Date.now(),
      retryCount: 1
    })
    
    // Start processing if not already running
    if (!this.processing) {
      this.processQueue()
    }
    
    return true
  }
  
  /**
   * Process the retry queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return
    }
    
    this.processing = true
    
    while (this.queue.length > 0) {
      const item = this.queue.shift()
      if (!item) continue
      
      // Check if item is too old (older than 5 minutes)
      if (Date.now() - item.timestamp > 300000) {
        console.warn('Dropping stale request from retry queue:', item.id)
        continue
      }
      
      const result = await withRetry(item.operation, item.config)
      
      if (!result.success) {
        // Re-enqueue if still retryable
        if (item.retryCount < this.maxRetryCount) {
          item.retryCount++
          item.timestamp = Date.now()
          this.queue.push(item)
        } else {
          console.error('Failed to process after max retries:', item.id, result.error)
        }
      }
      
      // Add delay between queue items to prevent overwhelming the system
      await sleep(1000)
    }
    
    this.processing = false
  }
  
  /**
   * Get queue status
   */
  getStatus(): {
    size: number
    processing: boolean
    oldestItem: number | null
  } {
    const oldestItem = this.queue.length > 0
      ? Date.now() - Math.min(...this.queue.map(item => item.timestamp))
      : null
    
    return {
      size: this.queue.length,
      processing: this.processing,
      oldestItem
    }
  }
  
  /**
   * Clear the queue
   */
  clear(): void {
    this.queue = []
  }
}

// Export singleton instances
export const retryQueue = new RetryQueue()
export { circuitBreaker }

// Helper function for OpenAI-specific retry logic
export async function retryOpenAIOperation<T>(
  operation: () => Promise<T>,
  operationName?: string
): Promise<RetryResult<T>> {
  return withRetry(
    operation,
    {
      maxAttempts: 3,
      baseDelayMs: 2000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
      jitterMs: 1000,
      retryableErrors: [
        'rate_limit',
        'rate limit',
        '429',
        'timeout',
        'ECONNRESET',
        'ETIMEDOUT',
        'service_unavailable',
        'gateway_timeout',
        'openai',
        'network'
      ],
      onRetry: (attempt, error, delayMs) => {
        console.log(`🔄 Retrying ${operationName || 'OpenAI operation'} (attempt ${attempt}): ${error.message}`)
        console.log(`⏳ Waiting ${delayMs}ms before retry...`)
      }
    },
    operationName ? `openai_${operationName}` : 'openai'
  )
}