/**
 * Performance Monitoring and Cost Tracking for Voice Memory
 * 
 * Tracks processing metrics, API costs, and system performance
 * for optimization and budget management.
 */

import { createServiceClient } from './supabase-server'

export interface ProcessingMetrics {
  noteId: string
  userId: string
  startTime: number
  endTime: number
  totalDuration: number
  fileSize: number
  originalFormat: string
  optimizedFormat: string
  compressionRatio: number
  whisperModel: 'whisper-1' | 'whisper-large'
  wasChunked: boolean
  chunkCount?: number
  fromCache: boolean
  transcriptionTime: number
  analysisTime: number
  optimizationTime: number
  estimatedCost: number
  actualCost?: number
  errorOccurred: boolean
  errorCategory?: string
  qualityScore?: number
}

export interface CostMetrics {
  date: string
  totalCost: number
  whisperCost: number
  gptCost: number
  storageCost: number
  requestCount: number
  averageCostPerRequest: number
  costByModel: Record<string, number>
  errorRate: number
  cacheHitRate: number
}

export interface PerformanceInsights {
  averageProcessingTime: number
  costEfficiency: number
  qualityScore: number
  recommendations: string[]
  optimizationOpportunities: Array<{
    type: 'cost' | 'performance' | 'quality'
    description: string
    potentialSavings: number
    effort: 'low' | 'medium' | 'high'
  }>
}

class PerformanceMonitor {
  private supabase = createServiceClient()
  private metrics: Map<string, ProcessingMetrics> = new Map()
  private dailyCosts: Map<string, CostMetrics> = new Map()
  
  // Cost estimates per API call (based on OpenAI pricing)
  private readonly COST_ESTIMATES = {
    'whisper-1': 0.006, // $0.006 per minute
    'whisper-large': 0.036, // Estimated premium pricing
    'gpt-4-turbo': 0.01, // $0.01 per 1K input tokens (simplified)
    'gpt-3.5-turbo': 0.0015 // $0.0015 per 1K input tokens
  }

  /**
   * Start tracking a processing job
   */
  startTracking(noteId: string, userId: string, fileSize: number, format: string): void {
    const metrics: ProcessingMetrics = {
      noteId,
      userId,
      startTime: Date.now(),
      endTime: 0,
      totalDuration: 0,
      fileSize,
      originalFormat: format,
      optimizedFormat: format,
      compressionRatio: 1.0,
      whisperModel: 'whisper-1',
      wasChunked: false,
      fromCache: false,
      transcriptionTime: 0,
      analysisTime: 0,
      optimizationTime: 0,
      estimatedCost: 0,
      errorOccurred: false
    }

    this.metrics.set(noteId, metrics)
    console.log(`📊 Started tracking processing metrics for note ${noteId}`)
  }

  /**
   * Update metrics during processing
   */
  updateMetrics(noteId: string, updates: Partial<ProcessingMetrics>): void {
    const metrics = this.metrics.get(noteId)
    if (!metrics) {
      console.warn(`No metrics found for note ${noteId}`)
      return
    }

    Object.assign(metrics, updates)
    this.metrics.set(noteId, metrics)
  }

  /**
   * Complete tracking and store metrics
   */
  async completeTracking(
    noteId: string, 
    success: boolean, 
    errorCategory?: string
  ): Promise<void> {
    const metrics = this.metrics.get(noteId)
    if (!metrics) {
      console.warn(`No metrics found for note ${noteId}`)
      return
    }

    metrics.endTime = Date.now()
    metrics.totalDuration = metrics.endTime - metrics.startTime
    metrics.errorOccurred = !success
    metrics.errorCategory = errorCategory

    // Calculate actual cost based on usage
    metrics.actualCost = this.calculateActualCost(metrics)

    console.log(`📊 Processing metrics for note ${noteId}:`, {
      duration: `${metrics.totalDuration}ms`,
      cost: `$${metrics.actualCost?.toFixed(4)}`,
      model: metrics.whisperModel,
      cached: metrics.fromCache,
      chunked: metrics.wasChunked,
      success
    })

    // Store metrics in database
    await this.storeMetrics(metrics)

    // Update daily cost tracking
    this.updateDailyCosts(metrics)

    // Cleanup memory
    setTimeout(() => {
      this.metrics.delete(noteId)
    }, 5 * 60 * 1000) // Keep for 5 minutes for debugging
  }

  /**
   * Calculate actual cost based on usage patterns
   */
  private calculateActualCost(metrics: ProcessingMetrics): number {
    let cost = 0

    // Whisper API cost (per minute of audio)
    if (!metrics.fromCache) {
      const audioMinutes = Math.max(1, metrics.totalDuration / 60000) // Convert ms to minutes
      const whisperCost = this.COST_ESTIMATES[metrics.whisperModel]
      cost += audioMinutes * whisperCost

      // Add chunk processing overhead if applicable
      if (metrics.wasChunked && metrics.chunkCount) {
        cost *= 1.1 // 10% overhead for chunk processing
      }
    }

    // GPT analysis cost (estimated based on content length)
    const analysisTokens = Math.max(100, metrics.totalDuration / 100) // Rough estimate
    cost += (analysisTokens / 1000) * this.COST_ESTIMATES['gpt-4-turbo']

    return cost
  }

