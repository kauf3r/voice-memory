#!/usr/bin/env tsx

/**
 * Fix Stuck Processing Script
 * 
 * Enhanced script to identify and fix notes that are stuck in processing state.
 * Provides comprehensive analysis and cleanup of processing locks and error states.
 * 
 * Usage: npm run script scripts/fix-stuck-processing.ts
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

// Load environment variables
dotenv.config({ path: '.env.local' })

interface StuckNote {
  id: string
  title: string
  user_id: string
  processing_started_at: string
  error_message?: string
  processing_attempts?: number
  transcription?: string
  analysis?: any
  created_at: string
  stuck_duration_minutes: number
}

interface ProcessingStats {
  total: number
  pending: number
  processing: number
  completed: number
  failed: number
  stuck: number
}

interface FixResult {
  success: boolean
  message: string
  details?: any
}

interface FixReport {
  timestamp: string
  results: {
    stuckProcessingCleanup: FixResult
    errorStateReset: FixResult
    queueAnalysis: FixResult
    batchProcessingTrigger: FixResult
    healthMonitoring: FixResult
  }
  summary: {
    notesFixed: number
    errorsCleared: number
    batchTriggered: boolean
    overallSuccess: boolean
  }
}

class StuckProcessingFixer {
  private supabase: any
  private results: FixReport['results']

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    this.results = {
      stuckProcessingCleanup: { success: false, message: 'Not started' },
      errorStateReset: { success: false, message: 'Not started' },
      queueAnalysis: { success: false, message: 'Not started' },
      batchProcessingTrigger: { success: false, message: 'Not started' },
      healthMonitoring: { success: false, message: 'Not started' }
    }
  }

  async run(): Promise<void> {
    console.log('🔧 Starting stuck processing fix...\n')
    
    try {
      // Step 1: Comprehensive lock cleanup
      await this.cleanupStuckProcessingLocks()
      
      // Step 2: Reset error states
      await this.resetErrorStates()
      
      // Step 3: Analyze processing queue
      await this.analyzeProcessingQueue()
      
      // Step 4: Trigger batch processing
      await this.triggerBatchProcessing()
      
      // Step 5: Monitor system health
      await this.monitorSystemHealth()
      
      // Generate final report
      this.generateReport()
      
    } catch (error) {
      console.error('❌ Stuck processing fix failed:', error)
      process.exit(1)
    }
  }

  private async cleanupStuckProcessingLocks(): Promise<void> {
    console.log('🔄 Step 1: Cleaning up stuck processing locks...')
    
    try {
      // Define stuck threshold (15 minutes as per best practices)
      const stuckThresholdMinutes = 15
      const stuckThreshold = new Date(Date.now() - stuckThresholdMinutes * 60 * 1000).toISOString()
      
      // Find all stuck notes
      const { data: stuckNotes, error: findError } = await this.supabase
        .from('notes')
        .select(`
          id,
          title,
          user_id,
          processing_started_at,
          error_message,
          processing_attempts,
          transcription,
          analysis,
          created_at
        `)
        .not('processing_started_at', 'is', null)
        .lt('processing_started_at', stuckThreshold)
        .order('processing_started_at', { ascending: true })

      if (findError) {
        this.results.stuckProcessingCleanup = {
          success: false,
          message: `Failed to find stuck notes: ${findError.message}`
        }
        return
      }

      const stuckCount = stuckNotes?.length || 0
      console.log(`Found ${stuckCount} notes stuck in processing for more than ${stuckThresholdMinutes} minutes`)

      if (stuckCount === 0) {
        this.results.stuckProcessingCleanup = {
          success: true,
          message: 'No stuck processing locks found',
          details: { stuckCount: 0, threshold: stuckThresholdMinutes }
        }
        console.log('✅ No stuck processing locks to clean up')
        return
      }

      // Analyze stuck notes
      const stuckAnalysis: StuckNote[] = stuckNotes.map(note => ({
        ...note,
        stuck_duration_minutes: Math.round(
          (Date.now() - new Date(note.processing_started_at).getTime()) / (1000 * 60)
        )
      }))

      // Group by stuck duration for analysis
      const shortStuck = stuckAnalysis.filter(n => n.stuck_duration_minutes < 60) // < 1 hour
      const mediumStuck = stuckAnalysis.filter(n => n.stuck_duration_minutes >= 60 && n.stuck_duration_minutes < 360) // 1-6 hours
      const longStuck = stuckAnalysis.filter(n => n.stuck_duration_minutes >= 360) // > 6 hours

      console.log(`  - Short stuck (< 1h): ${shortStuck.length}`)
      console.log(`  - Medium stuck (1-6h): ${mediumStuck.length}`)
      console.log(`  - Long stuck (> 6h): ${longStuck.length}`)

      // Try to use cleanup function if it exists
      let cleanupSuccess = false
      try {
        const { error: functionError } = await this.supabase
          .rpc('cleanup_abandoned_processing_locks', {
            timeout_minutes: stuckThresholdMinutes
          })

        if (!functionError) {
          cleanupSuccess = true
          console.log('✅ Used database function for cleanup')
        } else {
          console.log('⚠️  Database function not available, using manual cleanup')
        }
      } catch (functionErr) {
        console.log('⚠️  Database function not available, using manual cleanup')
      }

      // Manual cleanup if function not available
      if (!cleanupSuccess) {
        const stuckIds = stuckNotes.map(note => note.id)
        
        const { error: resetError } = await this.supabase
          .from('notes')
          .update({ 
            processing_started_at: null
          })
          .in('id', stuckIds)

        if (resetError) {
          this.results.stuckProcessingCleanup = {
            success: false,
            message: `Failed to reset stuck processing locks: ${resetError.message}`
          }
          return
        }
      }

      this.results.stuckProcessingCleanup = {
        success: true,
        message: `Successfully reset ${stuckCount} stuck processing locks`,
        details: {
          stuckCount,
          threshold: stuckThresholdMinutes,
          shortStuck: shortStuck.length,
          mediumStuck: mediumStuck.length,
          longStuck: longStuck.length,
          cleanupMethod: cleanupSuccess ? 'database_function' : 'manual',
          stuckNotes: stuckAnalysis.map(n => ({
            id: n.id,
            title: n.title?.substring(0, 50) || 'Untitled',
            stuckMinutes: n.stuck_duration_minutes
          }))
        }
      }

      console.log(`✅ Successfully reset ${stuckCount} stuck processing locks`)

    } catch (error) {
      this.results.stuckProcessingCleanup = {
        success: false,
        message: `Cleanup failed: ${error.message}`
      }
      console.log(`❌ Cleanup failed: ${error.message}`)
    }
  }

  private async resetErrorStates(): Promise<void> {
    console.log('🔄 Step 2: Resetting error states...')
    
    try {
      // Find notes with error messages that should be retryable
      const { data: errorNotes, error: findError } = await this.supabase
        .from('notes')
        .select(`
          id,
          title,
          error_message,
          processing_attempts,
          last_error_at,
          transcription,
          analysis
        `)
        .not('error_message', 'is', null)
        .order('last_error_at', { ascending: false })

      if (findError) {
        // Handle case where error tracking columns don't exist yet
        if (findError.message.includes('column') && findError.message.includes('does not exist')) {
          this.results.errorStateReset = {
            success: true,
            message: 'Error tracking not yet configured - no error states to reset',
            details: { reason: 'missing_error_columns' }
          }
          console.log('⚠️  Error tracking columns not available - skipping error state reset')
          return
        }

        this.results.errorStateReset = {
          success: false,
          message: `Failed to find error notes: ${findError.message}`
        }
        return
      }

      const errorCount = errorNotes?.length || 0
      console.log(`Found ${errorCount} notes with errors`)

      if (errorCount === 0) {
        this.results.errorStateReset = {
          success: true,
          message: 'No error states to reset',
          details: { errorCount: 0 }
        }
        console.log('✅ No error states to reset')
        return
      }

      // Analyze error patterns
      const errorPatterns = new Map<string, number>()
      const retryableErrors = []
      const permanentErrors = []

      errorNotes.forEach(note => {
        const errorType = this.categorizeError(note.error_message)
        errorPatterns.set(errorType, (errorPatterns.get(errorType) || 0) + 1)
        
        if (this.isRetryableError(note.error_message, note.processing_attempts || 0)) {
          retryableErrors.push(note)
        } else {
          permanentErrors.push(note)
        }
      })

      console.log(`  - Retryable errors: ${retryableErrors.length}`)
      console.log(`  - Permanent errors: ${permanentErrors.length}`)
      console.log('  - Error patterns:')
      errorPatterns.forEach((count, pattern) => {
        console.log(`    • ${pattern}: ${count}`)
      })

      // Reset retryable errors
      if (retryableErrors.length > 0) {
        const retryableIds = retryableErrors.map(note => note.id)
        
        const { error: resetError } = await this.supabase
          .from('notes')
          .update({ 
            error_message: null,
            last_error_at: null
            // Note: Keep processing_attempts to track retry history
          })
          .in('id', retryableIds)

        if (resetError) {
          this.results.errorStateReset = {
            success: false,
            message: `Failed to reset error states: ${resetError.message}`
          }
          return
        }
      }

      this.results.errorStateReset = {
        success: true,
        message: `Reset ${retryableErrors.length} retryable error states`,
        details: {
          totalErrors: errorCount,
          retryableReset: retryableErrors.length,
          permanentKept: permanentErrors.length,
          errorPatterns: Object.fromEntries(errorPatterns),
          retryableNotes: retryableErrors.map(n => ({
            id: n.id,
            title: n.title?.substring(0, 50) || 'Untitled',
            attempts: n.processing_attempts || 0
          }))
        }
      }

      console.log(`✅ Reset ${retryableErrors.length} retryable error states`)

    } catch (error) {
      this.results.errorStateReset = {
        success: false,
        message: `Error state reset failed: ${error.message}`
      }
      console.log(`❌ Error state reset failed: ${error.message}`)
    }
  }

  private async analyzeProcessingQueue(): Promise<void> {
    console.log('📊 Step 3: Analyzing processing queue...')
    
    try {
      // Get comprehensive processing statistics
      const { data: allNotes, error } = await this.supabase
        .from('notes')
        .select(`
          id,
          processed_at,
          processing_started_at,
          error_message,
          processing_attempts,
          transcription,
          analysis,
          created_at,
          last_error_at
        `)

      if (error) {
        this.results.queueAnalysis = {
          success: false,
          message: `Failed to analyze queue: ${error.message}`
        }
        return
      }

      const notes = allNotes || []
      const now = new Date()

      const stats: ProcessingStats = {
        total: notes.length,
        completed: 0,
        pending: 0,
        processing: 0,
        failed: 0,
        stuck: 0
      }

      // Detailed analysis
      const queueDetails = {
        averageProcessingTime: 0,
        oldestPending: null as any,
        recentFailures: [] as any[],
        highAttemptNotes: [] as any[]
      }

      let totalProcessingTime = 0
      let processedCount = 0

      notes.forEach(note => {
        // Basic categorization
        if (note.processed_at) {
          stats.completed++
          
          // Calculate processing time for completed notes
          if (note.processing_started_at) {
            const processingTime = new Date(note.processed_at).getTime() - new Date(note.processing_started_at).getTime()
            totalProcessingTime += processingTime
            processedCount++
          }
        } else if (note.error_message) {
          stats.failed++
          
          // Track recent failures (last 24 hours)
          if (note.last_error_at && (now.getTime() - new Date(note.last_error_at).getTime()) < 24 * 60 * 60 * 1000) {
            queueDetails.recentFailures.push({
              id: note.id,
              error: note.error_message.substring(0, 100),
              attempts: note.processing_attempts || 0
            })
          }
        } else if (note.processing_started_at) {
          const processingDuration = now.getTime() - new Date(note.processing_started_at).getTime()
          if (processingDuration > 15 * 60 * 1000) { // 15 minutes
            stats.stuck++
          } else {
            stats.processing++
          }
        } else {
          stats.pending++
          
          // Track oldest pending
          if (!queueDetails.oldestPending || new Date(note.created_at) < new Date(queueDetails.oldestPending.created_at)) {
            queueDetails.oldestPending = {
              id: note.id,
              created_at: note.created_at,
              age_hours: (now.getTime() - new Date(note.created_at).getTime()) / (1000 * 60 * 60)
            }
          }
        }

        // Track high attempt notes
        if ((note.processing_attempts || 0) > 3) {
          queueDetails.highAttemptNotes.push({
            id: note.id,
            attempts: note.processing_attempts,
            error: note.error_message?.substring(0, 100) || 'No error'
          })
        }
      })

      // Calculate average processing time
      if (processedCount > 0) {
        queueDetails.averageProcessingTime = Math.round(totalProcessingTime / processedCount / 1000) // seconds
      }

      // Determine queue health
      const totalActive = stats.pending + stats.processing
      const successRate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 100
      const errorRate = stats.total > 0 ? (stats.failed / stats.total) * 100 : 0

      const healthIssues = []
      if (stats.stuck > 0) healthIssues.push(`${stats.stuck} notes stuck`)
      if (errorRate > 10) healthIssues.push(`High error rate: ${errorRate.toFixed(1)}%`)
      if (stats.pending > 100) healthIssues.push(`Large backlog: ${stats.pending} pending`)
      if (queueDetails.oldestPending?.age_hours > 24) healthIssues.push(`Old pending notes: ${queueDetails.oldestPending.age_hours.toFixed(1)}h`)

      this.results.queueAnalysis = {
        success: true,
        message: healthIssues.length === 0 
          ? 'Processing queue is healthy'
          : `Queue issues detected: ${healthIssues.join(', ')}`,
        details: {
          stats,
          successRate: Math.round(successRate * 10) / 10,
          errorRate: Math.round(errorRate * 10) / 10,
          averageProcessingTimeSeconds: queueDetails.averageProcessingTime,
          oldestPendingHours: queueDetails.oldestPending?.age_hours || 0,
          recentFailuresCount: queueDetails.recentFailures.length,
          highAttemptNotesCount: queueDetails.highAttemptNotes.length,
          healthIssues
        }
      }

      console.log(`✅ Queue analysis complete:`)
      console.log(`  - Total: ${stats.total}, Completed: ${stats.completed}, Pending: ${stats.pending}`)
      console.log(`  - Processing: ${stats.processing}, Failed: ${stats.failed}, Stuck: ${stats.stuck}`)
      console.log(`  - Success rate: ${successRate.toFixed(1)}%, Error rate: ${errorRate.toFixed(1)}%`)

    } catch (error) {
      this.results.queueAnalysis = {
        success: false,
        message: `Queue analysis failed: ${error.message}`
      }
      console.log(`❌ Queue analysis failed: ${error.message}`)
    }
  }

  private async triggerBatchProcessing(): Promise<void> {
    console.log('🚀 Step 4: Triggering batch processing...')
    
    try {
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('supabase.co', 'vercel.app') || 'http://localhost:3000'
      const batchEndpoint = `${baseUrl}/api/process/batch`

      // Trigger batch processing with small batch size first
      const response = await fetch(batchEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          'x-vercel-cron': '1'
        },
        body: JSON.stringify({ 
          batchSize: 3, // Small batch to test
          forceProcess: false
        }),
        timeout: 30000
      })

      if (response.ok) {
        const result = await response.json()
        
        this.results.batchProcessingTrigger = {
          success: true,
          message: `Batch processing triggered successfully`,
          details: {
            status: response.status,
            batchSize: 3,
            result
          }
        }
        console.log(`✅ Batch processing triggered: ${JSON.stringify(result)}`)
      } else {
        const errorText = await response.text().catch(() => 'No response body')
        
        this.results.batchProcessingTrigger = {
          success: false,
          message: `Batch processing failed with status ${response.status}`,
          details: {
            status: response.status,
            error: errorText.substring(0, 200)
          }
        }
        console.log(`❌ Batch processing failed: ${response.status} - ${errorText.substring(0, 100)}`)
      }

    } catch (error) {
      this.results.batchProcessingTrigger = {
        success: false,
        message: `Failed to trigger batch processing: ${error.message}`
      }
      console.log(`❌ Failed to trigger batch processing: ${error.message}`)
    }
  }

  private async monitorSystemHealth(): Promise<void> {
    console.log('🏥 Step 5: Monitoring system health...')
    
    try {
      const healthChecks = {
        databaseConnection: false,
        openaiConnectivity: false,
        processingService: false,
        circuitBreakerStatus: 'unknown'
      }

      // Test database connection
      try {
        const { error: dbError } = await this.supabase
          .from('notes')
          .select('count')
          .limit(1)
        
        healthChecks.databaseConnection = !dbError
      } catch (e) {
        healthChecks.databaseConnection = false
      }

      // Test OpenAI connectivity
      if (process.env.OPENAI_API_KEY) {
        try {
          const response = await fetch('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
            timeout: 10000
          })
          healthChecks.openaiConnectivity = response.ok
        } catch (e) {
          healthChecks.openaiConnectivity = false
        }
      }

      // Test processing service
      try {
        const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('supabase.co', 'vercel.app') || 'http://localhost:3000'
        const response = await fetch(`${baseUrl}/api/process/batch`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.CRON_SECRET}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ batchSize: 0, dryRun: true }),
          timeout: 10000
        })
        healthChecks.processingService = response.status === 200 || response.status === 429
      } catch (e) {
        healthChecks.processingService = false
      }

      const healthScore = Object.values(healthChecks).filter(v => v === true).length
      const totalChecks = Object.keys(healthChecks).filter(k => k !== 'circuitBreakerStatus').length

      this.results.healthMonitoring = {
        success: healthScore >= totalChecks * 0.7, // 70% of checks must pass
        message: `System health: ${healthScore}/${totalChecks} checks passed`,
        details: {
          healthChecks,
          healthScore,
          totalChecks,
          healthPercentage: Math.round((healthScore / totalChecks) * 100)
        }
      }

      console.log(`✅ System health: ${healthScore}/${totalChecks} checks passed`)

    } catch (error) {
      this.results.healthMonitoring = {
        success: false,
        message: `Health monitoring failed: ${error.message}`
      }
      console.log(`❌ Health monitoring failed: ${error.message}`)
    }
  }

  private categorizeError(errorMessage: string): string {
    if (!errorMessage) return 'unknown'
    
    const message = errorMessage.toLowerCase()
    
    if (message.includes('rate limit') || message.includes('429')) return 'rate_limit'
    if (message.includes('timeout') || message.includes('timed out')) return 'timeout'
    if (message.includes('network') || message.includes('connection')) return 'network'
    if (message.includes('authentication') || message.includes('401')) return 'auth'
    if (message.includes('not found') || message.includes('404')) return 'not_found'
    if (message.includes('file') || message.includes('storage')) return 'storage'
    if (message.includes('openai') || message.includes('api')) return 'api'
    if (message.includes('database') || message.includes('supabase')) return 'database'
    
    return 'other'
  }

  private isRetryableError(errorMessage: string, attempts: number): boolean {
    if (!errorMessage) return false
    if (attempts > 5) return false // Don't retry if too many attempts
    
    const message = errorMessage.toLowerCase()
    
    // Retryable errors
    if (message.includes('rate limit')) return true
    if (message.includes('timeout')) return true
    if (message.includes('network')) return true
    if (message.includes('connection')) return true
    if (message.includes('503') || message.includes('502') || message.includes('504')) return true
    
    // Non-retryable errors
    if (message.includes('401') || message.includes('403')) return false
    if (message.includes('404')) return false
    if (message.includes('invalid') || message.includes('malformed')) return false
    
    // Default to retryable for unknown errors (with attempt limit)
    return attempts < 3
  }

  private generateReport(): void {
    console.log('\n' + '='.repeat(60))
    console.log('🔧 STUCK PROCESSING FIX RESULTS')
    console.log('='.repeat(60))

    const steps = [
      { name: 'Stuck Processing Cleanup', result: this.results.stuckProcessingCleanup },
      { name: 'Error State Reset', result: this.results.errorStateReset },
      { name: 'Queue Analysis', result: this.results.queueAnalysis },
      { name: 'Batch Processing Trigger', result: this.results.batchProcessingTrigger },
      { name: 'Health Monitoring', result: this.results.healthMonitoring }
    ]

    let successCount = 0
    let notesFixed = 0
    let errorsCleared = 0
    
    steps.forEach((step, index) => {
      const status = step.result.success ? '✅ PASS' : '❌ FAIL'
      console.log(`${index + 1}. ${step.name}: ${status}`)
      console.log(`   ${step.result.message}`)
      
      if (step.result.success) successCount++
      
      // Extract metrics
      if (step.name.includes('Cleanup') && step.result.details?.stuckCount) {
        notesFixed += step.result.details.stuckCount
      }
      if (step.name.includes('Error Reset') && step.result.details?.retryableReset) {
        errorsCleared += step.result.details.retryableReset
      }
      
      console.log()
    })

    const summary = {
      notesFixed,
      errorsCleared,
      batchTriggered: this.results.batchProcessingTrigger.success,
      overallSuccess: successCount >= 4 // At least 4 out of 5 steps must succeed
    }

    console.log('='.repeat(60))
    console.log(`📊 SUMMARY: ${successCount}/5 steps successful`)
    console.log(`🔧 Notes fixed: ${summary.notesFixed}`)
    console.log(`🔄 Errors cleared: ${summary.errorsCleared}`)
    console.log(`🚀 Batch processing: ${summary.batchTriggered ? 'Triggered' : 'Failed'}`)
    
    if (summary.overallSuccess) {
      console.log('🎉 Stuck processing fix completed successfully!')
      console.log('📋 Processing queue should now be operational.')
    } else {
      console.log('⚠️  Some issues remain. Additional intervention may be required.')
    }
    
    console.log('='.repeat(60))

    // Save detailed report
    const report: FixReport = {
      timestamp: new Date().toISOString(),
      results: this.results,
      summary
    }

    const reportPath = path.join(process.cwd(), 'stuck-processing-fix-report.json')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`📄 Detailed report saved to: ${reportPath}`)
  }
}

// Execute the stuck processing fix
if (require.main === module) {
  const fixer = new StuckProcessingFixer()
  fixer.run().catch(console.error)
}

export { StuckProcessingFixer }