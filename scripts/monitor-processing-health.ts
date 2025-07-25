#!/usr/bin/env tsx

/**
 * Processing Health Monitoring Script
 * 
 * This script monitors the health of the Voice Memory processing pipeline
 * and provides automated analysis, alerts, and remediation capabilities.
 */

import dotenv from 'dotenv'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

interface ProcessingHealthMetrics {
  timestamp: string
  stuckNotes: {
    count: number
    notes: Array<{
      id: string
      processingStarted: string
      minutesStuck: number
      attempts: number
    }>
  }
  errorAnalysis: {
    recentErrorRate: number
    errorTrends: {
      last1Hour: number
      last6Hours: number
      last24Hours: number
    }
    errorCategories: Record<string, number>
    topErrors: Array<{
      message: string
      count: number
      category: string
    }>
  }
  performance: {
    averageProcessingTime: number
    successRate: number
    throughput: {
      notesPerHour: number
      notesProcessedToday: number
    }
    queueHealth: {
      pendingCount: number
      processingCount: number
      averageWaitTime: number
    }
  }
  locks: {
    activeCount: number
    abandonedCount: number
    oldestLockAge: number
  }
  openaiHealth: {
    responseTime: number
    availableModels: string[]
    rateLimitStatus: 'healthy' | 'degraded' | 'critical'
  }
  alerts: Array<{
    level: 'warning' | 'error' | 'critical'
    message: string
    recommendation: string
  }>
  overallHealth: 'healthy' | 'degraded' | 'unhealthy' | 'critical'
}

class ProcessingHealthMonitor {
  private supabase: any
  private openai: any
  private readonly timeoutMinutes = parseInt(process.env.PROCESSING_TIMEOUT_MINUTES || '15')
  private readonly alertThresholds = {
    stuckNotesWarning: 3,
    stuckNotesCritical: 10,
    errorRateWarning: 20, // 20%
    errorRateCritical: 50, // 50%
    queueDepthWarning: 50,
    queueDepthCritical: 200,
    lockAgeWarning: 30, // 30 minutes
    lockAgeCritical: 60, // 60 minutes
    responseTimeWarning: 5000, // 5 seconds
    responseTimeCritical: 15000 // 15 seconds
  }

  constructor() {
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY.')
    }
    
