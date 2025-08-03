/**
 * System Health Service - Comprehensive system monitoring and health aggregation
 */

import { DatabaseHealthMonitor, DatabaseHealthMetrics, DatabaseAlert } from './DatabaseHealthMonitor'
import { ProcessingService } from '../processing/ProcessingService'
import { SystemHealthMetrics } from '../processing/interfaces'
import { getConfig, getSection } from '../config/index'
import { AlertingService } from './AlertingService'

export interface ComprehensiveHealthMetrics {
  overall: {
    status: 'healthy' | 'degraded' | 'unhealthy' | 'critical'
    uptime: number
    lastUpdated: string
  }
  database: DatabaseHealthMetrics
  processing: SystemHealthMetrics
  system: {
    memory: {
      used: number
      total: number
      percentage: number
    }
    cpu: {
      usage: number
      loadAverage: number[]
    }
    environment: {
      nodeVersion: string
      platform: string
      environment: string
    }
  }
  services: {
    database: 'online' | 'offline' | 'degraded'
    processing: 'online' | 'offline' | 'degraded'
    storage: 'online' | 'offline' | 'degraded'
    api: 'online' | 'offline' | 'degraded'
  }
  alerts: {
    critical: number
    high: number
    medium: number
    low: number
    total: number
    recentAlerts: Array<{
      id: string
      severity: string
      type: string
      message: string
      timestamp: string
      source: 'database' | 'processing' | 'system'
    }>
  }
}

export interface HealthTrend {
  timestamp: string
  database: DatabaseHealthMetrics['status']
  processing: SystemHealthMetrics['healthStatus']
  overall: ComprehensiveHealthMetrics['overall']['status']
}

export class SystemHealthService {
  private dbMonitor: DatabaseHealthMonitor
  private processingService: ProcessingService
  private alertingService: AlertingService
  private config: ReturnType<typeof getSection<'monitoring'>>
  private startTime = Date.now()
  private healthHistory: HealthTrend[] = []
  private systemAlerts: Array<{
    id: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    type: string
    message: string
    timestamp: string
    source: 'database' | 'processing' | 'system'
    resolved: boolean
  }> = []

  constructor(processingService: ProcessingService) {
    this.dbMonitor = new DatabaseHealthMonitor()
    this.processingService = processingService
    this.alertingService = new AlertingService()
    this.config = getSection('monitoring')
  }

  /**
   * Initialize system health monitoring
   */
  async initialize(): Promise<void> {
    console.log('🔍 Initializing system health monitoring...')
    
    // Start database monitoring if enabled
    if (this.config.enableMetrics) {
      this.dbMonitor.startMonitoring()
    }

    console.log('✅ System health monitoring initialized')
  }

  /**
   * Get comprehensive system health metrics
   */
  async getSystemHealth(): Promise<ComprehensiveHealthMetrics> {
    console.log('📊 Collecting comprehensive system health metrics...')

    try {
      // Get database health
      let databaseHealth = this.dbMonitor.getCurrentHealth()
      if (!databaseHealth) {
        databaseHealth = await this.dbMonitor.performHealthCheck()
      }

      // Get processing health
      const processingHealth = await this.processingService.getSystemHealthMetrics()

      // Get system metrics
      const systemMetrics = this.getSystemMetrics()

      // Determine service statuses
      const services = this.determineServiceStatuses(databaseHealth, processingHealth)

      // Aggregate alerts
      const alerts = this.aggregateAlerts(databaseHealth)

      // Determine overall status
      const overallStatus = this.determineOverallStatus(databaseHealth, processingHealth, systemMetrics)

      const healthMetrics: ComprehensiveHealthMetrics = {
        overall: {
          status: overallStatus,
          uptime: Date.now() - this.startTime,
          lastUpdated: new Date().toISOString()
        },
        database: databaseHealth,
        processing: processingHealth,
        system: systemMetrics,
        services,
        alerts
      }

      // Record health trend
      this.recordHealthTrend(healthMetrics)

      // Process alerts based on health status
      await this.processHealthAlerts(healthMetrics)

      return healthMetrics

    } catch (error) {
      console.error('❌ Failed to collect system health metrics:', error)
      
      // Return critical health status
      return this.getCriticalHealthMetrics(error)
    }
  }

