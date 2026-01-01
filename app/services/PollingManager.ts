'use client'

import { supabase } from '@/lib/supabase'
import type { ConnectionStatus } from '@/app/hooks/useConnectionStatus'

export interface PollingConfig {
  userId: string
  intervalMs?: number
  maxRetries?: number
  onConnectionStatusChange: (status: ConnectionStatus) => void
  onError: (error: string) => void
  onTaskPinned: (taskId: string) => void
  onTaskUnpinned: (taskId: string) => void
  onPinUpdated: () => void
  onToast: (message: string, type: 'success' | 'info' | 'error') => void
}

interface TaskPin {
  id: string
  task_id: string
  user_id: string
  created_at: string
  updated_at: string
}

export class PollingManager {
  private intervalId: NodeJS.Timeout | null = null
  private isActive = false
  private retryCount = 0
  private lastKnownPins: Set<string> = new Set()
  private readonly config: PollingConfig
  private readonly intervalMs: number
  private readonly maxRetries: number

  constructor(config: PollingConfig) {
    this.config = config
    this.intervalMs = config.intervalMs ?? 5000 // Default 5 seconds
    this.maxRetries = config.maxRetries ?? 3
  }

  start(): void {
    if (this.isActive) {
      console.log('📊 Polling manager already active')
      return
    }

    console.log(`📊 Starting polling fallback (${this.intervalMs}ms interval)`)
    this.isActive = true
    this.config.onConnectionStatusChange('connecting')
    
    // Initial fetch
    this.fetchTaskPins()
    
    // Set up periodic polling
    this.intervalId = setInterval(() => {
      this.fetchTaskPins()
    }, this.intervalMs)
  }

  stop(): void {
    if (!this.isActive) return

    console.log('📊 Stopping polling fallback')
    this.isActive = false
    
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    
    this.config.onConnectionStatusChange('disconnected')
    this.retryCount = 0
  }

  private async fetchTaskPins(): Promise<void> {
    if (!this.isActive) return

    try {
      const { data, error } = await supabase
        .from('task_pins')
        .select('*')
        .eq('user_id', this.config.userId)
        .order('created_at', { ascending: true })

      if (error) {
        throw error
      }

      // Process the data and detect changes
      this.processTaskPinsData(data || [])
      
      // Reset retry count on success
      if (this.retryCount > 0) {
        this.retryCount = 0
        console.log('📊 Polling connection restored')
        this.config.onToast('Connection restored', 'success')
      }
      
      this.config.onConnectionStatusChange('connected')
      this.config.onError('') // Clear any errors

    } catch (error) {
      console.error('📊 Polling error:', error)
      this.handlePollingError(error as Error)
    }
  }

  private processTaskPinsData(pins: TaskPin[]): void {
    const currentPins = new Set(pins.map(pin => pin.task_id))
    
    // Check for new pins (added)
    for (const pin of pins) {
      if (!this.lastKnownPins.has(pin.task_id)) {
        console.log('📊 Detected new pin via polling:', pin.task_id)
        this.config.onTaskPinned(pin.task_id)
      }
    }
    
    // Check for removed pins (unpinned)
    for (const oldTaskId of this.lastKnownPins) {
      if (!currentPins.has(oldTaskId)) {
        console.log('📊 Detected removed pin via polling:', oldTaskId)
        this.config.onTaskUnpinned(oldTaskId)
      }
    }
    
    // Update our known state
    this.lastKnownPins = currentPins
  }

  private handlePollingError(error: Error): void {
    this.retryCount++
    
    if (this.retryCount <= this.maxRetries) {
      console.log(`📊 Polling retry ${this.retryCount}/${this.maxRetries}:`, error.message)
      this.config.onConnectionStatusChange('connecting')
      this.config.onError(`Connection issue, retrying... (${this.retryCount}/${this.maxRetries})`)
    } else {
      console.error('📊 Max polling retries reached:', error.message)
      this.config.onConnectionStatusChange('error')
      this.config.onError('Unable to maintain connection. Please refresh the page.')
      this.config.onToast('Connection lost. Please refresh the page.', 'error')
      
      // Stop polling after max retries
      this.stop()
    }
  }

  // Method to force a refresh (useful for manual sync)
  refresh(): void {
    if (this.isActive) {
      this.fetchTaskPins()
    }
  }

  // Get current status
  getStatus(): { isActive: boolean; retryCount: number; intervalMs: number } {
    return {
      isActive: this.isActive,
      retryCount: this.retryCount,
      intervalMs: this.intervalMs
    }
  }
}