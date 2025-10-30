/**
 * Alert lifecycle management service
 * Handles CRUD operations and state management for alerts
 */

import { UnifiedAlert, AlertType, AlertSeverity, AlertFilter, AlertRepository } from './types'
import { InMemoryAlertRepository } from './repository'
import { generateAlertId, generateRecommendations, validateAlert, sanitizeAlert } from './utils'

export class AlertLifecycleService {
  private repository: AlertRepository

  constructor(repository?: AlertRepository) {
    this.repository = repository || new InMemoryAlertRepository()
  }

  /**
   * Create a new alert
   */
  async createAlert(
    type: AlertType,
    severity: AlertSeverity,
    title: string,
    message: string,
    details: any = {},
    source: string = 'system',
    tags: string[] = [],
    affectedResources: string[] = []
  ): Promise<UnifiedAlert> {
    const alertId = generateAlertId(type, severity)
    
    const alert: UnifiedAlert = {
      id: alertId,
      type,
      severity,
      status: 'active',
      title,
      message,
      details,
      source,
      timestamp: new Date().toISOString(),
      escalationLevel: 0,
      notificationsSent: [],
      tags: [...tags, type, severity],
      affectedResources,
      recommendations: generateRecommendations(type, severity, details)
    }

    // Validate alert data
    const validation = validateAlert(alert)
    if (!validation.isValid) {
      throw new Error(`Invalid alert data: ${validation.errors.join(', ')}`)
    }

    // Save alert
    await this.repository.save(alert)

    console.log(`🚨 Alert created [${severity}]: ${title}`)
    
    return sanitizeAlert(alert)
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string = 'system'): Promise<boolean> {
    const alert = await this.repository.findById(alertId)
    if (!alert || alert.status !== 'active') {
      return false
    }

    alert.status = 'acknowledged'
    alert.acknowledgedAt = new Date().toISOString()
    alert.acknowledgedBy = acknowledgedBy

    await this.repository.update(alert)
    
    console.log(`✅ Alert acknowledged: ${alert.title} by ${acknowledgedBy}`)
    return true
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, resolvedBy: string = 'system'): Promise<boolean> {
    const alert = await this.repository.findById(alertId)
    if (!alert || alert.status === 'resolved') {
      return false
    }

    alert.status = 'resolved'
    alert.resolvedAt = new Date().toISOString()
    alert.resolvedBy = resolvedBy

    await this.repository.update(alert)
    
    console.log(`✅ Alert resolved: ${alert.title} by ${resolvedBy}`)
    return true
  }

  /**
   * Suppress an alert
   */
  async suppressAlert(alertId: string, durationMinutes: number = 30, reason: string = 'Manual suppression'): Promise<boolean> {
    const alert = await this.repository.findById(alertId)
    if (!alert) {
      return false
    }

    alert.status = 'suppressed'
    alert.suppressedUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString()
    
    // Add suppression reason to details
    if (!alert.details.suppressionHistory) {
      alert.details.suppressionHistory = []
    }
    alert.details.suppressionHistory.push({
      timestamp: new Date().toISOString(),
      durationMinutes,
      reason
    })

    await this.repository.update(alert)
    
    console.log(`🔇 Alert suppressed: ${alert.title} for ${durationMinutes} minutes - ${reason}`)
    return true
  }

  /**
   * Unsuppress an alert if suppression period has expired
   */
  async checkAndUnsuppressAlert(alertId: string): Promise<boolean> {
    const alert = await this.repository.findById(alertId)
    if (!alert || alert.status !== 'suppressed' || !alert.suppressedUntil) {
      return false
    }

    if (new Date().getTime() > new Date(alert.suppressedUntil).getTime()) {
      alert.status = 'active'
      alert.suppressedUntil = undefined

      await this.repository.update(alert)
      
      console.log(`🔊 Alert unsuppressed: ${alert.title}`)
      return true
    }

    return false
  }

  /**
   * Update alert escalation level
   */
  async escalateAlert(alertId: string, newLevel: number): Promise<boolean> {
    const alert = await this.repository.findById(alertId)
    if (!alert) {
      return false
    }

    alert.escalationLevel = newLevel

    await this.repository.update(alert)
    
    console.log(`⬆️ Alert escalated to level ${newLevel}: ${alert.title}`)
    return true
  }

  /**
   * Add notification record to alert
   */
  async recordNotification(alertId: string, channelId: string, escalationLevel: number): Promise<void> {
    const alert = await this.repository.findById(alertId)
    if (!alert) {
      return
    }

    const notificationRecord = `${channelId}:${escalationLevel}:${new Date().toISOString()}`
    alert.notificationsSent.push(notificationRecord)

    await this.repository.update(alert)
  }

  /**
   * Get alert by ID
   */
  async getAlert(alertId: string): Promise<UnifiedAlert | null> {
    const alert = await this.repository.findById(alertId)
    return alert ? sanitizeAlert(alert) : null
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(): Promise<UnifiedAlert[]> {
    const alerts = await this.repository.findActive()
    return alerts.map(sanitizeAlert)
  }

  /**
   * Get alerts with filtering
   */
  async getAlerts(filters: AlertFilter = {}): Promise<UnifiedAlert[]> {
    const alerts = await this.repository.findByFilters(filters)
    return alerts.map(sanitizeAlert)
  }

  /**
   * Delete an alert
   */
  async deleteAlert(alertId: string): Promise<boolean> {
    const alert = await this.repository.findById(alertId)
    if (!alert) {
      return false
    }

    await this.repository.delete(alertId)
    
    console.log(`🗑️ Alert deleted: ${alert.title}`)
    return true
  }

  /**
   * Cleanup old resolved alerts
   */
  async cleanupOldAlerts(retentionHours: number = 24): Promise<number> {
    const removedCount = await this.repository.cleanup(retentionHours)
    
    if (removedCount > 0) {
      console.log(`🗑️ Cleaned up ${removedCount} old resolved alerts`)
    }

    return removedCount
  }

  /**
   * Get alert statistics
   */
  async getStatistics(): Promise<{
    totalAlerts: number
    activeAlerts: number
    resolvedAlerts: number
    acknowledgedAlerts: number
    suppressedAlerts: number
  }> {
    if ('getStatistics' in this.repository) {
      return await (this.repository as any).getStatistics()
    }

    // Fallback implementation
    const allAlerts = await this.repository.findByFilters({})
    return {
      totalAlerts: allAlerts.length,
      activeAlerts: allAlerts.filter(a => a.status === 'active').length,
      resolvedAlerts: allAlerts.filter(a => a.status === 'resolved').length,
      acknowledgedAlerts: allAlerts.filter(a => a.status === 'acknowledged').length,
      suppressedAlerts: allAlerts.filter(a => a.status === 'suppressed').length
    }
  }

  /**
   * Process suppressed alerts and unsuppress expired ones
   */
  async processSuppressedAlerts(): Promise<number> {
    const suppressedAlerts = await this.repository.findByFilters({ status: 'suppressed' })
    let unsuppressedCount = 0

    for (const alert of suppressedAlerts) {
      if (await this.checkAndUnsuppressAlert(alert.id)) {
        unsuppressedCount++
      }
    }

    return unsuppressedCount
  }
}