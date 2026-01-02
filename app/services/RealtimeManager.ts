'use client'

import { supabase } from '@/lib/supabase'
import type { ConnectionStatus } from '@/app/hooks/useConnectionStatus'
import { PollingManager, type PollingConfig } from './PollingManager'

export interface RealtimeConfig {
  userId: string
  maxReconnectAttempts?: number
  baseRetryDelay?: number
  circuitBreakerThreshold?: number
  healthCheckInterval?: number
}

export interface RealtimeCallbacks {
  onConnectionStatusChange: (status: ConnectionStatus) => void
  onError: (error: string) => void
  onSyncTimeUpdate: () => void
  onTaskPinned: (taskId: string) => void
  onTaskUnpinned: (taskId: string) => void
  onPinUpdated: () => void
  onToast: (message: string, type: 'success' | 'info' | 'error') => void
}

export class RealtimeManager {
  private subscription: any = null
  private retryTimeout: NodeJS.Timeout | null = null
  private healthCheckInterval: NodeJS.Timeout | null = null
  private reconnectAttempts = 0
  private consecutiveFailures = 0
  private lastSuccessfulConnection = 0
  private circuitBreakerOpen = false
  
  private readonly maxReconnectAttempts: number
  private readonly baseRetryDelay: number
  private readonly userId: string
  private readonly callbacks: RealtimeCallbacks
  private readonly circuitBreakerThreshold: number
  private readonly healthCheckIntervalMs: number
  private isDestroyed = false
  
  // Polling fallback
  private pollingManager: PollingManager | null = null
  private usingPollingFallback = false

  constructor(config: RealtimeConfig, callbacks: RealtimeCallbacks) {
    this.userId = config.userId
    this.maxReconnectAttempts = config.maxReconnectAttempts ?? 5
    this.baseRetryDelay = config.baseRetryDelay ?? 1000
    this.circuitBreakerThreshold = config.circuitBreakerThreshold ?? 3
    this.healthCheckIntervalMs = config.healthCheckInterval ?? 30000 // 30 seconds
    this.callbacks = callbacks
    
    // Initialize polling manager with adaptive backoff
    this.pollingManager = new PollingManager({
      userId: this.userId,
      baseIntervalMs: 5000, // Start at 5 seconds, increases with backoff
      maxRetries: 3,
      onConnectionStatusChange: callbacks.onConnectionStatusChange,
      onError: callbacks.onError,
      onTaskPinned: callbacks.onTaskPinned,
      onTaskUnpinned: callbacks.onTaskUnpinned,
      onPinUpdated: callbacks.onPinUpdated,
      onToast: callbacks.onToast
    })
  }

  async start(): Promise<void> {
    if (this.isDestroyed) return
    
    // Check circuit breaker
    if (this.circuitBreakerOpen && !this.shouldAttemptReconnect()) {
      console.log('🔒 Circuit breaker is open, using polling fallback')
      this.switchToPollingFallback()
      return
    }
    
    await this.setupRealtimeSubscription()
    this.startHealthCheck()
  }

  stop(): void {
    this.isDestroyed = true
    this.cleanup()
  }

  // Force switch to polling (useful for testing or manual override)
  switchToPollingFallback(): void {
    if (this.usingPollingFallback) return

    console.log('📊 Switching to polling fallback mode')
    this.usingPollingFallback = true
    
    // Stop WebSocket if active
    this.cleanupSubscription()
    
    // Start polling
    this.pollingManager?.start()
    this.callbacks.onToast('Using backup connection mode', 'info')
  }

  // Try to switch back to WebSocket
  switchToRealtimeMode(): void {
    if (!this.usingPollingFallback) return
    
    console.log('🔄 Attempting to switch back to real-time mode')
    this.usingPollingFallback = false
    
    // Stop polling
    this.pollingManager?.stop()
    
    // Reset circuit breaker
    this.circuitBreakerOpen = false
    this.consecutiveFailures = 0
    this.reconnectAttempts = 0
    
    // Try WebSocket again
    this.setupRealtimeSubscription()
  }