    this.supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Initialize OpenAI client
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      })
    }
  }

  async detectStuckNotes(): Promise<ProcessingHealthMetrics['stuckNotes']> {
    const stuckThresholdMs = this.timeoutMinutes * 60 * 1000
    const stuckThreshold = new Date(Date.now() - stuckThresholdMs).toISOString()

    const { data: stuckNotes, error } = await this.supabase
      .from('notes')
      .select('id, processing_started_at, processing_attempts, created_at')
      .not('processing_started_at', 'is', null)
      .is('processed_at', null)
      .lt('processing_started_at', stuckThreshold)
      .order('processing_started_at', { ascending: true })

    if (error) {
      console.error('Error detecting stuck notes:', error)
      return { count: 0, notes: [] }
    }

    const notes = (stuckNotes || []).map((note: any) => {
      const processingStarted = new Date(note.processing_started_at)
      const minutesStuck = Math.floor((Date.now() - processingStarted.getTime()) / (1000 * 60))
      
      return {
        id: note.id,
        processingStarted: note.processing_started_at,
        minutesStuck,
        attempts: note.processing_attempts || 0
      }
    })

    return {
      count: notes.length,
      notes
    }
  }

  async analyzeErrorRates(): Promise<ProcessingHealthMetrics['errorAnalysis']> {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

    // Get recent notes with error information
    const { data: recentNotes, error } = await this.supabase
      .from('notes')
      .select('id, error_message, last_error_at, created_at, processed_at')
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error analyzing error rates:', error)
      return {
        recentErrorRate: 0,
        errorTrends: { last1Hour: 0, last6Hours: 0, last24Hours: 0 },
        errorCategories: {},
        topErrors: []
      }
    }

    const notes = recentNotes || []
    
    // Calculate error rates for different time periods
    const getErrorRate = (timeThreshold: string) => {
      const relevantNotes = notes.filter((note: any) => note.created_at >= timeThreshold)
      const errorNotes = relevantNotes.filter((note: any) => note.error_message)
      return relevantNotes.length > 0 ? (errorNotes.length / relevantNotes.length) * 100 : 0
    }

    const errorTrends = {
      last1Hour: getErrorRate(oneHourAgo),
      last6Hours: getErrorRate(sixHoursAgo),
      last24Hours: getErrorRate(twentyFourHoursAgo)
    }

    // Categorize errors
    const errorCategories: Record<string, number> = {}
    const errorMessages: Record<string, number> = {}
    
    notes.forEach((note: any) => {
      if (note.error_message) {
        const category = this.categorizeError(note.error_message)
        errorCategories[category] = (errorCategories[category] || 0) + 1
        errorMessages[note.error_message] = (errorMessages[note.error_message] || 0) + 1
      }
    })

    // Get top error messages
    const topErrors = Object.entries(errorMessages)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([message, count]) => ({
        message,
        count: count as number,
        category: this.categorizeError(message)
      }))

    return {
      recentErrorRate: errorTrends.last1Hour,
      errorTrends,
      errorCategories,
      topErrors
    }
  }

  async measurePerformanceMetrics(): Promise<ProcessingHealthMetrics['performance']> {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

    // Get processed notes from last hour for throughput calculation
    const { data: recentProcessed, error: recentError } = await this.supabase
      .from('notes')
      .select('id, processed_at, created_at')
      .not('processed_at', 'is', null)
      .gte('processed_at', oneHourAgo)

    // Get notes processed today
    const { data: todayProcessed, error: todayError } = await this.supabase
      .from('notes')
      .select('count(*)')
      .not('processed_at', 'is', null)
      .gte('processed_at', oneDayAgo)

    // Get queue status
    const { data: pendingNotes, error: pendingError } = await this.supabase
      .from('notes')
      .select('count(*)')
      .is('transcription', null)
      .is('error_message', null)
      .is('processing_started_at', null)

    const { data: processingNotes, error: processingError } = await this.supabase
      .from('notes')
      .select('count(*)')
      .not('processing_started_at', 'is', null)
      .is('processed_at', null)

    // Calculate average processing time (from creation to completion)
    const { data: completedNotes, error: completedError } = await this.supabase
      .from('notes')
      .select('created_at, processed_at')
      .not('processed_at', 'is', null)
      .gte('processed_at', oneHourAgo)
      .limit(100)

    let averageProcessingTime = 0
    let successRate = 100

    if (completedNotes && completedNotes.length > 0) {
      const processingTimes = completedNotes.map((note: any) => {
        const created = new Date(note.created_at).getTime()
        const processed = new Date(note.processed_at).getTime()
        return processed - created
      })
      
      averageProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
    }

    // Calculate success rate (processed vs total in last hour)
    const { data: allRecentNotes, error: allRecentError } = await this.supabase
      .from('notes')
      .select('id, processed_at, error_message')
      .gte('created_at', oneHourAgo)

    if (allRecentNotes && allRecentNotes.length > 0) {
      const successful = allRecentNotes.filter((note: any) => note.processed_at && !note.error_message).length
      successRate = (successful / allRecentNotes.length) * 100
    }

    // Calculate average wait time (for pending notes)
    const { data: waitingNotes, error: waitingError } = await this.supabase
      .from('notes')
      .select('created_at')
      .is('processing_started_at', null)
      .is('transcription', null)
      .is('error_message', null)
      .limit(50)

    let averageWaitTime = 0
    if (waitingNotes && waitingNotes.length > 0) {
      const waitTimes = waitingNotes.map((note: any) => Date.now() - new Date(note.created_at).getTime())
      averageWaitTime = waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length
    }

    return {
      averageProcessingTime: Math.round(averageProcessingTime / 1000), // Convert to seconds
      successRate: parseFloat(successRate.toFixed(1)),
      throughput: {
        notesPerHour: recentProcessed?.length || 0,
        notesProcessedToday: todayProcessed?.[0]?.count || 0
      },
      queueHealth: {
        pendingCount: pendingNotes?.[0]?.count || 0,
        processingCount: processingNotes?.[0]?.count || 0,
        averageWaitTime: Math.round(averageWaitTime / 1000) // Convert to seconds
      }
    }
  }

  async monitorLocks(): Promise<ProcessingHealthMetrics['locks']> {
    const maxConcurrentProcessing = parseInt(process.env.MAX_CONCURRENT_PROCESSING || '10')
    
    // Get currently active processing locks
    const { data: activeLocks, error: activeError } = await this.supabase
      .from('notes')
      .select('id, processing_started_at')
      .not('processing_started_at', 'is', null)
      .is('processed_at', null)

    if (activeError) {
      console.error('Error monitoring locks:', error)
      return { activeCount: 0, abandonedCount: 0, oldestLockAge: 0 }
    }

    const locks = activeLocks || []
    const now = Date.now()
    
    // Detect abandoned locks (older than timeout + buffer)
    const abandonedThresholdMs = (this.timeoutMinutes + 5) * 60 * 1000
    const abandonedLocks = locks.filter((lock: any) => {
      const lockAge = now - new Date(lock.processing_started_at).getTime()
      return lockAge > abandonedThresholdMs
    })

    // Find oldest lock
    const oldestLockAge = locks.length > 0 
      ? Math.max(...locks.map((lock: any) => now - new Date(lock.processing_started_at).getTime()))
      : 0

    return {
      activeCount: locks.length,
      abandonedCount: abandonedLocks.length,
      oldestLockAge: Math.round(oldestLockAge / (1000 * 60)) // Convert to minutes
    }
  }

  async checkOpenAIHealth(): Promise<ProcessingHealthMetrics['openaiHealth']> {
    if (!this.openai) {
      return {
        responseTime: 0,
        availableModels: [],
        rateLimitStatus: 'critical'
      }
    }

    try {
      const startTime = Date.now()
      const response = await this.openai.models.list()
      const responseTime = Date.now() - startTime
      
      const models = response.data.map((model: any) => model.id)
      
      // Determine rate limit status based on response time
      let rateLimitStatus: 'healthy' | 'degraded' | 'critical' = 'healthy'
      if (responseTime > this.alertThresholds.responseTimeCritical) {
        rateLimitStatus = 'critical'
      } else if (responseTime > this.alertThresholds.responseTimeWarning) {
        rateLimitStatus = 'degraded'
      }

      return {
        responseTime,
        availableModels: models.filter((model: string) => 
          model.includes('whisper') || model.includes('gpt')
        ),
        rateLimitStatus
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      let rateLimitStatus: 'healthy' | 'degraded' | 'critical' = 'critical'
      
      if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
        rateLimitStatus = 'degraded'
      }

      return {
        responseTime: 0,
        availableModels: [],
        rateLimitStatus
      }
    }
  }

  generateAlerts(metrics: Omit<ProcessingHealthMetrics, 'alerts' | 'overallHealth'>): ProcessingHealthMetrics['alerts'] {
    const alerts: ProcessingHealthMetrics['alerts'] = []

    // Stuck notes alerts
    if (metrics.stuckNotes.count >= this.alertThresholds.stuckNotesCritical) {
      alerts.push({
        level: 'critical',
        message: `${metrics.stuckNotes.count} notes stuck in processing for over ${this.timeoutMinutes} minutes`,
        recommendation: 'Run cleanup script to release abandoned locks and reset stuck notes'
      })
    } else if (metrics.stuckNotes.count >= this.alertThresholds.stuckNotesWarning) {
      alerts.push({
        level: 'warning',
        message: `${metrics.stuckNotes.count} notes may be stuck in processing`,
        recommendation: 'Monitor processing status and consider manual intervention'
      })
    }

    // Error rate alerts
    if (metrics.errorAnalysis.recentErrorRate >= this.alertThresholds.errorRateCritical) {
      alerts.push({
        level: 'critical',
        message: `Critical error rate: ${metrics.errorAnalysis.recentErrorRate.toFixed(1)}% in the last hour`,
        recommendation: 'Investigate error patterns and consider pausing automatic processing'
      })
    } else if (metrics.errorAnalysis.recentErrorRate >= this.alertThresholds.errorRateWarning) {
      alerts.push({
        level: 'warning',
        message: `Elevated error rate: ${metrics.errorAnalysis.recentErrorRate.toFixed(1)}% in the last hour`,
        recommendation: 'Review error logs and check OpenAI API status'
      })
    }

    // Queue depth alerts
    if (metrics.performance.queueHealth.pendingCount >= this.alertThresholds.queueDepthCritical) {
      alerts.push({
        level: 'critical',
        message: `Processing queue is critically deep: ${metrics.performance.queueHealth.pendingCount} pending notes`,
        recommendation: 'Increase batch processing frequency or investigate processing bottlenecks'
      })
    } else if (metrics.performance.queueHealth.pendingCount >= this.alertThresholds.queueDepthWarning) {
      alerts.push({
        level: 'warning',
        message: `Processing queue is growing: ${metrics.performance.queueHealth.pendingCount} pending notes`,
        recommendation: 'Monitor queue growth and consider increasing processing capacity'
      })
    }

    // Lock age alerts
    if (metrics.locks.oldestLockAge >= this.alertThresholds.lockAgeCritical) {
      alerts.push({
        level: 'critical',
        message: `Oldest processing lock is ${metrics.locks.oldestLockAge} minutes old`,
        recommendation: 'Run lock cleanup to release abandoned processing locks'
      })
    } else if (metrics.locks.oldestLockAge >= this.alertThresholds.lockAgeWarning) {
      alerts.push({
        level: 'warning',
        message: `Processing lock age approaching timeout: ${metrics.locks.oldestLockAge} minutes`,
        recommendation: 'Monitor for stuck processing and prepare for cleanup if needed'
      })
    }

    // OpenAI health alerts
    if (metrics.openaiHealth.rateLimitStatus === 'critical') {
      alerts.push({
        level: 'critical',
        message: 'OpenAI API is unavailable or severely rate limited',
        recommendation: 'Check OpenAI service status and API key limits'
      })
    } else if (metrics.openaiHealth.rateLimitStatus === 'degraded') {
      alerts.push({
        level: 'warning',
        message: `OpenAI API response time is slow: ${metrics.openaiHealth.responseTime}ms`,
        recommendation: 'Monitor API performance and consider reducing request rate'
      })
    }

    // Performance alerts
    if (metrics.performance.successRate < 50) {
      alerts.push({
        level: 'critical',
        message: `Very low success rate: ${metrics.performance.successRate}%`,
        recommendation: 'Investigate root cause of processing failures'
      })
    } else if (metrics.performance.successRate < 80) {
      alerts.push({
        level: 'warning',
        message: `Below normal success rate: ${metrics.performance.successRate}%`,
        recommendation: 'Review error patterns and system health'
      })
    }

    return alerts
  }

  determineOverallHealth(metrics: Omit<ProcessingHealthMetrics, 'overallHealth'>): ProcessingHealthMetrics['overallHealth'] {
    const criticalAlerts = metrics.alerts.filter(alert => alert.level === 'critical')
    const errorAlerts = metrics.alerts.filter(alert => alert.level === 'error')
    const warningAlerts = metrics.alerts.filter(alert => alert.level === 'warning')

    if (criticalAlerts.length > 0) {
      return 'critical'
    } else if (errorAlerts.length > 0) {
      return 'unhealthy'
    } else if (warningAlerts.length > 2) {
      return 'unhealthy'
    } else if (warningAlerts.length > 0) {
      return 'degraded'
    } else {
      return 'healthy'
    }
  }

  async performAutomatedRemediation(metrics: ProcessingHealthMetrics): Promise<void> {
    console.log('🔧 Checking for automated remediation opportunities...')

    // Cleanup abandoned locks if detected
    if (metrics.locks.abandonedCount > 0) {
      console.log(`🧹 Cleaning up ${metrics.locks.abandonedCount} abandoned processing locks...`)
      
      try {
        const { data, error } = await this.supabase
          .rpc('cleanup_abandoned_processing_locks', { 
            p_timeout_minutes: this.timeoutMinutes + 5 
          })

        if (error) {
          console.error('❌ Failed to cleanup abandoned locks:', error)
        } else {
          console.log(`✅ Successfully cleaned up abandoned locks`)
        }
      } catch (error) {
        console.error('❌ Error during lock cleanup:', error)
      }
    }

    // Reset notes that have been stuck for too long
    const veryStuckNotes = metrics.stuckNotes.notes.filter(note => note.minutesStuck > (this.timeoutMinutes * 2))
    if (veryStuckNotes.length > 0) {
      console.log(`🔄 Resetting ${veryStuckNotes.length} very stuck notes...`)
      
      try {
        for (const note of veryStuckNotes) {
          await this.supabase
            .from('notes')
            .update({ 
              processing_started_at: null,
              error_message: `Auto-reset: stuck for ${note.minutesStuck} minutes`
            })
            .eq('id', note.id)
        }
        console.log(`✅ Successfully reset stuck notes`)
      } catch (error) {
        console.error('❌ Error resetting stuck notes:', error)
      }
    }
  }

  async runHealthMonitoring(): Promise<ProcessingHealthMetrics> {
    console.log('📊 Starting processing health monitoring...')
    console.log('=' .repeat(50))

    const timestamp = new Date().toISOString()

    try {
      // Gather all metrics
      console.log('🔍 Detecting stuck notes...')
      const stuckNotes = await this.detectStuckNotes()
      
      console.log('📈 Analyzing error rates...')
      const errorAnalysis = await this.analyzeErrorRates()
      
      console.log('⚡ Measuring performance...')
      const performance = await this.measurePerformanceMetrics()
      
      console.log('🔒 Monitoring locks...')
      const locks = await this.monitorLocks()
      
      console.log('🤖 Checking OpenAI health...')
      const openaiHealth = await this.checkOpenAIHealth()

      // Compile metrics
      const partialMetrics = {
        timestamp,
        stuckNotes,
        errorAnalysis,
        performance,
        locks,
        openaiHealth
      }

      // Generate alerts
      const alerts = this.generateAlerts(partialMetrics)
      const overallHealth = this.determineOverallHealth({ ...partialMetrics, alerts })

      const metrics: ProcessingHealthMetrics = {
        ...partialMetrics,
        alerts,
        overallHealth
      }

      // Print health summary
      this.printHealthSummary(metrics)

      // Perform automated remediation if needed
      if (metrics.overallHealth === 'critical' || metrics.overallHealth === 'unhealthy') {
        await this.performAutomatedRemediation(metrics)
      }

      return metrics

    } catch (error) {
      console.error('❌ Health monitoring failed:', error)
      
      return {
        timestamp,
        stuckNotes: { count: 0, notes: [] },
        errorAnalysis: { 
          recentErrorRate: 0, 
          errorTrends: { last1Hour: 0, last6Hours: 0, last24Hours: 0 },
          errorCategories: {},
          topErrors: []
        },
        performance: {
          averageProcessingTime: 0,
          successRate: 0,
          throughput: { notesPerHour: 0, notesProcessedToday: 0 },
          queueHealth: { pendingCount: 0, processingCount: 0, averageWaitTime: 0 }
        },
        locks: { activeCount: 0, abandonedCount: 0, oldestLockAge: 0 },
        openaiHealth: { responseTime: 0, availableModels: [], rateLimitStatus: 'critical' },
        alerts: [{
          level: 'critical',
          message: 'Health monitoring system failure',
          recommendation: 'Check monitoring script and database connectivity'
        }],
        overallHealth: 'critical'
      }
    }
  }

  private printHealthSummary(metrics: ProcessingHealthMetrics): void {
    console.log('\n' + '=' .repeat(50))
    console.log('📊 PROCESSING HEALTH SUMMARY')
    console.log('=' .repeat(50))
    
    const healthIcon = this.getHealthIcon(metrics.overallHealth)
    console.log(`${healthIcon} Overall Health: ${metrics.overallHealth.toUpperCase()}`)
    console.log(`🕐 Timestamp: ${metrics.timestamp}`)
    
    console.log('\n📈 Key Metrics:')
    console.log(`  🎯 Success Rate: ${metrics.performance.successRate}%`)
    console.log(`  ⚡ Throughput: ${metrics.performance.throughput.notesPerHour} notes/hour`)
    console.log(`  📋 Queue: ${metrics.performance.queueHealth.pendingCount} pending, ${metrics.performance.queueHealth.processingCount} processing`)
    console.log(`  ⏱️  Avg Processing: ${metrics.performance.averageProcessingTime}s`)
    console.log(`  🚨 Error Rate: ${metrics.errorAnalysis.recentErrorRate.toFixed(1)}% (last hour)`)
    console.log(`  🔒 Active Locks: ${metrics.locks.activeCount} (${metrics.locks.abandonedCount} abandoned)`)
    console.log(`  🤖 OpenAI: ${metrics.openaiHealth.rateLimitStatus} (${metrics.openaiHealth.responseTime}ms)`)
    
    if (metrics.stuckNotes.count > 0) {
      console.log(`\n⚠️  Stuck Notes: ${metrics.stuckNotes.count}`)
      metrics.stuckNotes.notes.slice(0, 3).forEach(note => {
        console.log(`    - ${note.id}: stuck for ${note.minutesStuck}m (${note.attempts} attempts)`)
      })
      if (metrics.stuckNotes.count > 3) {
        console.log(`    ... and ${metrics.stuckNotes.count - 3} more`)
      }
    }
    
    if (metrics.alerts.length > 0) {
      console.log('\n🚨 Active Alerts:')
      metrics.alerts.forEach((alert, index) => {
        const alertIcon = alert.level === 'critical' ? '🚨' : alert.level === 'error' ? '❌' : '⚠️'
        console.log(`  ${alertIcon} ${alert.message}`)
        console.log(`     💡 ${alert.recommendation}`)
      })
    } else {
      console.log('\n✅ No active alerts')
    }
    
    console.log('=' .repeat(50))
  }

  private getHealthIcon(health: string): string {
    switch (health) {
      case 'healthy': return '✅'
      case 'degraded': return '⚠️'
      case 'unhealthy': return '❌'
      case 'critical': return '🚨'
      default: return '❓'
    }
  }

  private categorizeError(errorMessage: string): string {
    const message = errorMessage.toLowerCase()
    
    if (message.includes('timeout')) return 'timeout'
    if (message.includes('rate limit')) return 'rate_limit'
    if (message.includes('network') || message.includes('connection')) return 'network'
    if (message.includes('openai') || message.includes('api')) return 'api_error'
    if (message.includes('validation') || message.includes('invalid')) return 'validation'
    if (message.includes('storage') || message.includes('file')) return 'storage'
    if (message.includes('authentication')) return 'auth'
    if (message.includes('circuit breaker')) return 'circuit_breaker'
    if (message.includes('lock') || message.includes('concurrent')) return 'concurrency'
    
    return 'unknown'
  }
}

// Main execution
async function main() {
  try {
    const monitor = new ProcessingHealthMonitor()
    const metrics = await monitor.runHealthMonitoring()
    
    // Output metrics as JSON for external monitoring systems
    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(metrics, null, 2))
    }
    
    // Exit with appropriate code based on health status
    const exitCodes = {
      healthy: 0,
      degraded: 0, // Still operational
      unhealthy: 1,
      critical: 2
    }
    
    process.exit(exitCodes[metrics.overallHealth])
    
  } catch (error) {
    console.error('💥 Processing health monitoring failed:', error)
    process.exit(3)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

export { ProcessingHealthMonitor, type ProcessingHealthMetrics } 