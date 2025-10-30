/**
 * Metrics Collector Service - Handles processing performance metrics and monitoring
 */

import { MetricsCollector, ProcessingMetrics, ProcessingStage } from './interfaces'

export class MetricsCollectorService implements MetricsCollector {
  private processingMetrics = new Map<string, ProcessingMetrics>()
  private summaryMetrics = {
    totalProcessed: 0,
    totalSuccessful: 0,
    totalFailed: 0,
    averageProcessingTime: 0,
    errorCategoryBreakdown: new Map<string, number>(),
    lastResetTime: Date.now()
  }

  recordProcessingStart(noteId: string): ProcessingMetrics {
    const metrics: ProcessingMetrics = {
      startTime: Date.now(),
      attempts: 0,
      processingStage: 'initialization'
    }

    this.processingMetrics.set(noteId, metrics)
    console.log(`📊 Started tracking metrics for note ${noteId}`)
    
    return metrics
  }

  recordProcessingComplete(noteId: string, success: boolean, result?: any): void {
    const metrics = this.processingMetrics.get(noteId)
    if (!metrics) {
      console.warn(`No metrics found for note ${noteId}`)
      return
    }

    metrics.endTime = Date.now()
    metrics.totalTime = metrics.endTime - metrics.startTime
    metrics.processingStage = success ? 'completed' : 'failed'

    // Log comprehensive processing metrics
    console.log(`📊 Processing metrics for note ${noteId}:`, {
      totalTime: metrics.totalTime,
      transcriptionTime: metrics.transcriptionTime,
      analysisTime: metrics.analysisTime,
      attempts: metrics.attempts,
      success,
      errorCategory: metrics.errorCategory,
      processingStage: metrics.processingStage
    })

    // Update summary metrics
    this.updateSummaryMetrics(noteId, metrics, success)

    // Clean up metrics after a delay to allow for monitoring
    setTimeout(() => {
      this.processingMetrics.delete(noteId)
    }, 5 * 60 * 1000) // Keep for 5 minutes
  }

  recordProcessingStage(noteId: string, stage: ProcessingStage, duration?: number): void {
    const metrics = this.processingMetrics.get(noteId)
    if (!metrics) {
      console.warn(`No metrics found for note ${noteId}`)
      return
    }

    metrics.processingStage = stage

    // Record stage-specific timing
    if (duration !== undefined) {
      switch (stage) {
        case 'transcription':
          metrics.transcriptionTime = duration
          break
        case 'analysis':
          metrics.analysisTime = duration
          break
      }
    }

    console.log(`📊 Note ${noteId} entered stage: ${stage}${duration ? ` (${duration}ms)` : ''}`)
  }

  recordError(noteId: string, error: string, category: string): void {
    const metrics = this.processingMetrics.get(noteId)
    if (metrics) {
      metrics.errorCategory = category
    }

    // Update error category breakdown
    const current = this.summaryMetrics.errorCategoryBreakdown.get(category) || 0
    this.summaryMetrics.errorCategoryBreakdown.set(category, current + 1)

    console.log(`📊 Recorded error for note ${noteId}: ${category} - ${error}`)
  }

  getMetrics(noteId: string): ProcessingMetrics | undefined {
    return this.processingMetrics.get(noteId)
  }

  getSummaryMetrics(): any {
    const errorBreakdown = Object.fromEntries(this.summaryMetrics.errorCategoryBreakdown)
    const successRate = this.summaryMetrics.totalProcessed > 0 
      ? (this.summaryMetrics.totalSuccessful / this.summaryMetrics.totalProcessed) * 100 
      : 0
    
    return {
      ...this.summaryMetrics,
      errorCategoryBreakdown: errorBreakdown,
      successRate,
      currentlyProcessing: this.processingMetrics.size,
      uptime: Date.now() - this.summaryMetrics.lastResetTime
    }
  }

  getAllActiveMetrics(): Map<string, ProcessingMetrics> {
    return new Map(this.processingMetrics)
  }

