/**
 * Utility functions for the alerting system
 */

import { AlertSeverity, AlertType, UnifiedAlert } from './types'

/**
 * Generate unique alert ID
 */
export function generateAlertId(type: AlertType, severity: AlertSeverity): string {
  return `${type}-${severity}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Get severity color for notifications
 */
export function getSeverityColor(severity: AlertSeverity): string {
  switch (severity) {
    case 'critical': return '#FF0000'
    case 'high': return '#FF8800'
    case 'medium': return '#FFAA00'
    case 'low': return '#00AA00'
    default: return '#808080'
  }
}

/**
 * Get severity priority (higher number = higher priority)
 */
export function getSeverityPriority(severity: AlertSeverity): number {
  switch (severity) {
    case 'critical': return 4
    case 'high': return 3
    case 'medium': return 2
    case 'low': return 1
    default: return 0
  }
}

/**
 * Generate recommendations based on alert type and details
 */
export function generateRecommendations(type: AlertType, severity: AlertSeverity, details: any): string[] {
  const recommendations: string[] = []

  switch (type) {
    case 'database':
      recommendations.push('Check database connection status')
      recommendations.push('Verify database server health')
      recommendations.push('Review recent database logs')
      if (severity === 'critical') {
        recommendations.push('Contact database administrator immediately')
        recommendations.push('Consider activating failover procedures')
      }
      break
    case 'performance':
      recommendations.push('Monitor system resources')
      recommendations.push('Check for bottlenecks in processing pipeline')
      recommendations.push('Review recent performance metrics')
      if (details?.stage) {
        recommendations.push(`Investigate ${details.stage} stage performance`)
      }
      if (severity === 'critical') {
        recommendations.push('Consider scaling resources immediately')
      }
      break
    case 'system':
      recommendations.push('Check system logs for errors')
      recommendations.push('Monitor CPU and memory usage')
      recommendations.push('Verify system health indicators')
      if (severity === 'critical') {
        recommendations.push('Consider restarting affected services')
      }
      break
    case 'security':
      recommendations.push('Review security logs immediately')
      recommendations.push('Check for unauthorized access attempts')
      recommendations.push('Verify firewall and access controls')
      if (severity === 'critical') {
        recommendations.push('Consider blocking suspicious IP addresses')
        recommendations.push('Notify security team immediately')
      }
      break
    case 'integration':
      recommendations.push('Check external service status')
      recommendations.push('Verify API keys and authentication')
      recommendations.push('Review integration logs')
      if (severity === 'critical') {
        recommendations.push('Consider enabling fallback mechanisms')
      }
      break
    case 'user':
      recommendations.push('Review user activity patterns')
      recommendations.push('Check for system usability issues')
      if (details?.userId) {
        recommendations.push(`Review specific user ${details.userId} activities`)
      }
      break
  }

  return recommendations
}

/**
 * Check if two alerts are similar (for deduplication)
 */
export function areAlertsSimilar(alert1: UnifiedAlert, alert2: UnifiedAlert): boolean {
  return (
    alert1.type === alert2.type &&
    alert1.severity === alert2.severity &&
    alert1.source === alert2.source &&
    alert1.title === alert2.title
  )
}

/**
 * Calculate alert priority score
 */
export function calculateAlertPriority(alert: UnifiedAlert): number {
  let priority = getSeverityPriority(alert.severity) * 10

  // Add points for escalation level
  priority += alert.escalationLevel * 5

  // Add points for affected resources
  priority += alert.affectedResources.length * 2

  // Add points for age (older alerts get higher priority)
  const ageMinutes = (Date.now() - new Date(alert.timestamp).getTime()) / (1000 * 60)
  priority += Math.min(ageMinutes / 10, 20) // Max 20 points for age

  return priority
}

/**
 * Format alert for display
 */
export function formatAlertForDisplay(alert: UnifiedAlert): string {
  const emoji = getSeverityEmoji(alert.severity)
  const timestamp = new Date(alert.timestamp).toLocaleString()
  return `${emoji} [${alert.severity.toUpperCase()}] ${alert.title} (${timestamp})`
}

/**
 * Get emoji for severity
 */
export function getSeverityEmoji(severity: AlertSeverity): string {
  switch (severity) {
    case 'critical': return '🔥'
    case 'high': return '⚠️'
    case 'medium': return '⚡'
    case 'low': return 'ℹ️'
    default: return '❓'
  }
}

/**
 * Validate alert data
 */
export function validateAlert(alert: Partial<UnifiedAlert>): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!alert.type) {
    errors.push('Alert type is required')
  }

  if (!alert.severity) {
    errors.push('Alert severity is required')
  }

  if (!alert.title || alert.title.trim().length === 0) {
    errors.push('Alert title is required')
  }

  if (!alert.message || alert.message.trim().length === 0) {
    errors.push('Alert message is required')
  }

  if (!alert.source || alert.source.trim().length === 0) {
    errors.push('Alert source is required')
  }

  if (alert.title && alert.title.length > 200) {
    errors.push('Alert title must be 200 characters or less')
  }

  if (alert.message && alert.message.length > 1000) {
    errors.push('Alert message must be 1000 characters or less')
  }

  return { isValid: errors.length === 0, errors }
}

/**
 * Create alert key for deduplication
 */
export function createAlertKey(alert: UnifiedAlert): string {
  return `${alert.type}:${alert.severity}:${alert.source}:${alert.title}`
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days}d ${hours % 24}h`
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

/**
 * Check if alert is expired based on retention policy
 */
export function isAlertExpired(alert: UnifiedAlert, retentionHours: number): boolean {
  const cutoffTime = Date.now() - (retentionHours * 60 * 60 * 1000)
  return new Date(alert.timestamp).getTime() < cutoffTime
}

/**
 * Sanitize alert data for external consumption
 */
export function sanitizeAlert(alert: UnifiedAlert): UnifiedAlert {
  return {
    ...alert,
    details: alert.details ? JSON.parse(JSON.stringify(alert.details)) : {},
    recommendations: [...alert.recommendations],
    tags: [...alert.tags],
    affectedResources: [...alert.affectedResources],
    notificationsSent: [...alert.notificationsSent]
  }
}