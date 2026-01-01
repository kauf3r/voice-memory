/**
 * Unified Connection State Manager
 * Centralizes connection management across WebSocket and HTTP polling modes
 * Addresses architecture issues with mixed responsibilities and inconsistent state management
 */

'use client'

export type ConnectionMode = 'websocket' | 'polling' | 'disconnected' | 'initializing'
export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface ConnectionState {
  mode: ConnectionMode
  status: ConnectionStatus
  quality: ConnectionQuality
  lastConnected: Date | null
  lastError: string | null
  reconnectAttempts: number
  totalFailures: number
  uptime: number
  latency: number
  isStable: boolean
  metadata: Record<string, any>
}

export interface ConnectionMetrics {
  totalAttempts: number
  successfulConnections: number
  failedConnections: number
  averageLatency: number
  uptimePercentage: number
  lastErrorTime: Date | null
  connectionDuration: number
}

export interface StateChangeEvent {
  previous: Partial<ConnectionState>
  current: Partial<ConnectionState>
  timestamp: Date
  trigger: string
}

export interface ConnectionStateCallbacks {
  onStateChange: (event: StateChangeEvent) => void
  onModeSwitch: (from: ConnectionMode, to: ConnectionMode) => void
  onQualityChange: (from: ConnectionQuality, to: ConnectionQuality) => void
  onStabilityChange: (isStable: boolean) => void
}

export class UnifiedConnectionStateManager {
  private state: ConnectionState
  private callbacks: ConnectionStateCallbacks
  private stateHistory: StateChangeEvent[] = []
  private metricsStartTime: Date
  
  // Performance tracking
  private lastLatencyCheck = 0
  private latencyMeasurements: number[] = []
  private stabilityWindow: boolean[] = []
  private readonly maxHistoryLength = 50
  private readonly stabilityWindowSize = 10
  private readonly latencyThreshold = {
    excellent: 50,    // < 50ms
    good: 150,        // < 150ms  
    fair: 500,        // < 500ms
    poor: 2000,       // < 2s
    critical: Infinity // >= 2s
  }

  constructor(callbacks: ConnectionStateCallbacks) {
    this.callbacks = callbacks
    this.metricsStartTime = new Date()
    
    // Initialize state
    this.state = {
      mode: 'initializing',
      status: 'disconnected',
      quality: 'critical',
      lastConnected: null,
      lastError: null,
      reconnectAttempts: 0,
      totalFailures: 0,
      uptime: 0,
      latency: 0,
      isStable: false,
      metadata: {}
    }
    
    console.log('🔄 UnifiedConnectionStateManager initialized')
  }

  /**
   * Get current connection state (immutable copy)
   */
  getState(): Readonly<ConnectionState> {
    return { ...this.state }
  }

  /**
   * Get connection metrics
   */
  getMetrics(): ConnectionMetrics {
    const now = new Date()
    const totalTime = now.getTime() - this.metricsStartTime.getTime()
    const uptime = this.calculateUptime()
    
    const successfulConnections = this.stateHistory.filter(
      event => event.current.status === 'connected'
    ).length
    
    const failedConnections = this.state.totalFailures
    const totalAttempts = successfulConnections + failedConnections

    return {
      totalAttempts,
      successfulConnections,
      failedConnections,
      averageLatency: this.calculateAverageLatency(),
      uptimePercentage: totalTime > 0 ? (uptime / totalTime) * 100 : 0,
      lastErrorTime: this.state.lastError ? this.findLastErrorTime() : null,
      connectionDuration: this.state.lastConnected ? 
        now.getTime() - this.state.lastConnected.getTime() : 0
    }
  }

  /**
   * Update connection mode
   */
  setConnectionMode(mode: ConnectionMode, trigger: string = 'manual'): void {
    if (this.state.mode === mode) return
    
    const previousMode = this.state.mode
    this.updateState({ mode }, trigger)
    this.callbacks.onModeSwitch(previousMode, mode)
    
    console.log(`🔄 Connection mode changed: ${previousMode} → ${mode} (${trigger})`)
  }

