'use client'

import { supabase } from '@/lib/supabase'
import type { ConnectionStatus } from '@/app/hooks/useConnectionStatus'

export interface PollingConfig {
  userId: string
  baseIntervalMs?: number
  maxIntervalMs?: number
  maxRetries?: number
  backoffMultiplier?: number
  onConnectionStatusChange: (status: ConnectionStatus) => void
  onError: (error: string) => void
  onTaskPinned: (taskId: string) => void
  onTaskUnpinned: (taskId: string) => void
  onPinUpdated: () => void
  onToast: (message: string, type: 'success' | 'info' | 'error') => void
}

interface TaskState {
  id: string
  task_id: string
  user_id: string
  note_id: string
  completed: boolean
  pinned: boolean
  pin_order: number | null
  created_at: string
  updated_at: string
}

export class PollingManager {
  private timeoutId: NodeJS.Timeout | null = null
  private isActive = false
  private retryCount = 0
  private consecutiveNoChangeCount = 0
  private currentIntervalMs: number
  private lastKnownPins: Set<string> = new Set()
  private lastKnownPinsHash: string = ''
  private readonly config: PollingConfig
  private readonly baseIntervalMs: number
  private readonly maxIntervalMs: number
  private readonly maxRetries: number
  private readonly backoffMultiplier: number

  constructor(config: PollingConfig) {
    this.config = config
    this.baseIntervalMs = config.baseIntervalMs ?? 5000 // Start at 5 seconds
    this.maxIntervalMs = config.maxIntervalMs ?? 30000 // Cap at 30 seconds
    this.maxRetries = config.maxRetries ?? 3
    this.backoffMultiplier = config.backoffMultiplier ?? 1.5
    this.currentIntervalMs = this.baseIntervalMs
  }

  start(): void {
    if (this.isActive) {
      console.log('📊 Polling manager already active')
      return
    }

    console.log(`📊 Starting polling with adaptive backoff (base: ${this.baseIntervalMs}ms, max: ${this.maxIntervalMs}ms)`)
    this.isActive = true
    this.currentIntervalMs = this.baseIntervalMs
    this.consecutiveNoChangeCount = 0
    this.config.onConnectionStatusChange('connecting')

    // Initial fetch
    this.fetchTaskPins()
  }

  stop(): void {
    if (!this.isActive) return

    console.log('📊 Stopping polling')
    this.isActive = false

    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }

