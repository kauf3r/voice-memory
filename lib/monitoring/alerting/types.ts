/**
 * Comprehensive type definitions for the alerting system
 */

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

export interface NotificationPayload {
  id: string
  title: string
  message: string
  severity: AlertSeverity
  type: AlertType
  source: string
  timestamp: string
  escalationLevel: number
  details: any
  affectedResources: string[]
  recommendations: string[]
  tags: string[]
}

export interface AlertingConfig {
  enabled: boolean
  slackChannel?: string
  webhookUrl?: string
  retentionHours: number
  maxActiveAlerts: number
  defaultCooldownMinutes: number
}

export interface AlertFilter {
  status?: AlertStatus
  severity?: AlertSeverity
  type?: AlertType
  limit?: number
  startDate?: string
  endDate?: string
  tags?: string[]
}

export interface EscalationTimer {
  alertId: string
  level: number
  scheduledAt: string
  timer: NodeJS.Timeout
}

export interface SuppressionEntry {
  alertKey: string
  suppressedUntil: string
  reason: string
  count: number
}

export interface ChannelHealth {
  channelId: string
  isHealthy: boolean
  lastCheck: string
  errorCount: number
  responseTime?: number
  lastError?: string
}

export interface AlertRepository {
  save(alert: UnifiedAlert): Promise<void>
  update(alert: UnifiedAlert): Promise<void>
  findById(id: string): Promise<UnifiedAlert | null>
  findActive(): Promise<UnifiedAlert[]>
  findByFilters(filters: AlertFilter): Promise<UnifiedAlert[]>
  delete(id: string): Promise<void>
  cleanup(retentionHours: number): Promise<number>
}

export interface AlertMetricsData {
  timestamp: string
  totalAlerts: number
  activeAlerts: number
  resolvedAlerts: number
  escalatedAlerts: number
  notificationsSent: number
  averageResolutionTimeMs: number
}