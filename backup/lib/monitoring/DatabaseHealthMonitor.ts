/**
 * Database Health Monitor - Comprehensive database health tracking and monitoring
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '../supabase-server'
import { createDatabaseService, validateDatabaseSchema } from '../database/queries'
import { getSection } from '../config/index'

export interface DatabaseHealthMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'critical'
  timestamp: string
  connection: {
    isConnected: boolean
    responseTime: number
    activeConnections: number
    maxConnections: number
    connectionUtilization: number
  }
  schema: {
    isValid: boolean
    missingTables: string[]
    errors: string[]
  }
  performance: {
    averageQueryTime: number
    slowQueries: Array<{
      query: string
      duration: number
      timestamp: string
    }>
    tableStats: Record<string, {
      size: number
      rowCount: number
      indexUsage: number
    }>
  }
  storage: {
    usedSpace: number
    availableSpace: number
    utilizationPercentage: number
    bucketStats: Record<string, {
      fileCount: number
      totalSize: number
    }>
  }
  errors: Array<{
    type: string
    message: string
    count: number
    lastOccurrence: string
  }>
  uptime: number
  lastCheck: string
}

export interface DatabaseAlert {
  id: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  type: 'connection' | 'performance' | 'storage' | 'schema' | 'error'
  message: string
  details: any
  timestamp: string
  resolved: boolean
}

export class DatabaseHealthMonitor {
  private client: SupabaseClient
  private dbService: ReturnType<typeof createDatabaseService>
  private config: ReturnType<typeof getSection<'monitoring'>>
  private healthHistory: DatabaseHealthMetrics[] = []
  private alerts: DatabaseAlert[] = []
  private isMonitoring = false
  private monitoringInterval: NodeJS.Timeout | null = null
  private startTime = Date.now()

  constructor() {
    this.client = createServiceClient()
    this.dbService = createDatabaseService(this.client)
    this.config = getSection('monitoring')
  }

  /**
   * Start continuous health monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      console.log('📊 Database health monitoring is already running')
      return
    }

    this.isMonitoring = true
    console.log('🔍 Starting database health monitoring...')

    // Perform initial health check
    this.performHealthCheck()

    // Set up periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.performHealthCheck()
    }, this.config.healthCheckInterval)

    console.log(`✅ Database health monitoring started (interval: ${this.config.healthCheckInterval}ms)`)
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return
    }

    this.isMonitoring = false
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    console.log('🛑 Database health monitoring stopped')
  }

  /**
   * Perform a comprehensive health check
   */
  async performHealthCheck(): Promise<DatabaseHealthMetrics> {
    const startTime = Date.now()
    console.log('🔍 Performing database health check...')

    try {
      // Test basic connectivity
      const connection = await this.checkConnection()
      
      // Validate schema
      const schema = await this.checkSchema()
      
      // Check performance metrics
      const performance = await this.checkPerformance()
      
      // Check storage usage
      const storage = await this.checkStorage()
      
      // Analyze recent errors
      const errors = await this.analyzeErrors()

      const metrics: DatabaseHealthMetrics = {
        status: this.determineOverallStatus(connection, schema, performance, storage, errors),
        timestamp: new Date().toISOString(),
        connection,
        schema,
        performance,
        storage,
        errors,
        uptime: Date.now() - this.startTime,
        lastCheck: new Date().toISOString()
      }

      // Store in history (keep last 100 checks)
      this.healthHistory.push(metrics)
      if (this.healthHistory.length > 100) {
        this.healthHistory.shift()
      }

      // Check for alerts
      await this.checkForAlerts(metrics)

      const checkDuration = Date.now() - startTime
      console.log(`✅ Database health check completed in ${checkDuration}ms - Status: ${metrics.status}`)
      
      return metrics

    } catch (error) {
      console.error('❌ Database health check failed:', error)
      
      const criticalMetrics: DatabaseHealthMetrics = {
        status: 'critical',
        timestamp: new Date().toISOString(),
        connection: { isConnected: false, responseTime: -1, activeConnections: 0, maxConnections: 0, connectionUtilization: 100 },
        schema: { isValid: false, missingTables: [], errors: [error instanceof Error ? error.message : 'Unknown error'] },
        performance: { averageQueryTime: -1, slowQueries: [], tableStats: {} },
        storage: { usedSpace: 0, availableSpace: 0, utilizationPercentage: 100, bucketStats: {} },
        errors: [{ type: 'health_check', message: error instanceof Error ? error.message : 'Health check failed', count: 1, lastOccurrence: new Date().toISOString() }],
        uptime: Date.now() - this.startTime,
        lastCheck: new Date().toISOString()
      }

      this.healthHistory.push(criticalMetrics)
      return criticalMetrics
    }
  }

  /**
   * Check database connection health
   */
  private async checkConnection(): Promise<DatabaseHealthMetrics['connection']> {
    const startTime = Date.now()
    
    try {
      // Test basic connectivity
      const { error } = await this.client
        .from('notes')
        .select('id')
        .limit(1)
      
      const responseTime = Date.now() - startTime
      const isConnected = !error

      // Get connection stats (simplified - would need custom functions for accurate stats)
      const activeConnections = isConnected ? 1 : 0
      const maxConnections = getSection('database').maxConnections
      const connectionUtilization = (activeConnections / maxConnections) * 100

      return {
        isConnected,
        responseTime,
        activeConnections,
        maxConnections,
        connectionUtilization
      }
    } catch (error) {
      return {
        isConnected: false,
        responseTime: -1,
        activeConnections: 0,
        maxConnections: 0,
        connectionUtilization: 100
      }
    }
  }

  /**
   * Check database schema validity
   */
  private async checkSchema(): Promise<DatabaseHealthMetrics['schema']> {
    try {
      const validation = await validateDatabaseSchema(this.dbService)
      
      return {
        isValid: validation.valid,
        missingTables: validation.missingTables,
        errors: validation.errors
      }
    } catch (error) {
      return {
        isValid: false,
        missingTables: [],
        errors: [error instanceof Error ? error.message : 'Schema validation failed']
      }
    }
  }

  /**
   * Check database performance metrics
   */
  private async checkPerformance(): Promise<DatabaseHealthMetrics['performance']> {
    try {
      const performanceData = {
        averageQueryTime: 0,
        slowQueries: [] as Array<{ query: string; duration: number; timestamp: string }>,
        tableStats: {} as Record<string, { size: number; rowCount: number; indexUsage: number }>
      }

      // Test query performance with a few sample queries
      const queries = [
        { name: 'notes_count', query: () => this.client.from('notes').select('id', { count: 'exact', head: true }) },
        { name: 'recent_notes', query: () => this.client.from('notes').select('*').order('created_at', { ascending: false }).limit(10) },
        { name: 'task_states_count', query: () => this.client.from('task_states').select('id', { count: 'exact', head: true }) }
      ]

      const queryTimes: number[] = []

      for (const { name, query } of queries) {
        const startTime = Date.now()
        try {
          await query()
          const duration = Date.now() - startTime
          queryTimes.push(duration)
          
          // Track slow queries (>1000ms)
          if (duration > 1000) {
            performanceData.slowQueries.push({
              query: name,
              duration,
              timestamp: new Date().toISOString()
            })
          }
        } catch (error) {
          console.warn(`Query ${name} failed:`, error)
        }
      }

      // Calculate average query time
      performanceData.averageQueryTime = queryTimes.length > 0 
        ? queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length 
        : 0

      // Get basic table stats
      try {
        const { data: notesData } = await this.client.from('notes').select('id', { count: 'exact', head: true })
        const { data: taskStatesData } = await this.client.from('task_states').select('id', { count: 'exact', head: true })
        const { data: taskPinsData } = await this.client.from('task_pins').select('id', { count: 'exact', head: true })

        performanceData.tableStats = {
          notes: {
            size: 0, // Would need custom functions to get actual size
            rowCount: notesData?.length || 0,
            indexUsage: 95 // Placeholder - would need actual index usage stats
          },
          task_states: {
            size: 0,
            rowCount: taskStatesData?.length || 0,
            indexUsage: 90
          },
          task_pins: {
            size: 0,
            rowCount: taskPinsData?.length || 0,
            indexUsage: 85
          }
        }
      } catch (error) {
        console.warn('Failed to get table stats:', error)
      }

      return performanceData
    } catch (error) {
      return {
        averageQueryTime: -1,
        slowQueries: [],
        tableStats: {}
      }
    }
  }

  /**
   * Check storage usage
   */
  private async checkStorage(): Promise<DatabaseHealthMetrics['storage']> {
    try {
      const storageData = {
        usedSpace: 0,
        availableSpace: 0,
        utilizationPercentage: 0,
        bucketStats: {} as Record<string, { fileCount: number; totalSize: number }>
      }

      // Get bucket information
      try {
        const { data: buckets } = await this.client.storage.listBuckets()
        
        if (buckets) {
          for (const bucket of buckets) {
            try {
              const { data: files } = await this.client.storage.from(bucket.name).list()
              
              if (files) {
                const totalSize = files.reduce((sum, file) => sum + (file.metadata?.size || 0), 0)
                storageData.bucketStats[bucket.name] = {
                  fileCount: files.length,
                  totalSize
                }
                storageData.usedSpace += totalSize
              }
            } catch (error) {
              console.warn(`Failed to get stats for bucket ${bucket.name}:`, error)
            }
          }
        }

        // Estimate available space (would need actual Supabase project limits)
        const estimatedTotalSpace = 1073741824 // 1GB default for free tier
        storageData.availableSpace = Math.max(0, estimatedTotalSpace - storageData.usedSpace)
        storageData.utilizationPercentage = (storageData.usedSpace / estimatedTotalSpace) * 100

      } catch (error) {
        console.warn('Failed to get storage stats:', error)
      }

      return storageData
    } catch (error) {
      return {
        usedSpace: 0,
        availableSpace: 0,
        utilizationPercentage: 0,
        bucketStats: {}
      }
    }
  }

  /**
   * Analyze recent database errors
   */
  private async analyzeErrors(): Promise<DatabaseHealthMetrics['errors']> {
    try {
      // This would typically analyze logs or error tables
      // For now, return basic error categories based on recent health checks
      const errorCategories: Record<string, { count: number; lastOccurrence: string; message: string }> = {}

      // Analyze previous health checks for patterns
      const recentChecks = this.healthHistory.slice(-10)
      for (const check of recentChecks) {
        if (check.status === 'critical' || check.status === 'unhealthy') {
          const errorType = check.connection.isConnected ? 'performance' : 'connection'
          if (!errorCategories[errorType]) {
            errorCategories[errorType] = {
              count: 0,
              lastOccurrence: check.timestamp,
              message: `Database ${errorType} issues detected`
            }
          }
          errorCategories[errorType].count++
        }
      }

      return Object.entries(errorCategories).map(([type, data]) => ({
        type,
        message: data.message,
        count: data.count,
        lastOccurrence: data.lastOccurrence
      }))
    } catch (error) {
      return [{
        type: 'monitoring',
        message: 'Error analysis failed',
        count: 1,
        lastOccurrence: new Date().toISOString()
      }]
    }
  }

  /**
   * Determine overall health status
   */
  private determineOverallStatus(
    connection: DatabaseHealthMetrics['connection'],
    schema: DatabaseHealthMetrics['schema'],
    performance: DatabaseHealthMetrics['performance'],
    storage: DatabaseHealthMetrics['storage'],
    errors: DatabaseHealthMetrics['errors']
  ): DatabaseHealthMetrics['status'] {
    // Critical conditions
    if (!connection.isConnected || !schema.isValid) {
      return 'critical'
    }

    if (storage.utilizationPercentage > 90) {
      return 'critical'
    }

    // Unhealthy conditions
    if (connection.responseTime > 5000 || performance.averageQueryTime > 2000) {
      return 'unhealthy'
    }

    if (errors.length > 5) {
      return 'unhealthy'
    }

    // Degraded conditions
    if (connection.responseTime > 2000 || performance.averageQueryTime > 1000) {
      return 'degraded'
    }

    if (storage.utilizationPercentage > 70) {
      return 'degraded'
    }

    if (performance.slowQueries.length > 3) {
      return 'degraded'
    }

    return 'healthy'
  }

  /**
   * Check for alert conditions and generate alerts
   */
  private async checkForAlerts(metrics: DatabaseHealthMetrics): Promise<void> {
    const newAlerts: DatabaseAlert[] = []

    // Connection alerts
    if (!metrics.connection.isConnected) {
      newAlerts.push({
        id: `connection-${Date.now()}`,
        severity: 'critical',
        type: 'connection',
        message: 'Database connection lost',
        details: { responseTime: metrics.connection.responseTime },
        timestamp: new Date().toISOString(),
        resolved: false
      })
    } else if (metrics.connection.responseTime > 5000) {
      newAlerts.push({
        id: `connection-slow-${Date.now()}`,
        severity: 'high',
        type: 'connection',
        message: `Slow database response time: ${metrics.connection.responseTime}ms`,
        details: { responseTime: metrics.connection.responseTime },
        timestamp: new Date().toISOString(),
        resolved: false
      })
    }

    // Performance alerts
    if (metrics.performance.averageQueryTime > 2000) {
      newAlerts.push({
        id: `performance-${Date.now()}`,
        severity: 'high',
        type: 'performance',
        message: `High average query time: ${metrics.performance.averageQueryTime}ms`,
        details: { averageQueryTime: metrics.performance.averageQueryTime },
        timestamp: new Date().toISOString(),
        resolved: false
      })
    }

    // Storage alerts
    if (metrics.storage.utilizationPercentage > 90) {
      newAlerts.push({
        id: `storage-critical-${Date.now()}`,
        severity: 'critical',
        type: 'storage',
        message: `Critical storage usage: ${metrics.storage.utilizationPercentage.toFixed(1)}%`,
        details: { utilizationPercentage: metrics.storage.utilizationPercentage },
        timestamp: new Date().toISOString(),
        resolved: false
      })
    } else if (metrics.storage.utilizationPercentage > 80) {
      newAlerts.push({
        id: `storage-high-${Date.now()}`,
        severity: 'medium',
        type: 'storage',
        message: `High storage usage: ${metrics.storage.utilizationPercentage.toFixed(1)}%`,
        details: { utilizationPercentage: metrics.storage.utilizationPercentage },
        timestamp: new Date().toISOString(),
        resolved: false
      })
    }

    // Schema alerts
    if (!metrics.schema.isValid) {
      newAlerts.push({
        id: `schema-${Date.now()}`,
        severity: 'critical',
        type: 'schema',
        message: 'Database schema validation failed',
        details: { missingTables: metrics.schema.missingTables, errors: metrics.schema.errors },
        timestamp: new Date().toISOString(),
        resolved: false
      })
    }

    // Add new alerts
    this.alerts.push(...newAlerts)

    // Keep only recent alerts (last 100)
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100)
    }

    // Log new alerts
    for (const alert of newAlerts) {
      console.warn(`🚨 Database Alert [${alert.severity}]: ${alert.message}`)
    }
  }

  /**
   * Get current health metrics
   */
  getCurrentHealth(): DatabaseHealthMetrics | null {
    return this.healthHistory[this.healthHistory.length - 1] || null
  }

  /**
   * Get health history
   */
  getHealthHistory(limit?: number): DatabaseHealthMetrics[] {
    if (limit) {
      return this.healthHistory.slice(-limit)
    }
    return [...this.healthHistory]
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): DatabaseAlert[] {
    return this.alerts.filter(alert => !alert.resolved)
  }

  /**
   * Get all alerts
   */
  getAllAlerts(limit?: number): DatabaseAlert[] {
    if (limit) {
      return this.alerts.slice(-limit)
    }
    return [...this.alerts]
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.resolved = true
      console.log(`✅ Resolved database alert: ${alert.message}`)
      return true
    }
    return false
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus(): {
    isMonitoring: boolean
    uptime: number
    lastCheck: string | null
    checkInterval: number
    healthHistoryCount: number
    activeAlertCount: number
  } {
    const currentHealth = this.getCurrentHealth()
    
    return {
      isMonitoring: this.isMonitoring,
      uptime: Date.now() - this.startTime,
      lastCheck: currentHealth?.lastCheck || null,
      checkInterval: this.config.healthCheckInterval,
      healthHistoryCount: this.healthHistory.length,
      activeAlertCount: this.getActiveAlerts().length
    }
  }
}