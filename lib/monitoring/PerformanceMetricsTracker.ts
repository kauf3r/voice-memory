/**
 * Performance Metrics Tracker - Advanced processing performance monitoring and analysis
 */

import { ProcessingMetrics, ProcessingStage } from '../processing/interfaces'
import { getSection } from '../config/index'

export interface DetailedProcessingMetrics extends ProcessingMetrics {
  noteId: string
  userId: string
  audioFileSize?: number
  audioMimeType?: string
  audioDuration?: number
  transcriptionLength?: number
  analysisComplexity?: number
  queueWaitTime?: number
  lockAcquisitionTime?: number
  memoryUsageStart?: number
  memoryUsageEnd?: number
  cpuTimeStart?: number
  cpuTimeEnd?: number
}

export interface PerformanceAnalytics {
  summary: {
    totalProcessed: number
    averageProcessingTime: number
    medianProcessingTime: number
    p95ProcessingTime: number
    p99ProcessingTime: number
    throughputPerHour: number
    successRate: number
    errorRate: number
  }
  stages: {
    [K in ProcessingStage]: {
      averageTime: number
      medianTime: number
      p95Time: number
      successRate: number
      errorCount: number
    }
  }
  trends: {
    hourly: Array<{
      hour: string
      processed: number
      averageTime: number
      successRate: number
      errors: number
    }>
    daily: Array<{
      date: string
      processed: number
      averageTime: number
      successRate: number
      errors: number
    }>
  }
  fileTypes: {
    [mimeType: string]: {
      count: number
      averageProcessingTime: number
      successRate: number
      averageFileSize: number
    }
  }
  users: {
    [userId: string]: {
      totalProcessed: number
      averageProcessingTime: number
      successRate: number
      lastActivity: string
    }
  }
  bottlenecks: Array<{
    stage: ProcessingStage
    description: string
    impact: 'low' | 'medium' | 'high' | 'critical'
    recommendation: string
    affectedNotes: number
  }>
  anomalies: Array<{
    type: 'slow_processing' | 'high_error_rate' | 'memory_spike' | 'timeout_cluster'
    description: string
    timestamp: string
    details: any
  }>
}

export interface PerformanceAlert {
  id: string
  type: 'performance_degradation' | 'high_error_rate' | 'resource_exhaustion' | 'bottleneck_detected'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  details: any
  timestamp: string
  resolved: boolean
  recommendations: string[]
}

export class PerformanceMetricsTracker {
  private metrics: Map<string, DetailedProcessingMetrics> = new Map()
  private historicalMetrics: DetailedProcessingMetrics[] = []
  private config: ReturnType<typeof getSection<'monitoring'>>
  private alerts: PerformanceAlert[] = []
  private startTime = Date.now()

  constructor() {
    this.config = getSection('monitoring')
  }

  /**
   * Start tracking a processing operation
   */
  startTracking(noteId: string, userId: string, additionalData?: {
    audioFileSize?: number
    audioMimeType?: string
    audioDuration?: number
    queueWaitTime?: number
  }): DetailedProcessingMetrics {
    const processMetrics = {
      user: process.cpuUsage(),
      memory: process.memoryUsage()
    }

    const metrics: DetailedProcessingMetrics = {
      noteId,
      userId,
      startTime: Date.now(),
      attempts: 0,
      processingStage: 'initialization',
      audioFileSize: additionalData?.audioFileSize,
      audioMimeType: additionalData?.audioMimeType,
      audioDuration: additionalData?.audioDuration,
      queueWaitTime: additionalData?.queueWaitTime,
      memoryUsageStart: processMetrics.memory.heapUsed,
      cpuTimeStart: processMetrics.user.user
    }

    this.metrics.set(noteId, metrics)
    console.log(`📊 Started performance tracking for note ${noteId}`)
    
    return metrics
  }

  /**
   * Update stage timing and metrics
   */
  updateStageMetrics(noteId: string, stage: ProcessingStage, stageData?: {
    lockAcquisitionTime?: number
    transcriptionLength?: number
    analysisComplexity?: number
  }): void {
    const metrics = this.metrics.get(noteId)
    if (!metrics) {
      console.warn(`No metrics found for note ${noteId}`)
      return
    }

    const now = Date.now()
    const stageStartTime = metrics.endTime || metrics.startTime

    // Update stage-specific timing
    switch (stage) {
      case 'lock_acquisition':
        metrics.lockAcquisitionTime = stageData?.lockAcquisitionTime || (now - stageStartTime)
        break
      case 'transcription':
        metrics.transcriptionTime = now - stageStartTime
        metrics.transcriptionLength = stageData?.transcriptionLength
        break
      case 'analysis':
        metrics.analysisTime = now - stageStartTime
        metrics.analysisComplexity = stageData?.analysisComplexity
        break
    }

    metrics.processingStage = stage
    console.log(`📊 Note ${noteId} entered stage: ${stage}`)
  }

