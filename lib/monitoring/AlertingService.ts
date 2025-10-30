/**
 * Backward compatibility re-export for AlertingService
 * 
 * The AlertingService has been refactored into specialized services.
 * This file maintains backward compatibility by re-exporting the facade.
 */

// Re-export the backward-compatible facade
export { AlertingService } from './alerting/AlertingService'

// Re-export types for backward compatibility
export type {
  UnifiedAlert,
  AlertRule,
  NotificationChannel,
  AlertingMetrics,
  AlertSeverity,
  AlertType,
  AlertStatus,
  EscalationRule,
  SuppressionRule
} from './alerting/types'