/**
 * Circuit Breaker Service - Handles circuit breaker pattern for external API calls
 */

import { CircuitBreakerConfig } from './interfaces'

export class CircuitBreakerService {
  private failures = 0
  private lastFailureTime = 0
  private isOpen = false
  private readonly config: CircuitBreakerConfig
  private readonly errorTypes = new Map<string, number>()

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      failureThreshold: config?.failureThreshold || 5,
      timeoutMs: config?.timeoutMs || 5 * 60 * 1000, // 5 minutes
      resetTimeoutMs: config?.resetTimeoutMs || 30 * 1000, // 30 seconds
    }
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit breaker should be reset
    if (this.isOpen) {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeoutMs) {
        this.resetCircuitBreaker()
      } else {
        throw new Error('Circuit breaker is open - External API temporarily unavailable')
      }
    }

    try {
      const result = await Promise.race([
        operation(),
        this.createTimeoutPromise()
      ])
      
      // Success - reset failure count
      this.onSuccess()
      return result
      
    } catch (error) {
      this.onFailure(error)
      throw error
    }
  }

  private createTimeoutPromise<T>(): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${this.config.timeoutMs}ms`))
      }, this.config.timeoutMs)
    })
  }

  private onSuccess(): void {
    if (this.failures > 0) {
      console.log(`Circuit breaker: successful call, resetting failure count from ${this.failures} to 0`)
    }
    this.failures = 0
  }

  private onFailure(error: unknown): void {
    this.failures++
    this.lastFailureTime = Date.now()
    
    // Track error types for better debugging
    if (error instanceof Error) {
      const errorType = this.categorizeError(error.message)
      this.errorTypes.set(errorType, (this.errorTypes.get(errorType) || 0) + 1)
    }
    
    if (this.failures >= this.config.failureThreshold) {
      this.openCircuitBreaker()
    }
    
    console.log(`Circuit breaker: failure ${this.failures}/${this.config.failureThreshold}`, {
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      isOpen: this.isOpen
    })
  }

  private openCircuitBreaker(): void {
    this.isOpen = true
    console.log(`🚨 Circuit breaker: OPENED after ${this.failures} failures`)
    console.log('Error type distribution:', Object.fromEntries(this.errorTypes))
  }

  private resetCircuitBreaker(): void {
    this.isOpen = false
    this.failures = 0
    console.log('✅ Circuit breaker: RESET to closed state')
  }

  private categorizeError(errorMessage: string): string {
    const message = errorMessage.toLowerCase()
    
    if (message.includes('rate limit')) return 'rate_limit'
    if (message.includes('timeout')) return 'timeout'
    if (message.includes('network')) return 'network'
    if (message.includes('authentication')) return 'auth'
    if (message.includes('quota')) return 'quota'
    if (message.includes('server error') || message.includes('5')) return 'server_error'
    if (message.includes('bad request') || message.includes('4')) return 'client_error'
    
    return 'unknown'
  }

  // Public methods for monitoring
  getStatus() {
    return {
      isOpen: this.isOpen,
      failures: this.failures,
      errorTypes: Object.fromEntries(this.errorTypes),
      lastFailureTime: this.lastFailureTime,
      config: this.config
    }
  }

  getHealthStatus(): 'healthy' | 'degraded' | 'unhealthy' {
    if (this.isOpen) {
      return 'unhealthy'
    }
    
    if (this.failures > this.config.failureThreshold * 0.7) {
      return 'degraded'
    }
    
    return 'healthy'
  }

  // Force operations for testing or emergency situations
  forceOpen(): void {
    this.isOpen = true
    this.failures = this.config.failureThreshold
    this.lastFailureTime = Date.now()
    console.log('⚠️ Circuit breaker: FORCE OPENED')
  }

  forceClose(): void {
    this.isOpen = false
    this.failures = 0
    this.errorTypes.clear()
    console.log('⚠️ Circuit breaker: FORCE CLOSED')
  }

  // Get time until circuit breaker resets
  getTimeUntilReset(): number {
    if (!this.isOpen) {
      return 0
    }
    
    const elapsed = Date.now() - this.lastFailureTime
    return Math.max(0, this.config.resetTimeoutMs - elapsed)
  }

  // Update configuration
  updateConfig(newConfig: Partial<CircuitBreakerConfig>): void {
    this.config.failureThreshold = newConfig.failureThreshold ?? this.config.failureThreshold
    this.config.timeoutMs = newConfig.timeoutMs ?? this.config.timeoutMs
    this.config.resetTimeoutMs = newConfig.resetTimeoutMs ?? this.config.resetTimeoutMs
    
    console.log('Circuit breaker configuration updated:', this.config)
  }

  // Statistics for monitoring
  getStatistics() {
    const totalErrors = Array.from(this.errorTypes.values()).reduce((sum, count) => sum + count, 0)
    const errorRate = totalErrors > 0 ? this.failures / totalErrors : 0
    
    return {
      totalFailures: this.failures,
      totalErrors,
      errorRate,
      timeOpen: this.isOpen ? Date.now() - this.lastFailureTime : 0,
      errorTypeDistribution: Object.fromEntries(this.errorTypes),
      config: this.config
    }
  }
}