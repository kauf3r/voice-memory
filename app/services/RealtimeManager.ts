'use client'

import { supabase } from '@/lib/supabase'
import type { ConnectionStatus } from '@/app/hooks/useConnectionStatus'

export interface RealtimeConfig {
  userId: string
  maxReconnectAttempts?: number
  baseRetryDelay?: number
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
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts: number
  private readonly baseRetryDelay: number
  private readonly userId: string
  private readonly callbacks: RealtimeCallbacks
  private isDestroyed = false

  constructor(config: RealtimeConfig, callbacks: RealtimeCallbacks) {
    this.userId = config.userId
    this.maxReconnectAttempts = config.maxReconnectAttempts ?? 5
    this.baseRetryDelay = config.baseRetryDelay ?? 1000
    this.callbacks = callbacks
  }

  async start(): Promise<void> {
    if (this.isDestroyed) return
    await this.setupRealtimeSubscription()
  }

  stop(): void {
    this.isDestroyed = true
    this.cleanup()
  }

  private async setupRealtimeSubscription(attempt = 0): Promise<void> {
    if (this.isDestroyed) return

    try {
      this.callbacks.onConnectionStatusChange('connecting')
      console.log(`🔄 Setting up real-time pin subscription (attempt ${attempt + 1}/${this.maxReconnectAttempts + 1})...`)
      
      // Clean up any existing subscription first
      this.cleanupSubscription()
      
      this.subscription = supabase
        .channel(`task_pins_changes_${Date.now()}`) // Unique channel name to avoid conflicts
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'task_pins',
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

    console.log('📌 Real-time pin change detected:', payload)
    this.callbacks.onSyncTimeUpdate()
    this.callbacks.onError('') // Clear any previous errors
    this.reconnectAttempts = 0 // Reset retry count on successful message
    
    // Handle different types of changes
    switch (payload.eventType) {
      case 'INSERT':
        // Task was pinned
        const newTaskId = payload.new.task_id
        this.callbacks.onTaskPinned(newTaskId)
        console.log('➕ Task pinned via real-time:', newTaskId)
        this.callbacks.onToast('Task pinned!', 'success')
        break
        
      case 'DELETE':
        // Task was unpinned
        const removedTaskId = payload.old.task_id
        this.callbacks.onTaskUnpinned(removedTaskId)
        console.log('➖ Task unpinned via real-time:', removedTaskId)
        this.callbacks.onToast('Task unpinned', 'info')
        break
        
      case 'UPDATE':
        // Pin was updated (order changes, etc.)
        console.log('🔄 Pin updated via real-time')
        this.callbacks.onPinUpdated()
        break
        
      default:
        console.log('🤷 Unknown pin change event:', payload.eventType)
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
        console.log('✅ Real-time pin updates active')
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
    this.callbacks.onConnectionStatusChange('error')
    console.error('❌ Pin subscription error, status:', status)
    this.callbacks.onError(`Real-time connection ${status.toLowerCase()}`)
    
    this.attemptReconnect(`Connection ${status.toLowerCase()}`)
  }

  private handleConnectionClosed(): void {
    this.callbacks.onConnectionStatusChange('disconnected')
    console.log('📡 Subscription closed')
    
    this.attemptReconnect('Connection closed')
  }

  private handleSetupError(err: Error): void {
    console.error('Failed to setup real-time pin subscription:', err)
    this.callbacks.onConnectionStatusChange('error')
    this.callbacks.onError(`Connection failed: ${err.message}`)
    
    this.attemptReconnect('Setup failed')
  }

  private attemptReconnect(reason: string): void {
    if (this.isDestroyed) return

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const retryDelay = this.baseRetryDelay * Math.pow(2, this.reconnectAttempts)
      console.log(`🔄 ${reason}, retrying in ${retryDelay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})...`)
      
      this.retryTimeout = setTimeout(() => {
        if (this.isDestroyed) return
        this.reconnectAttempts++
        this.setupRealtimeSubscription(this.reconnectAttempts)
      }, retryDelay)
    } else {
      console.error('❌ Max reconnection attempts reached, switching to polling fallback')
      this.callbacks.onError('Real-time updates unavailable, using polling')
      // TODO: Implement polling fallback
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
    
    if (this.subscription) {
      console.log('🧹 Cleaning up pin subscription')
      this.cleanupSubscription()
      this.callbacks.onConnectionStatusChange('disconnected')
    }
  }
}