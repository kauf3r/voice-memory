/**
 * Backward-compatible AlertingService facade
 * Delegates to the new specialized services while maintaining the original interface
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
import { AlertingServiceOrchestrator } from './AlertingServiceOrchestrator'

/**
 * @deprecated Use AlertingServiceOrchestrator directly for new code.
 * This class provides backward compatibility with the original AlertingService interface.
 */
export class AlertingService {
  private orchestrator: AlertingServiceOrchestrator

  constructor() {
    this.orchestrator = new AlertingServiceOrchestrator()
    console.log('⚠️  Using backward-compatible AlertingService facade. Consider migrating to AlertingServiceOrchestrator.')
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
    return await this.orchestrator.createAlert(
      type, severity, title, message, details, source, tags, affectedResources
    )
  }

  /**
   * Process database alerts from the monitoring system
   */
  async processDatabaseAlert(dbAlert: DatabaseAlert): Promise<UnifiedAlert> {
    return await this.orchestrator.processDatabaseAlert(dbAlert)
  }

  /**
   * Process performance alerts from the metrics tracker
   */
  async processPerformanceAlert(perfAlert: PerformanceAlert): Promise<UnifiedAlert> {
    return await this.orchestrator.processPerformanceAlert(perfAlert)
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string = 'system'): Promise<boolean> {
    return await this.orchestrator.acknowledgeAlert(alertId, acknowledgedBy)
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, resolvedBy: string = 'system'): Promise<boolean> {
    return await this.orchestrator.resolveAlert(alertId, resolvedBy)
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): Promise<UnifiedAlert[]> {
    return this.orchestrator.getActiveAlerts()
  }

  /**
   * Get all alerts with filtering
   */
  getAlerts(filters: AlertFilter = {}): Promise<UnifiedAlert[]> {
    return this.orchestrator.getAlerts(filters)
  }

  /**
   * Get alerting metrics
   */
  getMetrics(): AlertingMetrics {
    return this.orchestrator.getMetrics()
  }

  /**
   * Get alert rules
   */
  getAlertRules(): AlertRule[] {
    return this.orchestrator.getAlertRules()
  }

  /**
   * Get notification channels
   */
  getNotificationChannels(): NotificationChannel[] {
    return this.orchestrator.getNotificationChannels()
  }

  /**
   * Test notification channel
   */
  async testNotificationChannel(channelId: string): Promise<boolean> {
    return await this.orchestrator.testNotificationChannel(channelId)
  }

  /**
   * Cleanup old resolved alerts
   */
  async cleanupOldAlerts(retentionHours: number = 24): Promise<number> {
    const systemStatus = this.orchestrator.getSystemStatus()
    
    // This is handled automatically by the orchestrator's periodic cleanup
    // For compatibility, we simulate the behavior
    console.log(`🗑️ Cleanup requested (${retentionHours}h retention) - handled by periodic cleanup`)
    
    return 0 // Return 0 since cleanup is handled automatically
  }

  /**
   * Shutdown alerting service
   */
  shutdown(): void {
    this.orchestrator.shutdown()
  }

  // Additional methods that provide access to the new functionality
  // while maintaining backward compatibility

  /**
   * Get comprehensive system status
   */
  getSystemStatus(): ReturnType<typeof this.orchestrator.getSystemStatus> {
    return this.orchestrator.getSystemStatus()
  }

  /**
   * Get detailed diagnostics
   */
  getDiagnostics(): ReturnType<typeof this.orchestrator.getDiagnostics> {
    return this.orchestrator.getDiagnostics()
  }

  /**
   * Test the entire alerting pipeline
   */
  async testAlertingPipeline(): Promise<ReturnType<typeof this.orchestrator.testAlertingPipeline>> {
    return await this.orchestrator.testAlertingPipeline()
  }

  /**
   * Add a new alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.orchestrator.addAlertRule(rule)
  }

  /**
   * Add a new notification channel
   */
  addNotificationChannel(channel: NotificationChannel): void {
    this.orchestrator.addNotificationChannel(channel)
  }

  /**
   * Enable or disable an alert rule
   */
  setAlertRuleEnabled(ruleId: string, enabled: boolean): boolean {
    return this.orchestrator.setAlertRuleEnabled(ruleId, enabled)
  }

  /**
   * Enable or disable a notification channel
   */
  setNotificationChannelEnabled(channelId: string, enabled: boolean): boolean {
    return this.orchestrator.setNotificationChannelEnabled(channelId, enabled)
  }

  /**
   * Get service health status
   */
  getServiceHealth(): ReturnType<typeof this.orchestrator.getServiceHealth> {
    return this.orchestrator.getServiceHealth()
  }

  /**
   * Access the underlying orchestrator for advanced use cases
   */
  getOrchestrator(): AlertingServiceOrchestrator {
    return this.orchestrator
  }
}