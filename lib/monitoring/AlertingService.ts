/**
 * Real-time Alerting Service - Comprehensive alert management and notification system
 */

import { getSection } from '../config'
import { DatabaseAlert } from './DatabaseHealthMonitor'
import { PerformanceAlert } from './PerformanceMetricsTracker'

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'
export type AlertType = 'database' | 'performance' | 'system' | 'security' | 'user' | 'integration'
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'suppressed'

export interface UnifiedAlert {
  id: string
  type: AlertType
  severity: AlertSeverity
  status: AlertStatus
  title: string
  message: string
  details: any
  source: string
  timestamp: string
  acknowledgedAt?: string
  acknowledgedBy?: string
  resolvedAt?: string
  resolvedBy?: string
  suppressedUntil?: string
  escalationLevel: number
  notificationsSent: string[]
  tags: string[]
  affectedResources: string[]
  runbookUrl?: string
  recommendations: string[]
}

export interface AlertRule {
  id: string
  name: string
  description: string
  condition: string
  severity: AlertSeverity
  enabled: boolean
  cooldownMinutes: number
  escalationRules: EscalationRule[]
  suppressionRules: SuppressionRule[]
  notificationChannels: string[]
  tags: string[]
}

export interface EscalationRule {
  level: number
  delayMinutes: number
  notificationChannels: string[]
  condition?: string
}

export interface SuppressionRule {
  condition: string
  durationMinutes: number
  reason: string
}

export interface NotificationChannel {
  id: string
  type: 'webhook' | 'slack' | 'email' | 'sms' | 'teams' | 'discord' | 'pagerduty'
  name: string
  enabled: boolean
  config: {
    url?: string
    token?: string
    channel?: string
    email?: string
    phone?: string
    [key: string]: any
  }
  failureCount: number
  lastSuccess?: string
  lastFailure?: string
}

export interface AlertingMetrics {
  totalAlerts: number
  activeAlerts: number
  alertsByType: Record<AlertType, number>
  alertsBySeverity: Record<AlertSeverity, number>
  averageResolutionTime: number
  escalationRate: number
  notificationSuccessRate: number
  falsePositiveRate: number
  recentActivity: Array<{
    timestamp: string
    action: 'created' | 'acknowledged' | 'resolved' | 'escalated' | 'suppressed'
    alertId: string
    details: any
  }>
}

export class AlertingService {
  private alerts: Map<string, UnifiedAlert> = new Map()
  private alertRules: Map<string, AlertRule> = new Map()
  private notificationChannels: Map<string, NotificationChannel> = new Map()
  private config: ReturnType<typeof getSection<'monitoring'>>
  private alertHistory: UnifiedAlert[] = []
  private metrics: AlertingMetrics
  private escalationTimers: Map<string, NodeJS.Timeout> = new Map()

