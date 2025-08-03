/**
 * Main alerting service orchestrator - coordinates all specialized services
 */

import { DatabaseAlert } from '../DatabaseHealthMonitor'
import { PerformanceAlert } from '../PerformanceMetricsTracker'
import { 
  UnifiedAlert, 
  AlertType, 
  AlertSeverity, 
  AlertFilter, 
  NotificationChannel,
  AlertRule,
  AlertingMetrics
} from './types'

import { AlertLifecycleService } from './AlertLifecycleService'
import { AlertRuleEngine } from './AlertRuleEngine'
import { NotificationDispatcher } from './NotificationDispatcher'
import { EscalationScheduler } from './EscalationScheduler'
import { AlertMetricsCollector } from './AlertMetricsCollector'
import { AlertSuppressor } from './AlertSuppressor'
import { ChannelHealthMonitor } from './ChannelHealthMonitor'
import { AlertingConfigManager } from './config'

export class AlertingServiceOrchestrator {
  private lifecycleService: AlertLifecycleService
  private ruleEngine: AlertRuleEngine
  private notificationDispatcher: NotificationDispatcher
  private escalationScheduler: EscalationScheduler
  private metricsCollector: AlertMetricsCollector
  private suppressor: AlertSuppressor
  private healthMonitor: ChannelHealthMonitor
  private configManager: AlertingConfigManager

  private isInitialized = false
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    this.configManager = new AlertingConfigManager()
    this.lifecycleService = new AlertLifecycleService()
    this.ruleEngine = new AlertRuleEngine(this.configManager)
    this.notificationDispatcher = new NotificationDispatcher(this.configManager)
    this.escalationScheduler = new EscalationScheduler()
    this.metricsCollector = new AlertMetricsCollector()
    this.suppressor = new AlertSuppressor()
    this.healthMonitor = new ChannelHealthMonitor()