  /**
   * Update connection status
   */
  setConnectionStatus(status: ConnectionStatus, trigger: string = 'manual'): void {
    if (this.state.status === status) return
    
    const now = new Date()
    const updates: Partial<ConnectionState> = { status }
    
    if (status === 'connected') {
      updates.lastConnected = now
      updates.reconnectAttempts = 0 // Reset on successful connection
      this.updateStabilityWindow(true)
    } else if (status === 'error' || status === 'disconnected') {
      this.updateStabilityWindow(false)
      if (status === 'error') {
        updates.totalFailures = this.state.totalFailures + 1
      }
    }
    
    this.updateState(updates, trigger)
  }

  /**
   * Record connection error
   */
  recordError(error: string, trigger: string = 'error'): void {
    this.updateState({
      lastError: error,
      status: 'error',
      totalFailures: this.state.totalFailures + 1
    }, trigger)
    
    this.updateStabilityWindow(false)
    console.warn(`❌ Connection error recorded: ${error}`)
  }

  /**
   * Record reconnection attempt
   */
  recordReconnectAttempt(trigger: string = 'reconnect'): void {
    this.updateState({
      reconnectAttempts: this.state.reconnectAttempts + 1,
      status: 'connecting'
    }, trigger)
    
    console.log(`🔄 Reconnect attempt #${this.state.reconnectAttempts + 1}`)
  }

  /**
   * Update connection latency and quality
   */
  updateLatency(latencyMs: number): void {
    this.latencyMeasurements.push(latencyMs)
    
    // Keep only recent measurements
    if (this.latencyMeasurements.length > 20) {
      this.latencyMeasurements = this.latencyMeasurements.slice(-20)
    }
    
    const averageLatency = this.calculateAverageLatency()
    const quality = this.determineQuality(averageLatency)
    
    const previousQuality = this.state.quality
    
    this.updateState({
      latency: averageLatency,
      quality
    }, 'latency_update')
    
    if (previousQuality !== quality) {
      this.callbacks.onQualityChange(previousQuality, quality)
      console.log(`📊 Connection quality: ${previousQuality} → ${quality} (${averageLatency}ms)`)
    }
  }

  /**
   * Update custom metadata
   */
  updateMetadata(metadata: Record<string, any>, trigger: string = 'metadata'): void {
    this.updateState({
      metadata: { ...this.state.metadata, ...metadata }
    }, trigger)
  }

  /**
   * Reset connection state (for fresh starts)
   */
  reset(trigger: string = 'reset'): void {
    console.log('🔄 Resetting connection state')
    
    this.updateState({
      status: 'disconnected',
      lastError: null,
      reconnectAttempts: 0,
      latency: 0,
      metadata: {}
    }, trigger)
    
    // Clear measurements but keep history for metrics
    this.latencyMeasurements = []
    this.stabilityWindow = []
  }

  /**
   * Get state history for debugging
   */
  getStateHistory(): StateChangeEvent[] {
    return [...this.stateHistory] // Return copy
  }

  /**
   * Get current stability assessment
   */
  getStabilityAssessment(): {
    isStable: boolean
    stabilityScore: number
    factors: string[]
  } {
    const factors: string[] = []
    let stabilityScore = 100
    
    // Factor 1: Recent connection failures
    const recentFailures = this.stabilityWindow.filter(s => !s).length
    if (recentFailures > 2) {
      factors.push(`High failure rate (${recentFailures}/${this.stabilityWindowSize})`)
      stabilityScore -= recentFailures * 15
    }
    
    // Factor 2: Current connection quality
    if (this.state.quality === 'poor' || this.state.quality === 'critical') {
      factors.push(`Poor connection quality (${this.state.quality})`)
      stabilityScore -= 25
    }
    
    // Factor 3: Recent reconnection attempts
    if (this.state.reconnectAttempts > 2) {
      factors.push(`Multiple reconnect attempts (${this.state.reconnectAttempts})`)
      stabilityScore -= this.state.reconnectAttempts * 10
    }
    
    // Factor 4: Time since last successful connection
    const timeSinceConnection = this.state.lastConnected ? 
      Date.now() - this.state.lastConnected.getTime() : Infinity
    
    if (timeSinceConnection > 60000) { // > 1 minute
      factors.push('Extended disconnection period')
      stabilityScore -= 30
    }
    
    const isStable = stabilityScore >= 70
    
    return {
      isStable,
      stabilityScore: Math.max(0, stabilityScore),
      factors
    }
  }

  // Private helper methods

