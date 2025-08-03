/**
 * Alert data persistence and retrieval
 */

import { UnifiedAlert, AlertFilter, AlertRepository } from './types'
import { isAlertExpired } from './utils'

export class InMemoryAlertRepository implements AlertRepository {
  private alerts: Map<string, UnifiedAlert> = new Map()
  private alertHistory: UnifiedAlert[] = []

  /**
   * Save a new alert
   */
  async save(alert: UnifiedAlert): Promise<void> {
    this.alerts.set(alert.id, { ...alert })
    this.alertHistory.push({ ...alert })
    
    // Keep history manageable (last 1000 alerts)
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-1000)
    }
  }

  /**
   * Update an existing alert
   */
  async update(alert: UnifiedAlert): Promise<void> {
    if (this.alerts.has(alert.id)) {
      this.alerts.set(alert.id, { ...alert })
      
      // Update in history as well
      const historyIndex = this.alertHistory.findIndex(a => a.id === alert.id)
      if (historyIndex >= 0) {
        this.alertHistory[historyIndex] = { ...alert }
      }
    }
  }

  /**
   * Find alert by ID
   */
  async findById(id: string): Promise<UnifiedAlert | null> {
    const alert = this.alerts.get(id)
    return alert ? { ...alert } : null
  }

  /**
   * Find all active alerts
   */
  async findActive(): Promise<UnifiedAlert[]> {
    return Array.from(this.alerts.values())
      .filter(alert => alert.status === 'active')
      .map(alert => ({ ...alert }))
  }

  /**
   * Find alerts by filters
   */
  async findByFilters(filters: AlertFilter): Promise<UnifiedAlert[]> {
    let alerts = Array.from(this.alerts.values())

    // Apply filters
    if (filters.status) {
      alerts = alerts.filter(alert => alert.status === filters.status)
    }
    if (filters.severity) {
      alerts = alerts.filter(alert => alert.severity === filters.severity)
    }
    if (filters.type) {
      alerts = alerts.filter(alert => alert.type === filters.type)
    }
    if (filters.startDate) {
      const startTime = new Date(filters.startDate).getTime()
      alerts = alerts.filter(alert => new Date(alert.timestamp).getTime() >= startTime)
    }
    if (filters.endDate) {
      const endTime = new Date(filters.endDate).getTime()
      alerts = alerts.filter(alert => new Date(alert.timestamp).getTime() <= endTime)
    }
    if (filters.tags && filters.tags.length > 0) {
      alerts = alerts.filter(alert => 
        filters.tags!.some(tag => alert.tags.includes(tag))
      )
    }

    // Sort by timestamp (newest first)
    alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // Apply limit
    if (filters.limit) {
      alerts = alerts.slice(0, filters.limit)
    }

    return alerts.map(alert => ({ ...alert }))
  }

  /**
   * Delete an alert
   */
  async delete(id: string): Promise<void> {
    this.alerts.delete(id)
    
    // Remove from history as well
    this.alertHistory = this.alertHistory.filter(alert => alert.id !== id)
  }

  /**
   * Cleanup old alerts based on retention policy
   */
  async cleanup(retentionHours: number): Promise<number> {
    let removedCount = 0

    // Clean up active alerts map
    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.status === 'resolved' && isAlertExpired(alert, retentionHours)) {
        this.alerts.delete(alertId)
        removedCount++
      }
    }

    // Clean up history
    const initialHistoryLength = this.alertHistory.length
    this.alertHistory = this.alertHistory.filter(alert => 
      alert.status !== 'resolved' || !isAlertExpired(alert, retentionHours)
    )
    
    removedCount += initialHistoryLength - this.alertHistory.length

    return removedCount
  }

  /**
   * Get all alerts (for metrics and reporting)
   */
  async getAll(): Promise<UnifiedAlert[]> {
    return Array.from(this.alerts.values()).map(alert => ({ ...alert }))
  }

  /**
   * Get alert history
   */
  async getHistory(limit?: number): Promise<UnifiedAlert[]> {
    const history = [...this.alertHistory]
    
    if (limit) {
      return history.slice(-limit).map(alert => ({ ...alert }))
    }
    
    return history.map(alert => ({ ...alert }))
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<{
    totalAlerts: number
    activeAlerts: number
    resolvedAlerts: number
    acknowledgedAlerts: number
    suppressedAlerts: number
  }> {
    const alerts = Array.from(this.alerts.values())
    
    return {
      totalAlerts: alerts.length,
      activeAlerts: alerts.filter(a => a.status === 'active').length,
      resolvedAlerts: alerts.filter(a => a.status === 'resolved').length,
      acknowledgedAlerts: alerts.filter(a => a.status === 'acknowledged').length,
      suppressedAlerts: alerts.filter(a => a.status === 'suppressed').length
    }
  }

  /**
   * Clear all alerts (for testing)
   */
  async clear(): Promise<void> {
    this.alerts.clear()
    this.alertHistory = []
  }
}