/**
 * Monitoring System Entry Point
 * 
 * Unified interface for all monitoring and health checking functionality
 */

export { DatabaseHealthMonitor } from './DatabaseHealthMonitor'
export { SystemHealthService } from './SystemHealthService'
export { AlertingService } from './AlertingService'
export { PerformanceMetricsTracker } from './PerformanceMetricsTracker'

export type { 
  DatabaseHealthMetrics, 
  DatabaseAlert 
} from './DatabaseHealthMonitor'

export type { 
  ComprehensiveHealthMetrics, 
  HealthTrend 
} from './SystemHealthService'

export type {
  UnifiedAlert,
  AlertRule,
  NotificationChannel,
  AlertingMetrics,
  AlertSeverity,
  AlertType,
  AlertStatus
} from './AlertingService'

export type {
  PerformanceAnalytics,
  PerformanceAlert,
  DetailedProcessingMetrics
} from './PerformanceMetricsTracker'

// Re-export processing health types
export type { SystemHealthMetrics } from '../processing/interfaces'

import { SystemHealthService } from './SystemHealthService'
import { processingService } from '../processing/ProcessingService'
import { getConfig } from '../config/index'

/**
 * Global system health service instance
 */
let systemHealthService: SystemHealthService | null = null

/**
 * Initialize the monitoring system
 */
export async function initializeMonitoring(): Promise<SystemHealthService> {
  if (!systemHealthService) {
    console.log('🔍 Initializing monitoring system...')
    
    systemHealthService = new SystemHealthService(processingService)
    await systemHealthService.initialize()
    
    console.log('✅ Monitoring system initialized')
  }
  
  return systemHealthService
}

/**
 * Get the system health service instance
 */
export function getSystemHealthService(): SystemHealthService {
  if (!systemHealthService) {
    throw new Error('Monitoring system not initialized. Call initializeMonitoring() first.')
  }
  
  return systemHealthService
}

/**
 * Get current system health (convenience function)
 */
export async function getCurrentSystemHealth() {
  const service = getSystemHealthService()
  return await service.getSystemHealth()
}

/**
 * Check if monitoring is enabled
 */
export function isMonitoringEnabled(): boolean {
  const config = getConfig()
  return config.monitoring.enableMetrics
}

/**
 * Shutdown monitoring system
 */
export function shutdownMonitoring(): void {
  if (systemHealthService) {
    systemHealthService.shutdown()
    systemHealthService = null
    console.log('🛑 Monitoring system shut down')
  }
}

/**
 * Health check for external monitoring services
 */
export async function healthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy' | 'critical'
  timestamp: string
  uptime: number
  services: Record<string, string>
}> {
  try {
    if (!systemHealthService) {
      return {
        status: 'critical',
        timestamp: new Date().toISOString(),
        uptime: 0,
        services: {
          monitoring: 'offline'
        }
      }
    }

    const health = await systemHealthService.getSystemHealth()
    
    return {
      status: health.overall.status,
      timestamp: health.overall.lastUpdated,
      uptime: health.overall.uptime,
      services: {
        database: health.services.database,
        processing: health.services.processing,
        storage: health.services.storage,
        api: health.services.api
      }
    }
  } catch (error) {
    console.error('Health check failed:', error)
    return {
      status: 'critical',
      timestamp: new Date().toISOString(),
      uptime: 0,
      services: {
        monitoring: 'offline',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}

/**
 * Get monitoring metrics for dashboards
 */
export async function getMonitoringMetrics() {
  try {
    const service = getSystemHealthService()
    const health = await service.getSystemHealth()
    const trends = service.getHealthTrends(24) // Last 24 data points
    const summary = service.getMonitoringSummary()

    return {
      current: health,
      trends,
      summary,
      alerts: {
        active: health.alerts.recentAlerts.length,
        breakdown: {
          critical: health.alerts.critical,
          high: health.alerts.high,
          medium: health.alerts.medium,
          low: health.alerts.low
        }
      }
    }
  } catch (error) {
    console.error('Failed to get monitoring metrics:', error)
    throw error
  }
}

/**
 * Auto-initialize monitoring if enabled
 */
if (isMonitoringEnabled()) {
  // Auto-initialize in non-test environments
  if (process.env.NODE_ENV !== 'test') {
    initializeMonitoring().catch(error => {
      console.error('Failed to auto-initialize monitoring:', error)
    })
  }
}

// Export monitoring service for advanced usage
export { systemHealthService as monitoringService }