  constructor() {
    this.config = getSection('monitoring')
    this.metrics = this.initializeMetrics()
    this.initializeDefaultRules()
    this.initializeNotificationChannels()
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
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'database-connection-lost',
        name: 'Database Connection Lost',
        description: 'Database is not responding or connection failed',
        condition: 'database.connection.isConnected == false',
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 5,
        escalationRules: [
          { level: 1, delayMinutes: 5, notificationChannels: ['slack-alerts'] },
          { level: 2, delayMinutes: 15, notificationChannels: ['slack-alerts', 'webhook-primary'] }
        ],
        suppressionRules: [],
        notificationChannels: ['slack-alerts'],
        tags: ['database', 'connectivity']
      },
      {
        id: 'high-error-rate',
        name: 'High Error Rate Detected',
        description: 'Processing error rate is above acceptable threshold',
        condition: 'processing.errorRate > 10',
        severity: 'high',
        enabled: true,
        cooldownMinutes: 10,
        escalationRules: [
          { level: 1, delayMinutes: 10, notificationChannels: ['slack-alerts'] }
        ],
        suppressionRules: [],
        notificationChannels: ['slack-alerts'],
        tags: ['processing', 'errors']
      },
      {
        id: 'slow-performance',
        name: 'Performance Degradation',
        description: 'Average processing time is significantly above normal',
        condition: 'processing.averageTime > 120000', // 2 minutes
        severity: 'medium',
        enabled: true,
        cooldownMinutes: 15,
        escalationRules: [],
        suppressionRules: [],
        notificationChannels: ['slack-alerts'],
        tags: ['performance', 'latency']
      },
      {
        id: 'storage-critical',
        name: 'Critical Storage Usage',
        description: 'Storage usage is critically high',
        condition: 'database.storage.utilizationPercentage > 90',
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 30,
        escalationRules: [
          { level: 1, delayMinutes: 10, notificationChannels: ['slack-alerts', 'webhook-primary'] }
        ],
        suppressionRules: [],
        notificationChannels: ['slack-alerts'],
        tags: ['storage', 'capacity']
      },
      {
        id: 'circuit-breaker-open',
        name: 'Circuit Breaker Opened',
        description: 'External API circuit breaker has opened due to failures',
        condition: 'processing.circuitBreaker.isOpen == true',
        severity: 'high',
        enabled: true,
        cooldownMinutes: 5,
        escalationRules: [],
        suppressionRules: [],
        notificationChannels: ['slack-alerts'],
        tags: ['external-api', 'circuit-breaker']
      }
    ]

    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule)
    })

    console.log(`✅ Initialized ${defaultRules.length} default alert rules`)
  }

  /**
   * Initialize notification channels
   */
  private initializeNotificationChannels(): void {
    const channels: NotificationChannel[] = []

    // Slack channel (if configured)
    if (this.config.alerting.slackChannel) {
      channels.push({
        id: 'slack-alerts',
        type: 'slack',
        name: 'Slack Alerts',
        enabled: this.config.alerting.enabled,
        config: {
          channel: this.config.alerting.slackChannel,
          token: process.env.SLACK_BOT_TOKEN
        },
        failureCount: 0
      })
    }

    // Webhook channel (if configured)
    if (this.config.alerting.webhookUrl) {
      channels.push({
        id: 'webhook-primary',
        type: 'webhook',
        name: 'Primary Webhook',
        enabled: this.config.alerting.enabled,
        config: {
          url: this.config.alerting.webhookUrl
        },
        failureCount: 0
      })
    }

    // Console channel (always available for development)
    channels.push({
      id: 'console',
      type: 'webhook',
      name: 'Console Logging',
      enabled: true,
      config: {},
      failureCount: 0
    })

    channels.forEach(channel => {
      this.notificationChannels.set(channel.id, channel)
    })

    console.log(`✅ Initialized ${channels.length} notification channels`)
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
    const alertId = `${type}-${severity}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
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
      recommendations: this.generateRecommendations(type, severity, details)
    }

    // Check if this alert should be suppressed
    if (this.shouldSuppressAlert(alert)) {
      alert.status = 'suppressed'
      alert.suppressedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 minutes
    }

    // Store alert
    this.alerts.set(alertId, alert)
    this.alertHistory.push({ ...alert })

    // Update metrics
    this.updateMetrics('created', alert)

    // Send notifications if not suppressed
    if (alert.status === 'active') {
      await this.processAlertNotifications(alert)
    }

    console.log(`🚨 Alert created [${severity}]: ${title}`)
    
    return alert
  }

  /**
   * Process database alerts from the monitoring system
   */
  async processDatabaseAlert(dbAlert: DatabaseAlert): Promise<UnifiedAlert> {
    return await this.createAlert(
      'database',
      dbAlert.severity,
      `Database Alert: ${dbAlert.type}`,
      dbAlert.message,
      dbAlert.details,
      'database-monitor',
      ['database', dbAlert.type],
      ['database']
    )
  }

  /**
   * Process performance alerts from the metrics tracker
   */
  async processPerformanceAlert(perfAlert: PerformanceAlert): Promise<UnifiedAlert> {
    return await this.createAlert(
      'performance',
      perfAlert.severity,
      `Performance Alert: ${perfAlert.type}`,
      perfAlert.message,
      perfAlert.details,
      'performance-tracker',
      ['performance', perfAlert.type],
      perfAlert.details?.noteId ? [`note:${perfAlert.details.noteId}`] : []
    )
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string = 'system'): Promise<boolean> {
    const alert = this.alerts.get(alertId)
    if (!alert || alert.status !== 'active') {
      return false
    }

    alert.status = 'acknowledged'
    alert.acknowledgedAt = new Date().toISOString()
    alert.acknowledgedBy = acknowledgedBy

    // Cancel escalation timers
    const escalationTimer = this.escalationTimers.get(alertId)
    if (escalationTimer) {
      clearTimeout(escalationTimer)
      this.escalationTimers.delete(alertId)
    }

    this.updateMetrics('acknowledged', alert)
    
    console.log(`✅ Alert acknowledged: ${alert.title} by ${acknowledgedBy}`)
    return true
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, resolvedBy: string = 'system'): Promise<boolean> {
    const alert = this.alerts.get(alertId)
    if (!alert || alert.status === 'resolved') {
      return false
    }

    alert.status = 'resolved'
    alert.resolvedAt = new Date().toISOString()
    alert.resolvedBy = resolvedBy

    // Cancel escalation timers
    const escalationTimer = this.escalationTimers.get(alertId)
    if (escalationTimer) {
      clearTimeout(escalationTimer)
      this.escalationTimers.delete(alertId)
    }

    this.updateMetrics('resolved', alert)
    
    console.log(`✅ Alert resolved: ${alert.title} by ${resolvedBy}`)
    return true
  }

  /**
   * Process alert notifications based on rules
   */
  private async processAlertNotifications(alert: UnifiedAlert): Promise<void> {
    // Find matching alert rules
    const matchingRules = Array.from(this.alertRules.values())
      .filter(rule => rule.enabled && this.evaluateAlertCondition(rule, alert))

    for (const rule of matchingRules) {
      // Send initial notifications
      await this.sendNotifications(alert, rule.notificationChannels, 0)

      // Set up escalation if defined
      if (rule.escalationRules.length > 0) {
        this.scheduleEscalation(alert, rule)
      }
    }
  }

  /**
   * Send notifications through specified channels
   */
  private async sendNotifications(
    alert: UnifiedAlert, 
    channelIds: string[], 
    escalationLevel: number = 0
  ): Promise<void> {
    for (const channelId of channelIds) {
      const channel = this.notificationChannels.get(channelId)
      if (!channel || !channel.enabled) {
        continue
      }

      try {
        await this.sendNotification(channel, alert, escalationLevel)
        channel.lastSuccess = new Date().toISOString()
        channel.failureCount = 0
        alert.notificationsSent.push(`${channelId}:${escalationLevel}`)
      } catch (error) {
        console.error(`Failed to send notification via ${channelId}:`, error)
        channel.failureCount++
        channel.lastFailure = new Date().toISOString()
      }
    }
  }

  /**
   * Send notification to a specific channel
   */
  private async sendNotification(
    channel: NotificationChannel,
    alert: UnifiedAlert,
    escalationLevel: number = 0
  ): Promise<void> {
    const payload = this.buildNotificationPayload(alert, escalationLevel)

    switch (channel.type) {
      case 'slack':
        await this.sendSlackNotification(channel, payload)
        break
      case 'webhook':
        await this.sendWebhookNotification(channel, payload)
        break
      case 'email':
        await this.sendEmailNotification(channel, payload)
        break
      default:
        // Console fallback
        console.log('🚨 ALERT NOTIFICATION:', payload)
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(channel: NotificationChannel, payload: any): Promise<void> {
    if (!channel.config.token) {
      throw new Error('Slack token not configured')
    }

    const slackMessage = {
      channel: channel.config.channel,
      text: payload.title,
      attachments: [{
        color: this.getSeverityColor(payload.severity),
        title: payload.title,
        text: payload.message,
        fields: [
          { title: 'Severity', value: payload.severity.toUpperCase(), short: true },
          { title: 'Type', value: payload.type, short: true },
          { title: 'Source', value: payload.source, short: true },
          { title: 'Time', value: payload.timestamp, short: true }
        ],
        footer: 'Voice Memory Alerts',
        ts: Math.floor(new Date(payload.timestamp).getTime() / 1000)
      }]
    }

    // In a real implementation, use Slack API
    console.log('📱 Slack notification:', slackMessage)
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(channel: NotificationChannel, payload: any): Promise<void> {
    if (!channel.config.url) {
      throw new Error('Webhook URL not configured')
    }

    // In a real implementation, make HTTP POST request
    console.log('🔗 Webhook notification to', channel.config.url, ':', payload)
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(channel: NotificationChannel, payload: any): Promise<void> {
    if (!channel.config.email) {
      throw new Error('Email address not configured')
    }

    // In a real implementation, use email service
    console.log('📧 Email notification to', channel.config.email, ':', payload)
  }

  /**
   * Build notification payload
   */
  private buildNotificationPayload(alert: UnifiedAlert, escalationLevel: number): any {
    return {
      id: alert.id,
      title: alert.title,
      message: alert.message,
      severity: alert.severity,
      type: alert.type,
      source: alert.source,
      timestamp: alert.timestamp,
      escalationLevel,
      details: alert.details,
      affectedResources: alert.affectedResources,
      recommendations: alert.recommendations,
      tags: alert.tags
    }
  }

  /**
   * Schedule alert escalation
   */
  private scheduleEscalation(alert: UnifiedAlert, rule: AlertRule): void {
    const nextEscalation = rule.escalationRules[alert.escalationLevel]
    if (!nextEscalation) {
      return
    }

    const timer = setTimeout(async () => {
      // Check if alert is still active
      const currentAlert = this.alerts.get(alert.id)
      if (!currentAlert || currentAlert.status !== 'active') {
        return
      }

      // Escalate
      currentAlert.escalationLevel++
      await this.sendNotifications(currentAlert, nextEscalation.notificationChannels, currentAlert.escalationLevel)
      
      this.updateMetrics('escalated', currentAlert)
      console.log(`⬆️ Alert escalated to level ${currentAlert.escalationLevel}: ${alert.title}`)

      // Schedule next escalation if exists
      this.scheduleEscalation(currentAlert, rule)
    }, nextEscalation.delayMinutes * 60 * 1000)

    this.escalationTimers.set(alert.id, timer)
  }

  /**
   * Evaluate if an alert condition matches a rule
   */
  private evaluateAlertCondition(rule: AlertRule, alert: UnifiedAlert): boolean {
    // Simple condition evaluation - in production, use a proper expression engine
    if (rule.condition.includes('severity')) {
      return rule.condition.includes(alert.severity)
    }
    if (rule.condition.includes('type')) {
      return rule.condition.includes(alert.type)
    }
    return true // Default to match for now
  }

  /**
   * Check if alert should be suppressed
   */
  private shouldSuppressAlert(alert: UnifiedAlert): boolean {
    // Check for recent similar alerts (basic deduplication)
    const recentSimilar = Array.from(this.alerts.values())
      .filter(a => 
        a.type === alert.type && 
        a.severity === alert.severity &&
        a.status === 'active' &&
        Date.now() - new Date(a.timestamp).getTime() < 5 * 60 * 1000 // 5 minutes
      )

    return recentSimilar.length > 0
  }

  /**
   * Generate recommendations based on alert type and details
   */
  private generateRecommendations(type: AlertType, severity: AlertSeverity, details: any): string[] {
    const recommendations: string[] = []

    switch (type) {
      case 'database':
        recommendations.push('Check database connection status')
        recommendations.push('Verify database server health')
        if (severity === 'critical') {
          recommendations.push('Contact database administrator immediately')
        }
        break
      case 'performance':
        recommendations.push('Monitor system resources')
        recommendations.push('Check for bottlenecks in processing pipeline')
        if (details?.stage) {
          recommendations.push(`Investigate ${details.stage} stage performance`)
        }
        break
      case 'system':
        recommendations.push('Check system logs for errors')
        recommendations.push('Monitor CPU and memory usage')
        break
    }

    return recommendations
  }

  /**
   * Get severity color for notifications
   */
  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case 'critical': return '#FF0000'
      case 'high': return '#FF8800'
      case 'medium': return '#FFAA00'
      case 'low': return '#00AA00'
      default: return '#808080'
    }
  }

  /**
   * Update alerting metrics
   */
  private updateMetrics(action: string, alert: UnifiedAlert): void {
    if (action === 'created') {
      this.metrics.totalAlerts++
      this.metrics.activeAlerts++
      this.metrics.alertsByType[alert.type]++
      this.metrics.alertsBySeverity[alert.severity]++
    } else if (action === 'resolved') {
      this.metrics.activeAlerts--
      if (alert.timestamp && alert.resolvedAt) {
        const resolutionTime = new Date(alert.resolvedAt).getTime() - new Date(alert.timestamp).getTime()
        this.metrics.averageResolutionTime = 
          (this.metrics.averageResolutionTime + resolutionTime) / 2
      }
    }

    // Add to recent activity
    this.metrics.recentActivity.unshift({
      timestamp: new Date().toISOString(),
      action: action as any,
      alertId: alert.id,
      details: { severity: alert.severity, type: alert.type }
    })

    // Keep only last 100 activities
    if (this.metrics.recentActivity.length > 100) {
      this.metrics.recentActivity = this.metrics.recentActivity.slice(0, 100)
    }
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): UnifiedAlert[] {
    return Array.from(this.alerts.values()).filter(alert => alert.status === 'active')
  }

  /**
   * Get all alerts with filtering
   */
  getAlerts(filters: {
    status?: AlertStatus
    severity?: AlertSeverity
    type?: AlertType
    limit?: number
  } = {}): UnifiedAlert[] {
    let alerts = Array.from(this.alerts.values())

    if (filters.status) {
      alerts = alerts.filter(alert => alert.status === filters.status)
    }
    if (filters.severity) {
      alerts = alerts.filter(alert => alert.severity === filters.severity)
    }
    if (filters.type) {
      alerts = alerts.filter(alert => alert.type === filters.type)
    }

    // Sort by timestamp (newest first)
    alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    if (filters.limit) {
      alerts = alerts.slice(0, filters.limit)
    }

    return alerts
  }

  /**
   * Get alerting metrics
   */
  getMetrics(): AlertingMetrics {
    return { ...this.metrics }
  }

  /**
   * Get alert rules
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values())
  }

  /**
   * Get notification channels
   */
  getNotificationChannels(): NotificationChannel[] {
    return Array.from(this.notificationChannels.values())
  }

  /**
   * Test notification channel
   */
  async testNotificationChannel(channelId: string): Promise<boolean> {
    const channel = this.notificationChannels.get(channelId)
    if (!channel) {
      return false
    }

    try {
      const testAlert: UnifiedAlert = {
        id: 'test-alert',
        type: 'system',
        severity: 'low',
        status: 'active',
        title: 'Test Alert',
        message: 'This is a test notification from Voice Memory alerting system',
        details: { test: true },
        source: 'alerting-test',
        timestamp: new Date().toISOString(),
        escalationLevel: 0,
        notificationsSent: [],
        tags: ['test'],
        affectedResources: [],
        recommendations: ['This is a test - no action required']
      }

      await this.sendNotification(channel, testAlert, 0)
      return true
    } catch (error) {
      console.error(`Test notification failed for channel ${channelId}:`, error)
      return false
    }
  }

  /**
   * Cleanup old resolved alerts
   */
  cleanupOldAlerts(retentionHours: number = 24): number {
    const cutoffTime = Date.now() - (retentionHours * 60 * 60 * 1000)
    let removedCount = 0

    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.status === 'resolved' && new Date(alert.timestamp).getTime() < cutoffTime) {
        this.alerts.delete(alertId)
        removedCount++
      }
    }

    // Also cleanup history
    this.alertHistory = this.alertHistory.filter(alert => 
      alert.status !== 'resolved' || new Date(alert.timestamp).getTime() >= cutoffTime
    )

    if (removedCount > 0) {
      console.log(`🗑️ Cleaned up ${removedCount} old resolved alerts`)
    }

    return removedCount
  }

  /**
   * Shutdown alerting service
   */
  shutdown(): void {
    // Clear all escalation timers
    for (const timer of this.escalationTimers.values()) {
      clearTimeout(timer)
    }
    this.escalationTimers.clear()
    
    console.log('🛑 Alerting service shut down')
  }
}