  private updateState(updates: Partial<ConnectionState>, trigger: string): void {
    const previous = { ...this.state }
    
    // Apply updates
    Object.assign(this.state, updates)
    
    // Update stability based on current state
    const stabilityAssessment = this.getStabilityAssessment()
    const wasStable = previous.isStable
    this.state.isStable = stabilityAssessment.isStable
    
    // Create state change event
    const event: StateChangeEvent = {
      previous,
      current: updates,
      timestamp: new Date(),
      trigger
    }
    
    // Add to history
    this.stateHistory.push(event)
    if (this.stateHistory.length > this.maxHistoryLength) {
      this.stateHistory = this.stateHistory.slice(-this.maxHistoryLength)
    }
    
    // Notify callbacks
    this.callbacks.onStateChange(event)
    
    if (wasStable !== this.state.isStable) {
      this.callbacks.onStabilityChange(this.state.isStable)
    }
  }

  private updateStabilityWindow(success: boolean): void {
    this.stabilityWindow.push(success)
    if (this.stabilityWindow.length > this.stabilityWindowSize) {
      this.stabilityWindow = this.stabilityWindow.slice(-this.stabilityWindowSize)
    }
  }

  private determineQuality(latency: number): ConnectionQuality {
    if (latency < this.latencyThreshold.excellent) return 'excellent'
    if (latency < this.latencyThreshold.good) return 'good'
    if (latency < this.latencyThreshold.fair) return 'fair'
    if (latency < this.latencyThreshold.poor) return 'poor'
    return 'critical'
  }

  private calculateAverageLatency(): number {
    if (this.latencyMeasurements.length === 0) return this.state.latency
    
    const sum = this.latencyMeasurements.reduce((acc, lat) => acc + lat, 0)
    return Math.round(sum / this.latencyMeasurements.length)
  }

  private calculateUptime(): number {
    let uptime = 0
    let lastConnectedTime: Date | null = null
    
    for (const event of this.stateHistory) {
      if (event.current.status === 'connected') {
        lastConnectedTime = event.timestamp
      } else if (event.current.status === 'disconnected' || event.current.status === 'error') {
        if (lastConnectedTime) {
          uptime += event.timestamp.getTime() - lastConnectedTime.getTime()
          lastConnectedTime = null
        }
      }
    }
    
    // Add current uptime if connected
    if (this.state.status === 'connected' && this.state.lastConnected) {
      uptime += Date.now() - this.state.lastConnected.getTime()
    }
    
    return uptime
  }

  private findLastErrorTime(): Date | null {
    for (let i = this.stateHistory.length - 1; i >= 0; i--) {
      const event = this.stateHistory[i]
      if (event.current.status === 'error' || event.current.lastError) {
        return event.timestamp
      }
    }
    return null
  }

  /**
   * Generate diagnostic report
   */
  generateDiagnosticReport(): string {
    const metrics = this.getMetrics()
    const stability = this.getStabilityAssessment()
    
    const lines = [
      '=== CONNECTION DIAGNOSTIC REPORT ===',
      `Timestamp: ${new Date().toISOString()}`,
      '',
      'CURRENT STATE:',
      `  Mode: ${this.state.mode}`,
      `  Status: ${this.state.status}`,
      `  Quality: ${this.state.quality}`,
      `  Latency: ${this.state.latency}ms`,
      `  Is Stable: ${this.state.isStable}`,
      `  Reconnect Attempts: ${this.state.reconnectAttempts}`,
      '',
      'METRICS:',
      `  Total Attempts: ${metrics.totalAttempts}`,
      `  Success Rate: ${metrics.totalAttempts > 0 ? 
        Math.round((metrics.successfulConnections / metrics.totalAttempts) * 100) : 0}%`,
      `  Average Latency: ${metrics.averageLatency}ms`,
      `  Uptime: ${Math.round(metrics.uptimePercentage)}%`,
      '',
      'STABILITY ASSESSMENT:',
      `  Score: ${stability.stabilityScore}/100`,
      `  Factors: ${stability.factors.length > 0 ? stability.factors.join(', ') : 'None'}`,
      '',
      'RECENT ERRORS:',
      `  Last Error: ${this.state.lastError || 'None'}`,
      `  Error Time: ${metrics.lastErrorTime?.toISOString() || 'N/A'}`,
    ]
    
    return lines.join('\n')
  }
}