  /**
   * Store metrics in database for long-term analysis
   */
  private async storeMetrics(metrics: ProcessingMetrics): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('processing_metrics')
        .insert({
          note_id: metrics.noteId,
          user_id: metrics.userId,
          start_time: new Date(metrics.startTime).toISOString(),
          end_time: new Date(metrics.endTime).toISOString(),
          total_duration_ms: metrics.totalDuration,
          file_size_bytes: metrics.fileSize,
          original_format: metrics.originalFormat,
          optimized_format: metrics.optimizedFormat,
          compression_ratio: metrics.compressionRatio,
          whisper_model: metrics.whisperModel,
          was_chunked: metrics.wasChunked,
          chunk_count: metrics.chunkCount,
          from_cache: metrics.fromCache,
          transcription_time_ms: metrics.transcriptionTime,
          analysis_time_ms: metrics.analysisTime,
          optimization_time_ms: metrics.optimizationTime,
          estimated_cost: metrics.estimatedCost,
          actual_cost: metrics.actualCost,
          error_occurred: metrics.errorOccurred,
          error_category: metrics.errorCategory,
          quality_score: metrics.qualityScore,
          created_at: new Date().toISOString()
        })

      if (error) {
        console.warn('Failed to store processing metrics:', error)
      }
    } catch (error) {
      console.warn('Error storing processing metrics:', error)
    }
  }

  /**
   * Update daily cost tracking
   */
  private updateDailyCosts(metrics: ProcessingMetrics): void {
    const date = new Date(metrics.startTime).toISOString().split('T')[0]
    const existing = this.dailyCosts.get(date) || {
      date,
      totalCost: 0,
      whisperCost: 0,
      gptCost: 0,
      storageCost: 0,
      requestCount: 0,
      averageCostPerRequest: 0,
      costByModel: {},
      errorRate: 0,
      cacheHitRate: 0
    }

    existing.totalCost += metrics.actualCost || 0
    existing.requestCount += 1
    existing.averageCostPerRequest = existing.totalCost / existing.requestCount

    // Update model-specific costs
    const modelCost = metrics.actualCost || 0
    existing.costByModel[metrics.whisperModel] = 
      (existing.costByModel[metrics.whisperModel] || 0) + modelCost

    // Update cache hit rate
    const cacheHits = Array.from(this.dailyCosts.values())
      .reduce((sum, day) => sum + (day.cacheHitRate * day.requestCount), 0)
    const totalRequests = Array.from(this.dailyCosts.values())
      .reduce((sum, day) => sum + day.requestCount, 0)
    
    existing.cacheHitRate = metrics.fromCache ? 
      (cacheHits + 1) / (totalRequests + 1) : 
      cacheHits / (totalRequests + 1)

    this.dailyCosts.set(date, existing)
  }

  /**
   * Get performance insights and recommendations
   */
  async getPerformanceInsights(userId?: string, days: number = 7): Promise<PerformanceInsights> {
    try {
      // Get metrics from database
      let query = this.supabase
        .from('processing_metrics')
        .select('*')
        .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })

      if (userId) {
        query = query.eq('user_id', userId)
      }

      const { data: metrics, error } = await query

      if (error || !metrics?.length) {
        return {
          averageProcessingTime: 0,
          costEfficiency: 0,
          qualityScore: 0,
          recommendations: ['Insufficient data for analysis'],
          optimizationOpportunities: []
        }
      }

      // Calculate insights
      const avgProcessingTime = metrics.reduce((sum, m) => sum + m.total_duration_ms, 0) / metrics.length
      const totalCost = metrics.reduce((sum, m) => sum + (m.actual_cost || 0), 0)
      const totalRequests = metrics.length
      const errorRate = metrics.filter(m => m.error_occurred).length / totalRequests
      const cacheHitRate = metrics.filter(m => m.from_cache).length / totalRequests
      const avgFileSize = metrics.reduce((sum, m) => sum + m.file_size_bytes, 0) / totalRequests

      // Calculate cost efficiency (lower is better)
      const costEfficiency = totalCost / totalRequests

      // Calculate quality score (higher is better)
      const qualityScore = Math.max(0, 100 - (errorRate * 50) + (cacheHitRate * 20))

      // Generate recommendations
      const recommendations: string[] = []
      const optimizationOpportunities: PerformanceInsights['optimizationOpportunities'] = []

      if (errorRate > 0.1) {
        recommendations.push(`High error rate (${(errorRate * 100).toFixed(1)}%) - review file formats and sizes`)
        optimizationOpportunities.push({
          type: 'quality',
          description: 'Improve error handling and file validation',
          potentialSavings: totalCost * errorRate * 0.5,
          effort: 'medium'
        })
      }

      if (cacheHitRate < 0.2) {
        recommendations.push('Low cache hit rate - consider implementing smarter caching')
        optimizationOpportunities.push({
          type: 'cost',
          description: 'Implement content-based caching',
          potentialSavings: totalCost * 0.3,
          effort: 'medium'
        })
      }

      if (avgFileSize > 15 * 1024 * 1024) {
        recommendations.push('Large average file size - enable audio compression')
        optimizationOpportunities.push({
          type: 'performance',
          description: 'Implement audio preprocessing and compression',
          potentialSavings: totalCost * 0.15,
          effort: 'high'
        })
      }

      const chunkedFiles = metrics.filter(m => m.was_chunked).length
      if (chunkedFiles / totalRequests > 0.3) {
        recommendations.push('High chunking rate - consider optimizing chunk sizes')
        optimizationOpportunities.push({
          type: 'performance',
          description: 'Optimize chunking strategy',
          potentialSavings: avgProcessingTime * 0.2,
          effort: 'low'
        })
      }

      return {
        averageProcessingTime,
        costEfficiency,
        qualityScore,
        recommendations,
        optimizationOpportunities
      }

    } catch (error) {
      console.error('Error generating performance insights:', error)
      return {
        averageProcessingTime: 0,
        costEfficiency: 0,
        qualityScore: 0,
        recommendations: ['Error generating insights'],
        optimizationOpportunities: []
      }
    }
  }

  /**
   * Get cost summary for a specific date range
   */
  async getCostSummary(userId?: string, days: number = 30): Promise<{
    totalCost: number
    dailyAverage: number
    modelBreakdown: Record<string, number>
    projectedMonthlyCost: number
    costTrend: 'increasing' | 'decreasing' | 'stable'
  }> {
    try {
      let query = this.supabase
        .from('processing_metrics')
        .select('actual_cost, whisper_model, created_at')
        .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())

      if (userId) {
        query = query.eq('user_id', userId)
      }

      const { data: metrics, error } = await query

      if (error || !metrics?.length) {
        return {
          totalCost: 0,
          dailyAverage: 0,
          modelBreakdown: {},
          projectedMonthlyCost: 0,
          costTrend: 'stable'
        }
      }

      const totalCost = metrics.reduce((sum, m) => sum + (m.actual_cost || 0), 0)
      const dailyAverage = totalCost / days
      const projectedMonthlyCost = dailyAverage * 30

      // Model breakdown
      const modelBreakdown: Record<string, number> = {}
      metrics.forEach(m => {
        const model = m.whisper_model
        modelBreakdown[model] = (modelBreakdown[model] || 0) + (m.actual_cost || 0)
      })

      // Cost trend analysis (simplified)
      const midPoint = Math.floor(metrics.length / 2)
      const firstHalf = metrics.slice(0, midPoint)
      const secondHalf = metrics.slice(midPoint)

      const firstHalfAvg = firstHalf.reduce((sum, m) => sum + (m.actual_cost || 0), 0) / firstHalf.length
      const secondHalfAvg = secondHalf.reduce((sum, m) => sum + (m.actual_cost || 0), 0) / secondHalf.length

      let costTrend: 'increasing' | 'decreasing' | 'stable' = 'stable'
      const trendThreshold = 0.1 // 10% change threshold

      if (secondHalfAvg > firstHalfAvg * (1 + trendThreshold)) {
        costTrend = 'increasing'
      } else if (secondHalfAvg < firstHalfAvg * (1 - trendThreshold)) {
        costTrend = 'decreasing'
      }

      return {
        totalCost,
        dailyAverage,
        modelBreakdown,
        projectedMonthlyCost,
        costTrend
      }

    } catch (error) {
      console.error('Error generating cost summary:', error)
      return {
        totalCost: 0,
        dailyAverage: 0,
        modelBreakdown: {},
        projectedMonthlyCost: 0,
        costTrend: 'stable'
      }
    }
  }

  /**
   * Get real-time processing status
   */
  getCurrentProcessingStatus(): {
    activeJobs: number
    averageQueueTime: number
    systemLoad: 'low' | 'medium' | 'high'
    recentErrors: Array<{ noteId: string; error: string; timestamp: number }>
  } {
    const activeJobs = this.metrics.size
    const recentMetrics = Array.from(this.metrics.values())
      .filter(m => Date.now() - m.startTime < 5 * 60 * 1000) // Last 5 minutes

    const averageQueueTime = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, m) => sum + (Date.now() - m.startTime), 0) / recentMetrics.length
      : 0

    let systemLoad: 'low' | 'medium' | 'high' = 'low'
    if (activeJobs > 10) systemLoad = 'high'
    else if (activeJobs > 5) systemLoad = 'medium'

    const recentErrors = recentMetrics
      .filter(m => m.errorOccurred)
      .map(m => ({
        noteId: m.noteId,
        error: m.errorCategory || 'Unknown error',
        timestamp: m.startTime
      }))
      .slice(-5) // Last 5 errors

    return {
      activeJobs,
      averageQueueTime,
      systemLoad,
      recentErrors
    }
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor()

// Export types for use in other modules
export type { ProcessingMetrics, CostMetrics, PerformanceInsights }