  private async setupRealtimeSubscription(attempt = 0): Promise<void> {
    if (this.isDestroyed) return

    try {
      this.callbacks.onConnectionStatusChange('connecting')
      console.log(`🔄 Setting up real-time pin subscription (attempt ${attempt + 1}/${this.maxReconnectAttempts + 1})...`)
      
      // Clean up any existing subscription first
      this.cleanupSubscription()
      
      this.subscription = supabase
        .channel(`task_states_changes_${Date.now()}`) // Unique channel name to avoid conflicts
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'task_states',
            filter: `user_id=eq.${this.userId}`
          },
          (payload) => this.handleRealtimeChange(payload)
        )
        .subscribe((status) => this.handleSubscriptionStatus(status))
    } catch (err) {
      this.handleSetupError(err as Error)
    }
  }

  private handleRealtimeChange(payload: any): void {
    if (this.isDestroyed) return

    console.log('📌 Real-time task_states change detected:', payload)
    this.callbacks.onSyncTimeUpdate()
    this.callbacks.onError('') // Clear any previous errors
    this.reconnectAttempts = 0 // Reset retry count on successful message

    // Handle different types of changes
    switch (payload.eventType) {
      case 'INSERT':
        // New task state created - check if it's pinned
        if (payload.new.pinned) {
          const newTaskId = payload.new.task_id
          this.callbacks.onTaskPinned(newTaskId)
          console.log('➕ Task pinned via real-time:', newTaskId)
          this.callbacks.onToast('Task pinned!', 'success')
        }
        break

      case 'DELETE':
        // Task state deleted - if it was pinned, notify unpin
        if (payload.old.pinned) {
          const removedTaskId = payload.old.task_id
          this.callbacks.onTaskUnpinned(removedTaskId)
          console.log('➖ Task unpinned via real-time:', removedTaskId)
          this.callbacks.onToast('Task unpinned', 'info')
        }
        break

      case 'UPDATE':
        // Task state updated - check for pin status changes
        const oldPinned = payload.old?.pinned
        const newPinned = payload.new?.pinned
        const taskId = payload.new.task_id

        if (!oldPinned && newPinned) {
          // Task was just pinned
          this.callbacks.onTaskPinned(taskId)
          console.log('➕ Task pinned via real-time:', taskId)
          this.callbacks.onToast('Task pinned!', 'success')
        } else if (oldPinned && !newPinned) {
          // Task was just unpinned
          this.callbacks.onTaskUnpinned(taskId)
          console.log('➖ Task unpinned via real-time:', taskId)
          this.callbacks.onToast('Task unpinned', 'info')
        } else if (newPinned) {
          // Pin order or other pin-related update
          console.log('🔄 Pin updated via real-time')
          this.callbacks.onPinUpdated()
        }
        break

      default:
        console.log('🤷 Unknown task_states change event:', payload.eventType)
    }
  }

  private handleSubscriptionStatus(status: string): void {
    if (this.isDestroyed) return

    console.log('📡 Pin subscription status:', status)
    switch (status) {
      case 'SUBSCRIBED':
        this.callbacks.onConnectionStatusChange('connected')
        this.callbacks.onSyncTimeUpdate()
        this.callbacks.onError('')
        this.reconnectAttempts = 0
        this.consecutiveFailures = 0
        this.lastSuccessfulConnection = Date.now()
        this.circuitBreakerOpen = false
        console.log('✅ Real-time pin updates active')
        
        // If we were using polling fallback, we can stop it now
        if (this.usingPollingFallback) {
          console.log('📊 WebSocket restored, stopping polling fallback')
          this.pollingManager?.stop()
          this.usingPollingFallback = false
          this.callbacks.onToast('Real-time connection restored!', 'success')
        }
        break
        
      case 'CHANNEL_ERROR':
      case 'TIMED_OUT':
        this.handleConnectionError(status)
        break
        
      case 'CLOSED':
        this.handleConnectionClosed()
        break
        
      default:
        this.callbacks.onConnectionStatusChange('connecting')
        console.log('📡 Connection status:', status)
    }
  }

  private handleConnectionError(status: string): void {
    this.consecutiveFailures++
    console.error('❌ Pin subscription error, status:', status, `(failure ${this.consecutiveFailures})`)
    
    // Check circuit breaker threshold
    if (this.consecutiveFailures >= this.circuitBreakerThreshold) {
      console.error('🔒 Circuit breaker triggered - too many consecutive failures')
      this.circuitBreakerOpen = true
      this.switchToPollingFallback()
      return
    }
    
    this.callbacks.onConnectionStatusChange('error')
    this.callbacks.onError(`Real-time connection ${status.toLowerCase()}`)
    
    this.attemptReconnect(`Connection ${status.toLowerCase()}`)
  }

  private handleConnectionClosed(): void {
    this.callbacks.onConnectionStatusChange('disconnected')
    console.log('📡 Subscription closed')
    
    // Don't treat a clean close as a failure
    this.attemptReconnect('Connection closed')
  }

  private handleSetupError(err: Error): void {
    this.consecutiveFailures++
    console.error('Failed to setup real-time pin subscription:', err, `(failure ${this.consecutiveFailures})`)
    
    // Check circuit breaker threshold
    if (this.consecutiveFailures >= this.circuitBreakerThreshold) {
      console.error('🔒 Circuit breaker triggered - too many setup failures')
      this.circuitBreakerOpen = true
      this.switchToPollingFallback()
      return
    }
    
    this.callbacks.onConnectionStatusChange('error')
    this.callbacks.onError(`Connection failed: ${err.message}`)
    
    this.attemptReconnect('Setup failed')
  }

  private attemptReconnect(reason: string): void {
    if (this.isDestroyed) return

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.3 + 0.85 // 0.85 to 1.15 multiplier
      const retryDelay = Math.min(
        this.baseRetryDelay * Math.pow(2, this.reconnectAttempts) * jitter,
        30000 // Max 30 seconds
      )
      
      console.log(`🔄 ${reason}, retrying in ${Math.round(retryDelay)}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})...`)
      
      this.retryTimeout = setTimeout(() => {
        if (this.isDestroyed) return
        this.reconnectAttempts++
        this.setupRealtimeSubscription(this.reconnectAttempts)
      }, retryDelay)
    } else {
      console.error('❌ Max reconnection attempts reached, switching to polling fallback')
      this.callbacks.onError('Real-time updates unavailable, using backup mode')
      this.switchToPollingFallback()
    }
  }

  private shouldAttemptReconnect(): boolean {
    // Allow reconnection attempts every 2 minutes when circuit breaker is open
    const timeSinceLastSuccess = Date.now() - this.lastSuccessfulConnection
    return timeSinceLastSuccess > 120000 // 2 minutes
  }

  private startHealthCheck(): void {
    if (this.healthCheckInterval || this.isDestroyed) return
    
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck()
    }, this.healthCheckIntervalMs)
  }

  private performHealthCheck(): void {
    if (this.isDestroyed || this.usingPollingFallback) return
    
    // If we haven't had a successful connection in a while, consider switching to polling
    const timeSinceLastSuccess = Date.now() - this.lastSuccessfulConnection
    
    if (timeSinceLastSuccess > 300000) { // 5 minutes
      console.log('🔍 Health check: No successful connection for 5+ minutes, switching to polling')
      this.switchToPollingFallback()
    } else if (this.circuitBreakerOpen && this.shouldAttemptReconnect()) {
      console.log('🔍 Health check: Attempting to restore WebSocket connection')
      this.switchToRealtimeMode()
    }
  }

  private cleanupSubscription(): void {
    if (this.subscription) {
      supabase.removeChannel(this.subscription)
      this.subscription = null
    }
  }

  private cleanup(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
      this.retryTimeout = null
    }
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
    
    if (this.subscription) {
      console.log('🧹 Cleaning up pin subscription')
      this.cleanupSubscription()
      this.callbacks.onConnectionStatusChange('disconnected')
    }
    
    // Stop polling manager
    if (this.pollingManager) {
      this.pollingManager.stop()
    }
  }

  // Public method to get current connection status and metrics
  getConnectionMetrics() {
    return {
      isWebSocketActive: !this.usingPollingFallback && !!this.subscription,
      isPollingActive: this.usingPollingFallback,
      reconnectAttempts: this.reconnectAttempts,
      consecutiveFailures: this.consecutiveFailures,
      circuitBreakerOpen: this.circuitBreakerOpen,
      lastSuccessfulConnection: this.lastSuccessfulConnection,
      pollingStatus: this.pollingManager?.getStatus()
    }
  }
}