  /**
   * Get system metrics (CPU, memory, etc.)
   */
  private getSystemMetrics(): ComprehensiveHealthMetrics['system'] {
    try {
      const memoryUsage = process.memoryUsage()
      const totalMemory = memoryUsage.heapTotal + memoryUsage.external
      const usedMemory = memoryUsage.heapUsed
      
      return {
        memory: {
          used: usedMemory,
          total: totalMemory,
          percentage: (usedMemory / totalMemory) * 100
        },
        cpu: {
          usage: process.cpuUsage().user / 1000000, // Convert to seconds
          loadAverage: process.platform === 'win32' ? [0, 0, 0] : require('os').loadavg()
        },
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          environment: getConfig().environment
        }
      }
    } catch (error) {
      console.warn('Failed to get system metrics:', error)
      return {
        memory: { used: 0, total: 0, percentage: 0 },
        cpu: { usage: 0, loadAverage: [0, 0, 0] },
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          environment: getConfig().environment
        }
      }
    }
  }

  /**
   * Determine individual service statuses
   */
  private determineServiceStatuses(
    databaseHealth: DatabaseHealthMetrics,
    processingHealth: SystemHealthMetrics
  ): ComprehensiveHealthMetrics['services'] {
    return {
      database: this.mapHealthStatus(databaseHealth.status),
      processing: this.mapHealthStatus(processingHealth.healthStatus),
      storage: databaseHealth.storage.utilizationPercentage > 90 ? 'degraded' : 'online',
      api: databaseHealth.connection.isConnected ? 'online' : 'offline'
    }
  }

  /**
   * Map health status to service status
   */
  private mapHealthStatus(status: string): 'online' | 'offline' | 'degraded' {
    switch (status) {
      case 'healthy':
        return 'online'
      case 'degraded':
        return 'degraded'
      case 'unhealthy':
      case 'critical':
        return 'offline'
      default:
        return 'degraded'
    }
  }

  /**
   * Aggregate alerts from all sources
   */
  private aggregateAlerts(databaseHealth: DatabaseHealthMetrics): ComprehensiveHealthMetrics['alerts'] {
    const dbAlerts = this.dbMonitor.getActiveAlerts()
    
    // Convert database alerts to system alerts format
    const systemAlerts = dbAlerts.map(alert => ({
      id: alert.id,
      severity: alert.severity,
      type: alert.type,
      message: alert.message,
      timestamp: alert.timestamp,
      source: 'database' as const
    }))

    // Add system-level alerts
    systemAlerts.push(...this.systemAlerts.filter(alert => !alert.resolved))

    // Count by severity
    const severityCounts = {
      critical: systemAlerts.filter(a => a.severity === 'critical').length,
      high: systemAlerts.filter(a => a.severity === 'high').length,
      medium: systemAlerts.filter(a => a.severity === 'medium').length,
      low: systemAlerts.filter(a => a.severity === 'low').length
    }

    return {
      ...severityCounts,
      total: systemAlerts.length,
      recentAlerts: systemAlerts.slice(-10) // Last 10 alerts
    }
  }

  /**
   * Determine overall system status
   */
  private determineOverallStatus(
    databaseHealth: DatabaseHealthMetrics,
    processingHealth: SystemHealthMetrics,
    systemMetrics: ComprehensiveHealthMetrics['system']
  ): ComprehensiveHealthMetrics['overall']['status'] {
    // Critical conditions
    if (databaseHealth.status === 'critical' || processingHealth.healthStatus === 'critical') {
      return 'critical'
    }

    if (systemMetrics.memory.percentage > 95) {
      return 'critical'
    }

    // Unhealthy conditions
    if (databaseHealth.status === 'unhealthy' || processingHealth.healthStatus === 'unhealthy') {
      return 'unhealthy'
    }

    if (systemMetrics.memory.percentage > 85) {
      return 'unhealthy'
    }

    // Degraded conditions
    if (databaseHealth.status === 'degraded' || processingHealth.healthStatus === 'degraded') {
      return 'degraded'
    }

    if (systemMetrics.memory.percentage > 75) {
      return 'degraded'
    }

    return 'healthy'
  }

  /**
   * Record health trend for historical analysis
   */
  private recordHealthTrend(health: ComprehensiveHealthMetrics): void {
    const trend: HealthTrend = {
      timestamp: new Date().toISOString(),
      database: health.database.status,
      processing: health.processing.healthStatus,
      overall: health.overall.status
    }

    this.healthHistory.push(trend)

    // Keep last 100 trend records
    if (this.healthHistory.length > 100) {
      this.healthHistory.shift()
    }
  }

  /**
   * Get critical health metrics for error cases
   */
  private getCriticalHealthMetrics(error: any): ComprehensiveHealthMetrics {
    return {
      overall: {
        status: 'critical',
        uptime: Date.now() - this.startTime,
        lastUpdated: new Date().toISOString()
      },
      database: {
        status: 'critical',
        timestamp: new Date().toISOString(),
        connection: { isConnected: false, responseTime: -1, activeConnections: 0, maxConnections: 0, connectionUtilization: 100 },
        schema: { isValid: false, missingTables: [], errors: ['Health check failed'] },
        performance: { averageQueryTime: -1, slowQueries: [], tableStats: {} },
        storage: { usedSpace: 0, availableSpace: 0, utilizationPercentage: 100, bucketStats: {} },
        errors: [{ type: 'system', message: error instanceof Error ? error.message : 'System error', count: 1, lastOccurrence: new Date().toISOString() }],
        uptime: Date.now() - this.startTime,
        lastCheck: new Date().toISOString()
      },
      processing: {
        circuitBreaker: { isOpen: true, failures: 999, errorTypes: {}, lastFailureTime: Date.now() },
        summary: { totalProcessed: 0, totalSuccessful: 0, totalFailed: 0, successRate: 0, averageProcessingTime: 0, errorCategoryBreakdown: {}, currentlyProcessing: 0, uptime: 0 },
        stuckNotes: [],
        healthStatus: 'critical',
        timestamp: new Date().toISOString()
      },
      system: this.getSystemMetrics(),
      services: {
        database: 'offline',
        processing: 'offline',
        storage: 'offline',
        api: 'offline'
      },
      alerts: {
        critical: 1,
        high: 0,
        medium: 0,
        low: 0,
        total: 1,
        recentAlerts: [{
          id: `system-critical-${Date.now()}`,
          severity: 'critical',
          type: 'system',
          message: 'System health check failed',
          timestamp: new Date().toISOString(),
          source: 'system'
        }]
      }
    }
  }

  /**
   * Add a system-level alert
   */
  addSystemAlert(severity: 'low' | 'medium' | 'high' | 'critical', type: string, message: string): void {
    const alert = {
      id: `system-${type}-${Date.now()}`,
      severity,
      type,
      message,
      timestamp: new Date().toISOString(),
      source: 'system' as const,
      resolved: false
    }

    this.systemAlerts.push(alert)

    // Keep only recent alerts
    if (this.systemAlerts.length > 100) {
      this.systemAlerts.shift()
    }

    console.warn(`🚨 System Alert [${severity}]: ${message}`)
  }

  /**
   * Resolve a system alert
   */
  resolveSystemAlert(alertId: string): boolean {
    const alert = this.systemAlerts.find(a => a.id === alertId)
    if (alert) {
      alert.resolved = true
      console.log(`✅ Resolved system alert: ${alert.message}`)
      return true
    }
    return false
  }

  /**
   * Get health trends
   */
  getHealthTrends(limit?: number): HealthTrend[] {
    if (limit) {
      return this.healthHistory.slice(-limit)
    }
    return [...this.healthHistory]
  }

  /**
   * Get database monitor instance
   */
  getDatabaseMonitor(): DatabaseHealthMonitor {
    return this.dbMonitor
  }

  /**
   * Process health-based alerts
   */
  private async processHealthAlerts(healthMetrics: ComprehensiveHealthMetrics): Promise<void> {
    try {
      // Check for critical database issues
      if (healthMetrics.database.status === 'critical') {
        await this.alertingService.createAlert(
          'database',
          'critical',
          'Database Critical Status',
          'Database health is in critical state',
          {
            connectionStatus: healthMetrics.database.connection,
            schemaStatus: healthMetrics.database.schema,
            storageUsage: healthMetrics.database.storage.utilizationPercentage
          },
          'system-health-monitor',
          ['database', 'critical'],
          ['database']
        )
      }

      // Check for processing issues
      if (healthMetrics.processing.healthStatus === 'critical') {
        await this.alertingService.createAlert(
          'performance',
          'critical',
          'Processing Pipeline Critical',
          'Processing pipeline is in critical state',
          {
            circuitBreaker: healthMetrics.processing.circuitBreaker,
            stuckNotes: healthMetrics.processing.stuckNotes.length,
            summary: healthMetrics.processing.summary
          },
          'system-health-monitor',
          ['processing', 'critical'],
          ['processing-pipeline']
        )
      }

      // Check for high storage usage
      if (healthMetrics.database.storage.utilizationPercentage > 85) {
        const severity = healthMetrics.database.storage.utilizationPercentage > 95 ? 'critical' : 'high'
        await this.alertingService.createAlert(
          'system',
          severity,
          'High Storage Usage',
          `Storage usage is at ${healthMetrics.database.storage.utilizationPercentage.toFixed(1)}%`,
          {
            utilizationPercentage: healthMetrics.database.storage.utilizationPercentage,
            usedSpace: healthMetrics.database.storage.usedSpace,
            availableSpace: healthMetrics.database.storage.availableSpace
          },
          'system-health-monitor',
          ['storage', 'capacity'],
          ['storage']
        )
      }

      // Check for high memory usage
      if (healthMetrics.system.memory.percentage > 85) {
        const severity = healthMetrics.system.memory.percentage > 95 ? 'critical' : 'high'
        await this.alertingService.createAlert(
          'system',
          severity,
          'High Memory Usage',
          `Memory usage is at ${healthMetrics.system.memory.percentage.toFixed(1)}%`,
          {
            memoryPercentage: healthMetrics.system.memory.percentage,
            used: healthMetrics.system.memory.used,
            total: healthMetrics.system.memory.total
          },
          'system-health-monitor',
          ['memory', 'resources'],
          ['system']
        )
      }

      // Check for high alert counts
      if (healthMetrics.alerts.critical > 3) {
        await this.alertingService.createAlert(
          'system',
          'high',
          'High Critical Alert Count',
          `${healthMetrics.alerts.critical} critical alerts are currently active`,
          {
            criticalCount: healthMetrics.alerts.critical,
            totalActive: healthMetrics.alerts.total,
            recentAlerts: healthMetrics.alerts.recentAlerts.slice(0, 5)
          },
          'system-health-monitor',
          ['alerts', 'meta'],
          ['alerting-system']
        )
      }

      // Process database alerts
      const dbAlerts = this.dbMonitor.getActiveAlerts()
      for (const dbAlert of dbAlerts.slice(0, 3)) { // Process max 3 per cycle
        await this.alertingService.processDatabaseAlert(dbAlert)
      }

      // Process performance alerts
      const perfTracker = this.processingService.getPerformanceTracker()
      const perfAlerts = perfTracker.getPerformanceAlerts()
      for (const perfAlert of perfAlerts.slice(0, 3)) { // Process max 3 per cycle
        await this.alertingService.processPerformanceAlert(perfAlert)
      }

    } catch (error) {
      console.error('Failed to process health alerts:', error)
    }
  }

  /**
   * Get alerting service instance
   */
  getAlertingService(): AlertingService {
    return this.alertingService
  }

  /**
   * Shutdown monitoring
   */
  shutdown(): void {
    console.log('🛑 Shutting down system health monitoring...')
    this.dbMonitor.stopMonitoring()
    this.alertingService.shutdown()
    console.log('✅ System health monitoring shut down')
  }

  /**
   * Get monitoring summary
   */
  getMonitoringSummary(): {
    isActive: boolean
    uptime: number
    healthChecks: number
    activeAlerts: number
    systemStatus: string
  } {
    const currentHealth = this.dbMonitor.getCurrentHealth()
    const dbStatus = this.dbMonitor.getMonitoringStatus()
    
    return {
      isActive: dbStatus.isMonitoring,
      uptime: Date.now() - this.startTime,
      healthChecks: dbStatus.healthHistoryCount,
      activeAlerts: dbStatus.activeAlertCount + this.systemAlerts.filter(a => !a.resolved).length,
      systemStatus: currentHealth?.status || 'unknown'
    }
  }
}