    this.initialize()
  }

  /**
   * Initialize the orchestrator and wire up dependencies
   */
  private initialize(): void {
    // Wire up escalation callbacks
    this.escalationScheduler.onEscalate(async (alertId, escalation) => {
      const alert = await this.lifecycleService.getAlert(alertId)
      if (!alert || alert.status !== 'active') {
        return false
      }

      // Update escalation level
      await this.lifecycleService.escalateAlert(alertId, escalation.level)

      // Send notifications
      const result = await this.notificationDispatcher.sendNotifications(
        alert, 
        escalation.notificationChannels, 
        escalation.level
      )

      // Record notification results
      result.successful.forEach(channelId => {
        this.lifecycleService.recordNotification(alertId, channelId, escalation.level)
        this.metricsCollector.recordNotificationResult(alertId, channelId, true)
      })

      result.failed.forEach(channelId => {
        this.metricsCollector.recordNotificationResult(alertId, channelId, false)
      })

      // Record escalation in metrics
      this.metricsCollector.recordAlertEscalated(alert)

      return result.successful.length > 0
    })

    this.escalationScheduler.onGetCurrentAlert(async (alertId) => {
      return await this.lifecycleService.getAlert(alertId)
    })

    // Start health monitoring
    const channels = this.notificationDispatcher.getAllChannels()
    this.healthMonitor.startHealthMonitoring(channels)

    // Start periodic cleanup (every hour)
    this.cleanupInterval = setInterval(() => {
      this.performPeriodicCleanup()
    }, 60 * 60 * 1000)

    this.isInitialized = true
    console.log('✅ Alerting service orchestrator initialized')
  }

  /**
   * Create a new alert and process it through the pipeline
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
    if (!this.isInitialized) {
      throw new Error('Alerting service not initialized')
    }

    // Create the alert
    const alert = await this.lifecycleService.createAlert(
      type, severity, title, message, details, source, tags, affectedResources
    )

    // Record in metrics
    this.metricsCollector.recordAlertCreated(alert)

    // Check suppression
    if (this.suppressor.shouldSuppressAlert(alert)) {
      await this.lifecycleService.suppressAlert(alert.id)
      this.metricsCollector.recordAlertSuppressed(alert)
      return alert
    }

    // Process through rule engine and notifications
    await this.processAlertNotifications(alert)

    return alert
  }

  /**
   * Process alert notifications through the rule engine
   */
  private async processAlertNotifications(alert: UnifiedAlert): Promise<void> {
    // Find matching rules
    const matchingRules = this.ruleEngine.findMatchingRules(alert)

    for (const rule of matchingRules) {
      // Send initial notifications
      const result = await this.notificationDispatcher.sendNotifications(
        alert, 
        rule.notificationChannels, 
        0
      )

      // Record notification results
      result.successful.forEach(channelId => {
        this.lifecycleService.recordNotification(alert.id, channelId, 0)
        this.metricsCollector.recordNotificationResult(alert.id, channelId, true)
      })

      result.failed.forEach(channelId => {
        this.metricsCollector.recordNotificationResult(alert.id, channelId, false)
        // Mark channel as unhealthy if it fails
        this.healthMonitor.markChannelUnhealthy(
          channelId, 
          `Failed to send notification for alert ${alert.id}`
        )
      })

      // Schedule escalation if defined
      if (rule.escalationRules.length > 0) {
        this.escalationScheduler.scheduleEscalation(alert, rule)
      }
    }
  }

  /**
   * Process database alerts
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
   * Process performance alerts
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
    const success = await this.lifecycleService.acknowledgeAlert(alertId, acknowledgedBy)
    
    if (success) {
      // Cancel escalation
      this.escalationScheduler.clearEscalation(alertId)
      
      // Record in metrics
      const alert = await this.lifecycleService.getAlert(alertId)
      if (alert) {
        this.metricsCollector.recordAlertAcknowledged(alert)
      }
    }
    
    return success
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, resolvedBy: string = 'system'): Promise<boolean> {
    const success = await this.lifecycleService.resolveAlert(alertId, resolvedBy)
    
    if (success) {
      // Cancel escalation
      this.escalationScheduler.clearEscalation(alertId)
      
      // Record in metrics
      const alert = await this.lifecycleService.getAlert(alertId)
      if (alert) {
        this.metricsCollector.recordAlertResolved(alert)
      }
    }
    
    return success
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(): Promise<UnifiedAlert[]> {
    return await this.lifecycleService.getActiveAlerts()
  }

  /**
   * Get alerts with filtering
   */
  async getAlerts(filters: AlertFilter = {}): Promise<UnifiedAlert[]> {
    return await this.lifecycleService.getAlerts(filters)
  }

  /**
   * Get alerting metrics
   */
  getMetrics(): AlertingMetrics {
    return this.metricsCollector.getMetrics()
  }

  /**
   * Get alert rules
   */
  getAlertRules(): AlertRule[] {
    return this.ruleEngine.getAllRules()
  }

  /**
   * Get notification channels
   */
  getNotificationChannels(): NotificationChannel[] {
    return this.notificationDispatcher.getAllChannels()
  }

  /**
   * Test notification channel
   */
  async testNotificationChannel(channelId: string): Promise<boolean> {
    return await this.notificationDispatcher.testChannel(channelId)
  }

  /**
   * Get comprehensive system status
   */
  getSystemStatus(): {
    alerts: {
      active: number
      total: number
      recentActivity: number
    }
    channels: {
      total: number
      healthy: number
      unhealthy: number
    }
    escalations: {
      pending: number
      totalHistory: number
    }
    suppressions: {
      active: number
      totalSuppressed: number
    }
    performance: {
      averageResolutionTimeMinutes: number
      notificationSuccessRate: number
      escalationRate: number
    }
  } {
    const metrics = this.metricsCollector.getMetrics()
    const channelHealth = this.healthMonitor.getHealthSummary()
    const escalationStats = this.escalationScheduler.getEscalationStatistics()
    const suppressionStats = this.suppressor.getSuppressionStatistics()

    return {
      alerts: {
        active: metrics.activeAlerts,
        total: metrics.totalAlerts,
        recentActivity: metrics.recentActivity.length
      },
      channels: {
        total: channelHealth.totalChannels,
        healthy: channelHealth.healthyChannels,
        unhealthy: channelHealth.unhealthyChannels
      },
      escalations: {
        pending: escalationStats.totalPending,
        totalHistory: escalationStats.totalHistoryEntries
      },
      suppressions: {
        active: suppressionStats.activeSuppressions,
        totalSuppressed: suppressionStats.totalSuppressedAlerts
      },
      performance: {
        averageResolutionTimeMinutes: metrics.averageResolutionTime / (1000 * 60),
        notificationSuccessRate: metrics.notificationSuccessRate,
        escalationRate: metrics.escalationRate
      }
    }
  }

  /**
   * Perform periodic cleanup tasks
   */
  private async performPeriodicCleanup(): Promise<void> {
    try {
      console.log('🧹 Performing periodic alerting cleanup...')

      // Cleanup old alerts
      const config = this.configManager.getAlertingConfig()
      const removedAlerts = await this.lifecycleService.cleanupOldAlerts(config.retentionHours)

      // Cleanup expired suppressions
      const removedSuppressions = this.suppressor.cleanupExpiredSuppressions()

      // Cleanup escalation history
      const removedEscalations = this.escalationScheduler.cleanupHistory(config.retentionHours)

      // Process suppressed alerts (unsuppress expired ones)
      const unsuppressedAlerts = await this.lifecycleService.processSuppressedAlerts()

      if (removedAlerts || removedSuppressions || removedEscalations || unsuppressedAlerts) {
        console.log(`🧹 Cleanup complete: ${removedAlerts} alerts, ${removedSuppressions} suppressions, ${removedEscalations} escalations, ${unsuppressedAlerts} unsuppressed`)
      }
    } catch (error) {
      console.error('Error during periodic cleanup:', error)
    }
  }

  /**
   * Add alert rule
   */
  addAlertRule(rule: AlertRule): void {
    const validation = this.ruleEngine.validateRule(rule)
    if (!validation.isValid) {
      throw new Error(`Invalid alert rule: ${validation.errors.join(', ')}`)
    }
    
    this.ruleEngine.addRule(rule)
  }

  /**
   * Add notification channel
   */
  addNotificationChannel(channel: NotificationChannel): void {
    this.notificationDispatcher.addChannel(channel)
    
    // Update health monitoring
    const allChannels = this.notificationDispatcher.getAllChannels()
    this.healthMonitor.stopHealthMonitoring()
    this.healthMonitor.startHealthMonitoring(allChannels)
  }

  /**
   * Enable/disable alert rule
   */
  setAlertRuleEnabled(ruleId: string, enabled: boolean): boolean {
    return this.ruleEngine.setRuleEnabled(ruleId, enabled)
  }

  /**
   * Enable/disable notification channel
   */
  setNotificationChannelEnabled(channelId: string, enabled: boolean): boolean {
    return this.notificationDispatcher.setChannelEnabled(channelId, enabled)
  }

  /**
   * Get detailed diagnostics
   */
  getDiagnostics(): {
    configValidation: ReturnType<typeof this.configManager.validateConfig>
    channelHealth: ReturnType<typeof this.healthMonitor.getAllChannelHealth>
    ruleStatistics: ReturnType<typeof this.ruleEngine.getRuleStatistics>
    suppressionStatistics: ReturnType<typeof this.suppressor.getSuppressionStatistics>
    escalationStatistics: ReturnType<typeof this.escalationScheduler.getEscalationStatistics>
    metricsExport: ReturnType<typeof this.metricsCollector.exportMetrics>
  } {
    return {
      configValidation: this.configManager.validateConfig(),
      channelHealth: this.healthMonitor.getAllChannelHealth(),
      ruleStatistics: this.ruleEngine.getRuleStatistics(),
      suppressionStatistics: this.suppressor.getSuppressionStatistics(),
      escalationStatistics: this.escalationScheduler.getEscalationStatistics(),
      metricsExport: this.metricsCollector.exportMetrics()
    }
  }

  /**
   * Test entire alerting pipeline
   */
  async testAlertingPipeline(): Promise<{
    success: boolean
    steps: Array<{
      step: string
      success: boolean
      duration: number
      error?: string
    }>
  }> {
    const results: Array<{
      step: string
      success: boolean
      duration: number
      error?: string
    }> = []

    let overallSuccess = true

    // Test 1: Create test alert
    try {
      const start = Date.now()
      const testAlert = await this.createAlert(
        'system',
        'low',
        'Test Alert - Pipeline Validation',
        'This is a test alert to validate the alerting pipeline',
        { test: true, pipeline: 'validation' },
        'pipeline-test',
        ['test', 'validation'],
        []
      )
      
      results.push({
        step: 'Create Alert',
        success: true,
        duration: Date.now() - start
      })

      // Test 2: Acknowledge alert
      const ackStart = Date.now()
      const ackSuccess = await this.acknowledgeAlert(testAlert.id, 'pipeline-test')
      
      results.push({
        step: 'Acknowledge Alert',
        success: ackSuccess,
        duration: Date.now() - ackStart
      })

      if (!ackSuccess) overallSuccess = false

      // Test 3: Resolve alert
      const resolveStart = Date.now()
      const resolveSuccess = await this.resolveAlert(testAlert.id, 'pipeline-test')
      
      results.push({
        step: 'Resolve Alert',
        success: resolveSuccess,
        duration: Date.now() - resolveStart
      })

      if (!resolveSuccess) overallSuccess = false

    } catch (error) {
      results.push({
        step: 'Create Alert',
        success: false,
        duration: 0,
        error: error instanceof Error ? error.message : String(error)
      })
      overallSuccess = false
    }

    // Test 4: Channel health
    try {
      const healthStart = Date.now()
      const channels = this.notificationDispatcher.getAllChannels()
      const healthResults = await this.healthMonitor.testAllChannels(channels)
      
      const healthyChannels = Array.from(healthResults.values()).filter(Boolean).length
      const channelSuccess = healthyChannels > 0
      
      results.push({
        step: 'Channel Health Test',
        success: channelSuccess,
        duration: Date.now() - healthStart
      })

      if (!channelSuccess) overallSuccess = false
    } catch (error) {
      results.push({
        step: 'Channel Health Test',
        success: false,
        duration: 0,
        error: error instanceof Error ? error.message : String(error)
      })
      overallSuccess = false
    }

    return { success: overallSuccess, steps: results }
  }

  /**
   * Shutdown the alerting service
   */
  shutdown(): void {
    console.log('🛑 Shutting down alerting service...')

    // Clear escalation timers
    this.escalationScheduler.clearAllEscalations()

    // Stop health monitoring
    this.healthMonitor.stopHealthMonitoring()

    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }

    this.isInitialized = false
    console.log('🛑 Alerting service shut down')
  }

  /**
   * Get service health status
   */
  getServiceHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy'
    services: Record<string, boolean>
    lastCheck: string
  } {
    const channelHealth = this.healthMonitor.getHealthSummary()
    const metrics = this.metricsCollector.getMetrics()
    
    const services = {
      lifecycle: this.isInitialized,
      ruleEngine: this.ruleEngine.getEnabledRules().length > 0,
      notifications: channelHealth.healthyChannels > 0,
      escalations: this.escalationScheduler.getPendingEscalations().length >= 0, // Always true if running
      metrics: metrics.totalAlerts >= 0, // Always true if running
      suppression: true, // Always healthy
      healthMonitor: channelHealth.totalChannels > 0
    }

    const healthyServices = Object.values(services).filter(Boolean).length
    const totalServices = Object.keys(services).length

    let status: 'healthy' | 'degraded' | 'unhealthy'
    if (healthyServices === totalServices) {
      status = 'healthy'
    } else if (healthyServices >= totalServices * 0.7) {
      status = 'degraded'
    } else {
      status = 'unhealthy'
    }

    return {
      status,
      services,
      lastCheck: new Date().toISOString()
    }
  }
}