    this.config.onConnectionStatusChange('disconnected')
    this.retryCount = 0
    this.consecutiveNoChangeCount = 0
    this.currentIntervalMs = this.baseIntervalMs
  }

  private scheduleNextPoll(): void {
    if (!this.isActive) return

    this.timeoutId = setTimeout(() => {
      this.fetchTaskPins()
    }, this.currentIntervalMs)
  }

  private async fetchTaskPins(): Promise<void> {
    if (!this.isActive) return

    try {
      const { data, error } = await supabase
        .from('task_states')
        .select('id, task_id, user_id, note_id, completed, pinned, pin_order, created_at, updated_at')
        .eq('user_id', this.config.userId)
        .eq('pinned', true)
        .order('pin_order', { ascending: true, nullsFirst: false })

      if (error) {
        throw error
      }

      // Process the data and detect changes
      const hasChanges = this.processTaskPinsData(data || [])

      // Adjust polling interval based on activity
      this.adjustPollingInterval(hasChanges)

      // Reset retry count on success
      if (this.retryCount > 0) {
        this.retryCount = 0
        console.log('📊 Polling connection restored')
        this.config.onToast('Connection restored', 'success')
      }

      this.config.onConnectionStatusChange('connected')
      this.config.onError('') // Clear any errors

      // Schedule next poll
      this.scheduleNextPoll()

    } catch (error) {
      console.error('📊 Polling error:', error)
      this.handlePollingError(error as Error)
    }
  }

  private processTaskPinsData(pins: TaskState[]): boolean {
    const currentPins = new Set(pins.map(pin => pin.task_id))

    // Create a hash to detect any changes (including order changes)
    const currentHash = pins.map(p => `${p.task_id}:${p.pin_order}:${p.updated_at}`).join('|')
    const hasChanges = currentHash !== this.lastKnownPinsHash
    this.lastKnownPinsHash = currentHash

    // Check for new pins (added)
    for (const pin of pins) {
      if (!this.lastKnownPins.has(pin.task_id)) {
        console.log('📊 Detected new pin via polling:', pin.task_id)
        this.config.onTaskPinned(pin.task_id)
      }
    }

    // Check for removed pins (unpinned)
    this.lastKnownPins.forEach((oldTaskId) => {
      if (!currentPins.has(oldTaskId)) {
        console.log('📊 Detected removed pin via polling:', oldTaskId)
        this.config.onTaskUnpinned(oldTaskId)
      }
    })

    // Update our known state
    this.lastKnownPins = currentPins

    return hasChanges
  }

  private adjustPollingInterval(hasChanges: boolean): void {
    if (hasChanges) {
      // Reset to base interval on changes - user is active
      this.consecutiveNoChangeCount = 0
      this.currentIntervalMs = this.baseIntervalMs
      console.log(`📊 Data changed, reset to base interval: ${this.currentIntervalMs}ms`)
    } else {
      // Gradually increase interval when no changes
      this.consecutiveNoChangeCount++

      if (this.consecutiveNoChangeCount >= 3) {
        const newInterval = Math.min(
          this.currentIntervalMs * this.backoffMultiplier,
          this.maxIntervalMs
        )

        if (newInterval !== this.currentIntervalMs) {
          this.currentIntervalMs = Math.round(newInterval)
          console.log(`📊 No changes for ${this.consecutiveNoChangeCount} polls, increased interval to ${this.currentIntervalMs}ms`)
        }
      }
    }
  }

  private handlePollingError(error: Error): void {
    this.retryCount++

    if (this.retryCount <= this.maxRetries) {
      // Exponential backoff for errors
      const errorBackoffMs = Math.min(
        this.baseIntervalMs * Math.pow(2, this.retryCount - 1),
        this.maxIntervalMs
      )

      console.log(`📊 Polling retry ${this.retryCount}/${this.maxRetries} in ${errorBackoffMs}ms:`, error.message)
      this.config.onConnectionStatusChange('connecting')
      this.config.onError(`Connection issue, retrying... (${this.retryCount}/${this.maxRetries})`)

      // Schedule retry with backoff
      this.timeoutId = setTimeout(() => {
        this.fetchTaskPins()
      }, errorBackoffMs)
    } else {
      console.error('📊 Max polling retries reached:', error.message)
      this.config.onConnectionStatusChange('error')
      this.config.onError('Unable to maintain connection. Please refresh the page.')
      this.config.onToast('Connection lost. Please refresh the page.', 'error')

      // Stop polling after max retries
      this.stop()
    }
  }

  // Method to force a refresh (useful for manual sync) - resets backoff
  refresh(): void {
    if (this.isActive) {
      // Clear any pending timeout
      if (this.timeoutId) {
        clearTimeout(this.timeoutId)
        this.timeoutId = null
      }

      // Reset to base interval for immediate responsiveness
      this.currentIntervalMs = this.baseIntervalMs
      this.consecutiveNoChangeCount = 0

      this.fetchTaskPins()
    }
  }

  // Get current status
  getStatus(): {
    isActive: boolean
    retryCount: number
    currentIntervalMs: number
    consecutiveNoChangeCount: number
  } {
    return {
      isActive: this.isActive,
      retryCount: this.retryCount,
      currentIntervalMs: this.currentIntervalMs,
      consecutiveNoChangeCount: this.consecutiveNoChangeCount
    }
  }
}