  /**
   * Complete tracking and record final metrics
   */
  completeTracking(noteId: string, success: boolean, errorCategory?: string): DetailedProcessingMetrics | null {
    const metrics = this.metrics.get(noteId)
    if (!metrics) {
      console.warn(`No metrics found for note ${noteId}`)
      return null
    }

    const processMetrics = {
      user: process.cpuUsage(),
      memory: process.memoryUsage()
    }

    // Calculate final metrics
    metrics.endTime = Date.now()
    metrics.totalTime = metrics.endTime - metrics.startTime
    metrics.processingStage = success ? 'completed' : 'failed'
    metrics.errorCategory = errorCategory
    metrics.memoryUsageEnd = processMetrics.memory.heapUsed
    metrics.cpuTimeEnd = processMetrics.user.user

    // Add to historical data
    this.historicalMetrics.push({ ...metrics })

    // Clean up active tracking
    this.metrics.delete(noteId)

    // Analyze for performance issues
    this.analyzePerformanceIssues(metrics, success)

    // Clean up old historical data (keep last 1000 records)
    if (this.historicalMetrics.length > 1000) {
      this.historicalMetrics = this.historicalMetrics.slice(-1000)
    }

    console.log(`📊 Completed performance tracking for note ${noteId}: ${success ? 'SUCCESS' : 'FAILED'} (${metrics.totalTime}ms)`)
    
    return metrics
  }

  /**
   * Get comprehensive performance analytics
   */
  getPerformanceAnalytics(): PerformanceAnalytics {
    console.log('📊 Generating performance analytics...')

    if (this.historicalMetrics.length === 0) {
      return this.getEmptyAnalytics()
    }

    const successfulMetrics = this.historicalMetrics.filter(m => m.processingStage === 'completed')
    const failedMetrics = this.historicalMetrics.filter(m => m.processingStage === 'failed')

    return {
      summary: this.calculateSummaryMetrics(successfulMetrics, failedMetrics),
      stages: this.calculateStageMetrics(successfulMetrics),
      trends: this.calculateTrends(),
      fileTypes: this.calculateFileTypeMetrics(successfulMetrics),
      users: this.calculateUserMetrics(),
      bottlenecks: this.identifyBottlenecks(successfulMetrics),
      anomalies: this.detectAnomalies()
    }
  }

  /**
   * Calculate summary performance metrics
   */
  private calculateSummaryMetrics(
    successfulMetrics: DetailedProcessingMetrics[],
    failedMetrics: DetailedProcessingMetrics[]
  ): PerformanceAnalytics['summary'] {
    const totalProcessed = this.historicalMetrics.length
    const totalSuccessful = successfulMetrics.length
    
    if (totalProcessed === 0) {
      return {
        totalProcessed: 0,
        averageProcessingTime: 0,
        medianProcessingTime: 0,
        p95ProcessingTime: 0,
        p99ProcessingTime: 0,
        throughputPerHour: 0,
        successRate: 0,
        errorRate: 0
      }
    }

    const processingTimes = successfulMetrics.map(m => m.totalTime || 0).sort((a, b) => a - b)
    const averageTime = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
    const medianTime = processingTimes[Math.floor(processingTimes.length / 2)] || 0
    const p95Time = processingTimes[Math.floor(processingTimes.length * 0.95)] || 0
    const p99Time = processingTimes[Math.floor(processingTimes.length * 0.99)] || 0

    // Calculate throughput (notes per hour)
    const timespanHours = (Date.now() - this.startTime) / (1000 * 60 * 60)
    const throughputPerHour = timespanHours > 0 ? totalProcessed / timespanHours : 0

    return {
      totalProcessed,
      averageProcessingTime: averageTime,
      medianProcessingTime: medianTime,
      p95ProcessingTime: p95Time,
      p99ProcessingTime: p99Time,
      throughputPerHour,
      successRate: (totalSuccessful / totalProcessed) * 100,
      errorRate: (failedMetrics.length / totalProcessed) * 100
    }
  }