  getStuckProcessing(timeoutMinutes: number = 30): string[] {
    const stuckThreshold = timeoutMinutes * 60 * 1000
    const now = Date.now()
    
    return Array.from(this.processingMetrics.entries())
      .filter(([_, metrics]) => (now - metrics.startTime) > stuckThreshold)
      .map(([noteId]) => noteId)
  }

  private updateSummaryMetrics(noteId: string, metrics: ProcessingMetrics, success: boolean): void {
    // Update summary metrics for monitoring dashboard
    this.summaryMetrics.totalProcessed++
    
    if (success) {
      this.summaryMetrics.totalSuccessful++
    } else {
      this.summaryMetrics.totalFailed++
      
      // Track error category distribution
      if (metrics.errorCategory) {
        const current = this.summaryMetrics.errorCategoryBreakdown.get(metrics.errorCategory) || 0
        this.summaryMetrics.errorCategoryBreakdown.set(metrics.errorCategory, current + 1)
      }
    }
    
    // Update rolling average processing time
    if (metrics.totalTime) {
      const currentAvg = this.summaryMetrics.averageProcessingTime
      const totalProcessed = this.summaryMetrics.totalProcessed
      this.summaryMetrics.averageProcessingTime = 
        ((currentAvg * (totalProcessed - 1)) + metrics.totalTime) / totalProcessed
    }
    
    // Store detailed metrics for monitoring
    const metricData = {
      noteId,
      success,
      totalTime: metrics.totalTime,
      transcriptionTime: metrics.transcriptionTime,
      analysisTime: metrics.analysisTime,
      attempts: metrics.attempts,
      errorCategory: metrics.errorCategory,
      processingStage: metrics.processingStage,
      timestamp: new Date().toISOString()
    }

    // Log metrics (could be sent to monitoring service like DataDog, New Relic, etc.)
    console.log('📊 Processing metric collected:', metricData)
    
    // Reset summary metrics every hour to prevent memory growth
    const hoursSinceReset = (Date.now() - this.summaryMetrics.lastResetTime) / (1000 * 60 * 60)
    if (hoursSinceReset >= 1) {
      this.resetSummaryMetrics()
    }
  }

  private resetSummaryMetrics(): void {
    console.log('🔄 Resetting summary metrics after 1 hour')
    this.summaryMetrics = {
      totalProcessed: 0,
      totalSuccessful: 0,
      totalFailed: 0,
      averageProcessingTime: 0,
      errorCategoryBreakdown: new Map<string, number>(),
      lastResetTime: Date.now()
    }
  }

  // Performance monitoring methods
  recordBatchMetrics(batchSize: number, processed: number, failed: number, totalTime: number): void {
    const successRate = batchSize > 0 ? (processed / batchSize) * 100 : 0
    const averageTime = processed > 0 ? totalTime / processed : 0

    console.log('📊 Batch processing metrics:', {
      batchSize,
      processed,
      failed,
      successRate: successRate.toFixed(1) + '%',
      totalTime,
      averageProcessingTime: Math.round(averageTime) + 'ms'
    })
  }

  exportMetricsForMonitoring(): any {
    const summary = this.getSummaryMetrics()
    const activeProcessing = Array.from(this.processingMetrics.entries()).map(([noteId, metrics]) => ({
      noteId,
      stage: metrics.processingStage,
      elapsedTime: Date.now() - metrics.startTime,
      attempts: metrics.attempts
    }))

    return {
      summary,
      activeProcessing,
      timestamp: new Date().toISOString()
    }
  }

  // Health check support
  isHealthy(): boolean {
    const summary = this.getSummaryMetrics()
    const stuckCount = this.getStuckProcessing(30).length
    
    // Unhealthy if success rate is very low
    if (summary.successRate < 50 && summary.totalProcessed > 10) {
      return false
    }
    
    // Unhealthy if too many stuck processes
    if (stuckCount > 5) {
      return false
    }
    
    return true
  }
}