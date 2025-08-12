/**
 * Alert metrics collection and tracking
 */

import { AlertingMetrics, UnifiedAlert, AlertType, AlertSeverity, AlertMetricsData } from './types'

export class AlertMetricsCollector {
  private metrics: AlertingMetrics
  private metricsHistory: AlertMetricsData[] = []
  private lastCollectionTime: number = Date.now()

  constructor() {
    this.metrics = this.initializeMetrics()
  }

  /**
   * Initialize default alerting metrics
   */
  private initializeMetrics(): AlertingMetrics {
    return {
      totalAlerts: 0,
      activeAlerts: 0,
      alertsByType: {
        database: 0,
        performance: 0,
        system: 0,
        security: 0,
        user: 0,
        integration: 0
      },
      alertsBySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      },
      averageResolutionTime: 0,
      escalationRate: 0,
      notificationSuccessRate: 100,
      falsePositiveRate: 0,
      recentActivity: []
    }
  }

  /**
   * Record alert creation
   */
  recordAlertCreated(alert: UnifiedAlert): void {
    this.metrics.totalAlerts++
    this.metrics.activeAlerts++
    this.metrics.alertsByType[alert.type]++
    this.metrics.alertsBySeverity[alert.severity]++

    this.addActivity('created', alert)
    this.captureMetricsSnapshot()
  }

  /**
   * Record alert acknowledgment
   */
  recordAlertAcknowledged(alert: UnifiedAlert): void {
    this.addActivity('acknowledged', alert)
    this.captureMetricsSnapshot()
  }

  /**
   * Record alert resolution
   */
  recordAlertResolved(alert: UnifiedAlert): void {
    this.metrics.activeAlerts--
    
    if (alert.timestamp && alert.resolvedAt) {
      const resolutionTime = new Date(alert.resolvedAt).getTime() - new Date(alert.timestamp).getTime()
      this.updateAverageResolutionTime(resolutionTime)
    }

    this.addActivity('resolved', alert)
    this.captureMetricsSnapshot()
  }

  /**
   * Record alert escalation
   */
  recordAlertEscalated(alert: UnifiedAlert): void {
    this.metrics.escalationRate = this.calculateEscalationRate()
    this.addActivity('escalated', alert)
    this.captureMetricsSnapshot()
  }

  /**
   * Record alert suppression
   */
  recordAlertSuppressed(alert: UnifiedAlert): void {
    this.addActivity('suppressed', alert)
    this.captureMetricsSnapshot()
  }

  /**
   * Record notification success/failure
   */
  recordNotificationResult(alertId: string, channelId: string, success: boolean, details?: any): void {
    // Update notification success rate
    this.updateNotificationSuccessRate(success)
    
    // Add to activity if it's a failure
    if (!success) {
      this.addActivity('notification_failed', { id: alertId }, { channelId, ...details })
    }
  }

  /**
   * Update average resolution time
   */
  private updateAverageResolutionTime(newResolutionTime: number): void {
    if (this.metrics.averageResolutionTime === 0) {
      this.metrics.averageResolutionTime = newResolutionTime
    } else {
      // Rolling average
      this.metrics.averageResolutionTime = 
        (this.metrics.averageResolutionTime + newResolutionTime) / 2
    }
  }

  /**
   * Calculate escalation rate
   */
  private calculateEscalationRate(): number {
    const recentEscalations = this.metrics.recentActivity
      .filter(activity => activity.action === 'escalated')
      .length

    const recentAlerts = this.metrics.recentActivity
      .filter(activity => activity.action === 'created')
      .length

    return recentAlerts > 0 ? (recentEscalations / recentAlerts) * 100 : 0
  }

  /**
   * Update notification success rate
   */
  private updateNotificationSuccessRate(success: boolean): void {
    // Simple rolling success rate calculation
    const currentRate = this.metrics.notificationSuccessRate
    const newRate = success ? 100 : 0
    
    // Weighted average (70% current, 30% new)
    this.metrics.notificationSuccessRate = (currentRate * 0.7) + (newRate * 0.3)
  }

  /**
   * Add activity to recent activities
   */
  private addActivity(action: string, alert: Partial<UnifiedAlert>, details?: any): void {
    this.metrics.recentActivity.unshift({
      timestamp: new Date().toISOString(),
      action: action as any,
      alertId: alert.id || 'unknown',
      details: {
        severity: alert.severity,
        type: alert.type,
        ...details
      }
    })

    // Keep only last 100 activities
    if (this.metrics.recentActivity.length > 100) {
      this.metrics.recentActivity = this.metrics.recentActivity.slice(0, 100)
    }
  }

  /**
   * Capture metrics snapshot for historical tracking
   */
  private captureMetricsSnapshot(): void {
    const now = Date.now()
    
    // Only capture snapshot every 5 minutes to avoid too much data
    if (now - this.lastCollectionTime >= 5 * 60 * 1000) {
      const snapshot: AlertMetricsData = {
        timestamp: new Date().toISOString(),
        totalAlerts: this.metrics.totalAlerts,
        activeAlerts: this.metrics.activeAlerts,
        resolvedAlerts: this.metrics.totalAlerts - this.metrics.activeAlerts,
        escalatedAlerts: this.metrics.recentActivity
          .filter(a => a.action === 'escalated').length,
        notificationsSent: this.calculateNotificationsSent(),
        averageResolutionTimeMs: this.metrics.averageResolutionTime
      }

      this.metricsHistory.push(snapshot)
      this.lastCollectionTime = now

      // Keep only last 24 hours of snapshots (288 snapshots at 5-minute intervals)
      if (this.metricsHistory.length > 288) {
        this.metricsHistory = this.metricsHistory.slice(-288)
      }
    }
  }

  /**
   * Calculate total notifications sent
   */
  private calculateNotificationsSent(): number {
    return this.metrics.recentActivity
      .filter(activity => activity.action === 'created' || activity.action === 'escalated')
      .length
  }

  /**
   * Get current metrics
   */
  getMetrics(): AlertingMetrics {
    return {
      ...this.metrics,
      alertsByType: { ...this.metrics.alertsByType },
      alertsBySeverity: { ...this.metrics.alertsBySeverity },
      recentActivity: [...this.metrics.recentActivity]
    }
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(hours: number = 24): AlertMetricsData[] {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000)
    return this.metricsHistory
      .filter(snapshot => new Date(snapshot.timestamp).getTime() > cutoffTime)
      .map(snapshot => ({ ...snapshot }))
  }

  /**
   * Get metrics for a specific time period
   */
  getMetricsForPeriod(startTime: string, endTime: string): AlertMetricsData[] {
    const start = new Date(startTime).getTime()
    const end = new Date(endTime).getTime()
    
    return this.metricsHistory
      .filter(snapshot => {
        const time = new Date(snapshot.timestamp).getTime()
        return time >= start && time <= end
      })
      .map(snapshot => ({ ...snapshot }))
  }

  /**
   * Calculate metrics summary for a period
   */
  getMetricsSummary(hours: number = 24): {
    totalAlertsInPeriod: number
    averageActiveAlerts: number
    peakActiveAlerts: number
    totalResolutionsInPeriod: number
    averageResolutionTimeMinutes: number
    escalationRatePercent: number
    notificationSuccessRatePercent: number
    alertFrequencyPerHour: number
  } {
    const history = this.getMetricsHistory(hours)
    
    if (history.length === 0) {
      return {
        totalAlertsInPeriod: 0,
        averageActiveAlerts: 0,
        peakActiveAlerts: 0,
        totalResolutionsInPeriod: 0,
        averageResolutionTimeMinutes: 0,
        escalationRatePercent: 0,
        notificationSuccessRatePercent: this.metrics.notificationSuccessRate,
        alertFrequencyPerHour: 0
      }
    }

    const firstSnapshot = history[0]
    const lastSnapshot = history[history.length - 1]
    
    const totalAlertsInPeriod = lastSnapshot.totalAlerts - firstSnapshot.totalAlerts
    const totalResolutionsInPeriod = lastSnapshot.resolvedAlerts - firstSnapshot.resolvedAlerts
    
    const averageActiveAlerts = history.reduce((sum, s) => sum + s.activeAlerts, 0) / history.length
    const peakActiveAlerts = Math.max(...history.map(s => s.activeAlerts))
    
    const averageResolutionTimeMinutes = lastSnapshot.averageResolutionTimeMs / (1000 * 60)
    
    const totalEscalations = lastSnapshot.escalatedAlerts - firstSnapshot.escalatedAlerts
    const escalationRatePercent = totalAlertsInPeriod > 0 ? (totalEscalations / totalAlertsInPeriod) * 100 : 0
    
    const alertFrequencyPerHour = totalAlertsInPeriod / hours

    return {
      totalAlertsInPeriod,
      averageActiveAlerts: Math.round(averageActiveAlerts * 100) / 100,
      peakActiveAlerts,
      totalResolutionsInPeriod,
      averageResolutionTimeMinutes: Math.round(averageResolutionTimeMinutes * 100) / 100,
      escalationRatePercent: Math.round(escalationRatePercent * 100) / 100,
      notificationSuccessRatePercent: Math.round(this.metrics.notificationSuccessRate * 100) / 100,
      alertFrequencyPerHour: Math.round(alertFrequencyPerHour * 100) / 100
    }
  }

  /**
   * Reset metrics (for testing or maintenance)
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics()
    this.metricsHistory = []
    this.lastCollectionTime = Date.now()
    console.log('📊 Alert metrics reset')
  }

  /**
   * Update false positive rate
   */
  updateFalsePositiveRate(alertId: string, isFalsePositive: boolean): void {
    // Simple tracking - in production, use more sophisticated calculation
    const currentRate = this.metrics.falsePositiveRate
    const newDataPoint = isFalsePositive ? 100 : 0
    
    // Weighted average
    this.metrics.falsePositiveRate = (currentRate * 0.9) + (newDataPoint * 0.1)
    
    this.addActivity('false_positive_reported', { id: alertId }, { isFalsePositive })
  }

  /**
   * Get top alert types by frequency
   */
  getTopAlertTypes(limit: number = 5): Array<{ type: AlertType; count: number; percentage: number }> {
    const totalAlerts = Object.values(this.metrics.alertsByType).reduce((sum, count) => sum + count, 0)
    
    if (totalAlerts === 0) {
      return []
    }

    return Object.entries(this.metrics.alertsByType)
      .map(([type, count]) => ({
        type: type as AlertType,
        count,
        percentage: Math.round((count / totalAlerts) * 10000) / 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }

  /**
   * Get severity distribution
   */
  getSeverityDistribution(): Array<{ severity: AlertSeverity; count: number; percentage: number }> {
    const totalAlerts = Object.values(this.metrics.alertsBySeverity).reduce((sum, count) => sum + count, 0)
    
    if (totalAlerts === 0) {
      return []
    }

    return Object.entries(this.metrics.alertsBySeverity)
      .map(([severity, count]) => ({
        severity: severity as AlertSeverity,
        count,
        percentage: Math.round((count / totalAlerts) * 10000) / 100
      }))
      .sort((a, b) => b.count - a.count)
  }

  /**
   * Get recent activity filtered by action
   */
  getRecentActivityByAction(action: string, limit: number = 10): typeof this.metrics.recentActivity {
    return this.metrics.recentActivity
      .filter(activity => activity.action === action)
      .slice(0, limit)
  }

  /**
   * Export metrics for external analysis
   */
  exportMetrics(): {
    current: AlertingMetrics
    history: AlertMetricsData[]
    summary: ReturnType<typeof this.getMetricsSummary>
    topTypes: ReturnType<typeof this.getTopAlertTypes>
    severityDistribution: ReturnType<typeof this.getSeverityDistribution>
  } {
    return {
      current: this.getMetrics(),
      history: this.getMetricsHistory(),
      summary: this.getMetricsSummary(),
      topTypes: this.getTopAlertTypes(),
      severityDistribution: this.getSeverityDistribution()
    }
  }
}