  /**
   * Calculate per-stage performance metrics
   */
  private calculateStageMetrics(successfulMetrics: DetailedProcessingMetrics[]): PerformanceAnalytics['stages'] {
    const stages: ProcessingStage[] = ['initialization', 'lock_acquisition', 'transcription', 'analysis', 'saving', 'completed', 'failed']
    const stageMetrics = {} as PerformanceAnalytics['stages']

    for (const stage of stages) {
      const stageData = this.getStageTimingData(successfulMetrics, stage)
      const times = stageData.filter(t => t > 0).sort((a, b) => a - b)
      
      stageMetrics[stage] = {
        averageTime: times.length > 0 ? times.reduce((sum, time) => sum + time, 0) / times.length : 0,
        medianTime: times[Math.floor(times.length / 2)] || 0,
        p95Time: times[Math.floor(times.length * 0.95)] || 0,
        successRate: 100, // For successful metrics, all stages succeeded
        errorCount: 0
      }
    }

    return stageMetrics
  }

  /**
   * Get timing data for a specific stage
   */
  private getStageTimingData(metrics: DetailedProcessingMetrics[], stage: ProcessingStage): number[] {
    switch (stage) {
      case 'transcription':
        return metrics.map(m => m.transcriptionTime || 0)
      case 'analysis':
        return metrics.map(m => m.analysisTime || 0)
      case 'lock_acquisition':
        return metrics.map(m => m.lockAcquisitionTime || 0)
      default:
        return []
    }
  }

  /**
   * Calculate hourly and daily trends
   */
  private calculateTrends(): PerformanceAnalytics['trends'] {
    const hourlyData = new Map<string, { processed: number; totalTime: number; errors: number }>()
    const dailyData = new Map<string, { processed: number; totalTime: number; errors: number }>()

    for (const metric of this.historicalMetrics) {
      const date = new Date(metric.startTime)
      const hourKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}`
      const dayKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`

      // Hourly data
      if (!hourlyData.has(hourKey)) {
        hourlyData.set(hourKey, { processed: 0, totalTime: 0, errors: 0 })
      }
      const hourData = hourlyData.get(hourKey)!
      hourData.processed++
      hourData.totalTime += metric.totalTime || 0
      if (metric.processingStage === 'failed') hourData.errors++

      // Daily data
      if (!dailyData.has(dayKey)) {
        dailyData.set(dayKey, { processed: 0, totalTime: 0, errors: 0 })
      }
      const dayData = dailyData.get(dayKey)!
      dayData.processed++
      dayData.totalTime += metric.totalTime || 0
      if (metric.processingStage === 'failed') dayData.errors++
    }

    const hourly = Array.from(hourlyData.entries()).map(([hour, data]) => ({
      hour,
      processed: data.processed,
      averageTime: data.processed > 0 ? data.totalTime / data.processed : 0,
      successRate: data.processed > 0 ? ((data.processed - data.errors) / data.processed) * 100 : 0,
      errors: data.errors
    })).slice(-24) // Last 24 hours

    const daily = Array.from(dailyData.entries()).map(([date, data]) => ({
      date,
      processed: data.processed,
      averageTime: data.processed > 0 ? data.totalTime / data.processed : 0,
      successRate: data.processed > 0 ? ((data.processed - data.errors) / data.processed) * 100 : 0,
      errors: data.errors
    })).slice(-7) // Last 7 days

