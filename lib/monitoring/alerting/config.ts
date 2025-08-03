/**
 * Alerting system configuration management
 */

import { getSection } from '../../config/index'
import { AlertingConfig, AlertRule, NotificationChannel } from './types'

export class AlertingConfigManager {
  private config: ReturnType<typeof getSection<'monitoring'>>

  constructor() {
    this.config = getSection('monitoring')
  }

  /**
   * Get alerting configuration
   */
  getAlertingConfig(): AlertingConfig {
    return {
      enabled: this.config.alerting.enabled,
      slackChannel: this.config.alerting.slackChannel,
      webhookUrl: this.config.alerting.webhookUrl,
      retentionHours: 24,
      maxActiveAlerts: 100,
      defaultCooldownMinutes: 5
    }
  }

  /**
   * Get default alert rules
   */
  getDefaultAlertRules(): AlertRule[] {
    return [
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
      },
      {
        id: 'memory-usage-high',
        name: 'High Memory Usage',
        description: 'System memory usage is above safe threshold',
        condition: 'system.memory.usagePercentage > 85',
        severity: 'medium',
        enabled: true,
        cooldownMinutes: 10,
        escalationRules: [
          { level: 1, delayMinutes: 15, notificationChannels: ['slack-alerts'] }
        ],
        suppressionRules: [],
        notificationChannels: ['slack-alerts'],
        tags: ['system', 'memory']
      },
      {
        id: 'cpu-usage-critical',
        name: 'Critical CPU Usage',
        description: 'CPU usage is critically high',
        condition: 'system.cpu.usagePercentage > 95',
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 5,
        escalationRules: [
          { level: 1, delayMinutes: 5, notificationChannels: ['slack-alerts'] },
          { level: 2, delayMinutes: 10, notificationChannels: ['slack-alerts', 'webhook-primary'] }
        ],
        suppressionRules: [],
        notificationChannels: ['slack-alerts'],
        tags: ['system', 'cpu']
      },
      {
        id: 'queue-backup',
        name: 'Processing Queue Backup',
        description: 'Processing queue has too many pending items',
        condition: 'processing.queue.pendingCount > 50',
        severity: 'medium',
        enabled: true,
        cooldownMinutes: 15,
        escalationRules: [],
        suppressionRules: [],
        notificationChannels: ['slack-alerts'],
        tags: ['processing', 'queue']
      },
      {
        id: 'auth-failure-spike',
        name: 'Authentication Failure Spike',
        description: 'Unusual number of authentication failures detected',
        condition: 'security.auth.failureRate > 20',
        severity: 'high',
        enabled: true,
        cooldownMinutes: 10,
        escalationRules: [
          { level: 1, delayMinutes: 10, notificationChannels: ['slack-alerts', 'webhook-primary'] }
        ],
        suppressionRules: [],
        notificationChannels: ['slack-alerts'],
        tags: ['security', 'authentication']
      },
      {
        id: 'disk-space-low',
        name: 'Low Disk Space',
        description: 'Available disk space is running low',
        condition: 'system.disk.usagePercentage > 80',
        severity: 'medium',
        enabled: true,
        cooldownMinutes: 60,
        escalationRules: [
          { level: 1, delayMinutes: 30, notificationChannels: ['slack-alerts'] }
        ],
        suppressionRules: [],
        notificationChannels: ['slack-alerts'],
        tags: ['system', 'storage']
      }
    ]
  }

  /**
   * Get default notification channels
   */
  getDefaultNotificationChannels(): NotificationChannel[] {
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

    return channels
  }

  /**
   * Validate alerting configuration
   */
  validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!this.config.alerting) {
      errors.push('Alerting configuration section is missing')
      return { isValid: false, errors }
    }

    if (this.config.alerting.enabled) {
      if (!this.config.alerting.slackChannel && !this.config.alerting.webhookUrl) {
        errors.push('At least one notification channel (Slack or webhook) must be configured when alerting is enabled')
      }

      if (this.config.alerting.slackChannel && !process.env.SLACK_BOT_TOKEN) {
        errors.push('SLACK_BOT_TOKEN environment variable is required when Slack channel is configured')
      }
    }

    return { isValid: errors.length === 0, errors }
  }
}