/**
 * Alerting system exports
 */

// Core services
export { AlertingServiceOrchestrator } from './AlertingServiceOrchestrator'
export { AlertLifecycleService } from './AlertLifecycleService'
export { AlertRuleEngine } from './AlertRuleEngine'
export { NotificationDispatcher } from './NotificationDispatcher'
export { EscalationScheduler } from './EscalationScheduler'
export { AlertMetricsCollector } from './AlertMetricsCollector'
export { AlertSuppressor } from './AlertSuppressor'
export { ChannelHealthMonitor } from './ChannelHealthMonitor'

// Configuration and utilities
export { AlertingConfigManager } from './config'
export { NotificationTemplates } from './NotificationTemplates'
export { InMemoryAlertRepository } from './repository'
export * from './utils'

// Types
export * from './types'

// Main service (for backward compatibility)
export { AlertingService } from './AlertingService'