    return { hourly, daily }
  }

  /**
   * Calculate file type performance metrics
   */
  private calculateFileTypeMetrics(successfulMetrics: DetailedProcessingMetrics[]): PerformanceAnalytics['fileTypes'] {
    const fileTypeData = new Map<string, { times: number[]; sizes: number[] }>()

    for (const metric of successfulMetrics) {
      if (metric.audioMimeType) {
        if (!fileTypeData.has(metric.audioMimeType)) {
          fileTypeData.set(metric.audioMimeType, { times: [], sizes: [] })
        }
        const data = fileTypeData.get(metric.audioMimeType)!
        data.times.push(metric.totalTime || 0)
        if (metric.audioFileSize) data.sizes.push(metric.audioFileSize)
      }
    }

    const result: PerformanceAnalytics['fileTypes'] = {}
    for (const [mimeType, data] of fileTypeData.entries()) {
      result[mimeType] = {
        count: data.times.length,
        averageProcessingTime: data.times.reduce((sum, time) => sum + time, 0) / data.times.length,
        successRate: 100, // These are all successful metrics
        averageFileSize: data.sizes.length > 0 ? data.sizes.reduce((sum, size) => sum + size, 0) / data.sizes.length : 0
      }
    }

    return result
  }

  /**
   * Calculate user-specific metrics
   */
  private calculateUserMetrics(): PerformanceAnalytics['users'] {
    const userData = new Map<string, { times: number[]; successes: number; total: number; lastActivity: number }>()

    for (const metric of this.historicalMetrics) {
      if (!userData.has(metric.userId)) {
        userData.set(metric.userId, { times: [], successes: 0, total: 0, lastActivity: 0 })
      }
      const data = userData.get(metric.userId)!
      data.total++
      data.lastActivity = Math.max(data.lastActivity, metric.startTime)
      if (metric.processingStage === 'completed') {
        data.successes++
        data.times.push(metric.totalTime || 0)
      }
    }

    const result: PerformanceAnalytics['users'] = {}
    for (const [userId, data] of userData.entries()) {
      result[userId] = {
        totalProcessed: data.total,
        averageProcessingTime: data.times.length > 0 ? data.times.reduce((sum, time) => sum + time, 0) / data.times.length : 0,
        successRate: data.total > 0 ? (data.successes / data.total) * 100 : 0,
        lastActivity: new Date(data.lastActivity).toISOString()
      }
    }

    return result
  }

  /**
   * Identify performance bottlenecks
   */
  private identifyBottlenecks(successfulMetrics: DetailedProcessingMetrics[]): PerformanceAnalytics['bottlenecks'] {
    const bottlenecks: PerformanceAnalytics['bottlenecks'] = []

    if (successfulMetrics.length < 10) {
      return bottlenecks // Need sufficient data
    }

    // Analyze transcription bottlenecks
    const transcriptionTimes = successfulMetrics.map(m => m.transcriptionTime || 0).filter(t => t > 0)
    const avgTranscriptionTime = transcriptionTimes.reduce((sum, time) => sum + time, 0) / transcriptionTimes.length
    const slowTranscriptions = transcriptionTimes.filter(t => t > avgTranscriptionTime * 2).length

    if (slowTranscriptions / transcriptionTimes.length > 0.2) {
      bottlenecks.push({
        stage: 'transcription',
        description: `${((slowTranscriptions / transcriptionTimes.length) * 100).toFixed(1)}% of transcriptions are taking >2x average time`,
        impact: slowTranscriptions / transcriptionTimes.length > 0.5 ? 'critical' : 'high',
        recommendation: 'Consider optimizing audio preprocessing or using smaller batch sizes',
        affectedNotes: slowTranscriptions
      })
    }

    // Analyze analysis bottlenecks
    const analysisTimes = successfulMetrics.map(m => m.analysisTime || 0).filter(t => t > 0)
    const avgAnalysisTime = analysisTimes.reduce((sum, time) => sum + time, 0) / analysisTimes.length
    const slowAnalyses = analysisTimes.filter(t => t > avgAnalysisTime * 2).length

    if (slowAnalyses / analysisTimes.length > 0.2) {
      bottlenecks.push({
        stage: 'analysis',
        description: `${((slowAnalyses / analysisTimes.length) * 100).toFixed(1)}% of analyses are taking >2x average time`,
        impact: slowAnalyses / analysisTimes.length > 0.5 ? 'critical' : 'high',
        recommendation: 'Consider reducing analysis complexity or implementing caching',
        affectedNotes: slowAnalyses
      })
    }

    return bottlenecks
  }

  /**
   * Detect performance anomalies
   */
  private detectAnomalies(): PerformanceAnalytics['anomalies'] {
    const anomalies: PerformanceAnalytics['anomalies'] = []
    
    if (this.historicalMetrics.length < 20) {
      return anomalies // Need sufficient data
    }

    // Recent metrics for anomaly detection
    const recentMetrics = this.historicalMetrics.slice(-20)
    const recentSuccessful = recentMetrics.filter(m => m.processingStage === 'completed')
    
    // Detect slow processing anomaly
    if (recentSuccessful.length > 0) {
      const recentAvgTime = recentSuccessful.reduce((sum, m) => sum + (m.totalTime || 0), 0) / recentSuccessful.length
      const historicalAvgTime = this.historicalMetrics
        .filter(m => m.processingStage === 'completed')
        .reduce((sum, m) => sum + (m.totalTime || 0), 0) / this.historicalMetrics.filter(m => m.processingStage === 'completed').length

      if (recentAvgTime > historicalAvgTime * 1.5) {
        anomalies.push({
          type: 'slow_processing',
          description: `Recent processing times are ${((recentAvgTime / historicalAvgTime) * 100).toFixed(1)}% above historical average`,
          timestamp: new Date().toISOString(),
          details: { recentAvgTime, historicalAvgTime }
        })
      }
    }

    // Detect high error rate anomaly
    const recentErrorRate = (recentMetrics.filter(m => m.processingStage === 'failed').length / recentMetrics.length) * 100
    const historicalErrorRate = (this.historicalMetrics.filter(m => m.processingStage === 'failed').length / this.historicalMetrics.length) * 100

    if (recentErrorRate > historicalErrorRate * 2 && recentErrorRate > 10) {
      anomalies.push({
        type: 'high_error_rate',
        description: `Recent error rate (${recentErrorRate.toFixed(1)}%) is significantly above normal`,
        timestamp: new Date().toISOString(),
        details: { recentErrorRate, historicalErrorRate }
      })
    }

    return anomalies
  }

  /**
   * Analyze individual performance issues
   */
  private analyzePerformanceIssues(metrics: DetailedProcessingMetrics, success: boolean): void {
    if (!success) return // Only analyze successful operations for performance

    const totalTime = metrics.totalTime || 0
    
    // Generate alerts for performance issues
    if (totalTime > 300000) { // 5 minutes
      this.generatePerformanceAlert('performance_degradation', 'high', 
        `Note ${metrics.noteId} took ${Math.round(totalTime / 1000)}s to process`,
        { noteId: metrics.noteId, totalTime, stage: metrics.processingStage },
        ['Check system resources', 'Consider batch size reduction', 'Monitor external API performance']
      )
    }

    if (metrics.transcriptionTime && metrics.transcriptionTime > 180000) { // 3 minutes
      this.generatePerformanceAlert('bottleneck_detected', 'medium',
        `Transcription stage took ${Math.round(metrics.transcriptionTime / 1000)}s for note ${metrics.noteId}`,
        { noteId: metrics.noteId, transcriptionTime: metrics.transcriptionTime },
        ['Check audio file quality', 'Monitor OpenAI API performance', 'Consider audio preprocessing']
      )
    }

    if (metrics.analysisTime && metrics.analysisTime > 120000) { // 2 minutes
      this.generatePerformanceAlert('bottleneck_detected', 'medium',
        `Analysis stage took ${Math.round(metrics.analysisTime / 1000)}s for note ${metrics.noteId}`,
        { noteId: metrics.noteId, analysisTime: metrics.analysisTime },
        ['Review analysis complexity', 'Monitor OpenAI API performance', 'Consider caching strategies']
      )
    }
  }

  /**
   * Generate a performance alert
   */
  private generatePerformanceAlert(
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity'],
    message: string,
    details: any,
    recommendations: string[]
  ): void {
    const alert: PerformanceAlert = {
      id: `perf-${type}-${Date.now()}`,
      type,
      severity,
      message,
      details,
      timestamp: new Date().toISOString(),
      resolved: false,
      recommendations
    }

    this.alerts.push(alert)

    // Keep only recent alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100)
    }

    console.warn(`🚨 Performance Alert [${severity}]: ${message}`)
  }

  /**
   * Get empty analytics structure
   */
  private getEmptyAnalytics(): PerformanceAnalytics {
    return {
      summary: {
        totalProcessed: 0,
        averageProcessingTime: 0,
        medianProcessingTime: 0,
        p95ProcessingTime: 0,
        p99ProcessingTime: 0,
        throughputPerHour: 0,
        successRate: 0,
        errorRate: 0
      },
      stages: {} as PerformanceAnalytics['stages'],
      trends: { hourly: [], daily: [] },
      fileTypes: {},
      users: {},
      bottlenecks: [],
      anomalies: []
    }
  }

  /**
   * Get current performance alerts
   */
  getPerformanceAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => !alert.resolved)
  }

  /**
   * Resolve a performance alert
   */
  resolvePerformanceAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.resolved = true
      console.log(`✅ Resolved performance alert: ${alert.message}`)
      return true
    }
    return false
  }

  /**
   * Get current tracking status
   */
  getTrackingStatus(): {
    activeTracking: number
    totalHistorical: number
    alertCount: number
    uptime: number
  } {
    return {
      activeTracking: this.metrics.size,
      totalHistorical: this.historicalMetrics.length,
      alertCount: this.getPerformanceAlerts().length,
      uptime: Date.now() - this.startTime
    }
  }

  /**
   * Clear old historical data
   */
  clearOldData(retentionHours: number = 24): number {
    const cutoffTime = Date.now() - (retentionHours * 60 * 60 * 1000)
    const initialCount = this.historicalMetrics.length
    
    this.historicalMetrics = this.historicalMetrics.filter(m => m.startTime > cutoffTime)
    
    const removedCount = initialCount - this.historicalMetrics.length
    if (removedCount > 0) {
      console.log(`🗑️ Cleared ${removedCount} old performance metrics (older than ${retentionHours}h)`