#!/usr/bin/env ts-node

/**
 * RESET PROCESSING STATE SCRIPT
 * 
 * Focused script to reset the processing state and clear any stuck jobs
 * that may be preventing new processing from working correctly.
 */

import { createClient } from '@supabase/supabase-js'

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
}

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function logStep(step: number, message: string) {
  log(`${colors.bold}${colors.blue}Step ${step}:${colors.reset} ${message}`)
}

function logSuccess(message: string) {
  log(`${colors.green}✓ ${message}${colors.reset}`)
}

function logError(message: string) {
  log(`${colors.red}✗ ${message}${colors.reset}`)
}

function logWarning(message: string) {
  log(`${colors.yellow}⚠ ${message}${colors.reset}`)
}

function logInfo(message: string) {
  log(`${colors.cyan}ℹ ${message}${colors.reset}`)
}

interface ProcessingStats {
  total: number
  pending: number
  processing: number
  completed: number
  failed: number
  stuck: number
}

interface ResetResult {
  stuckNotesReset: number
  errorsCleared: number  
  processingLocksCleared: number
  queueAnalysis: ProcessingStats
}

class ProcessingStateReset {
  private supabase: any
  private baseUrl: string

  constructor() {
    // Validate environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY')
  }

    // Create Supabase client with service role permissions
    this.supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Determine base URL for API testing
    this.baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                  'http://localhost:3000'
  }

  async analyzeProcessingQueue(): Promise<ProcessingStats> {
    logStep(1, 'Analyzing current processing queue...')

    try {
      // Check if error tracking columns exist
      const { data: sampleNote, error: sampleError } = await this.supabase
        .from('notes')
        .select('*')
        .limit(1)
      
      const hasErrorTracking = !sampleError && sampleNote && sampleNote[0] && 
        ('error_message' in sampleNote[0] || 'processing_attempts' in sampleNote[0])

      let query = this.supabase
        .from('notes')
        .select('id, processing_started_at, processed_at, transcription, analysis')

      // Add error columns if they exist
      if (hasErrorTracking) {
        query = this.supabase
          .from('notes')
          .select('id, processing_started_at, processed_at, transcription, analysis, error_message, processing_attempts')
      }

      const { data: notes, error } = await query

      if (error) {
        logError(`Failed to analyze queue: ${error.message}`)
        throw error
      }

      if (!notes || notes.length === 0) {
        logInfo('No notes found in database')
        return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0, stuck: 0 }
      }

      const now = new Date()
      const stuckThreshold = new Date(now.getTime() - 15 * 60 * 1000) // 15 minutes ago

      const stats: ProcessingStats = {
        total: notes.length,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        stuck: 0
      }

      notes.forEach(note => {
        if (note.processed_at) {
          stats.completed++
        } else if (hasErrorTracking && note.error_message) {
          stats.failed++
        } else if (note.processing_started_at) {
          const startTime = new Date(note.processing_started_at)
          if (startTime < stuckThreshold) {
            stats.stuck++
          } else {
            stats.processing++
          }
        } else {
          stats.pending++
        }
      })

      log(`Total notes: ${stats.total}`)
      log(`  ✅ Completed: ${stats.completed}`)
      log(`  ⏳ Pending: ${stats.pending}`)
      log(`  🔄 Processing: ${stats.processing}`)
      log(`  ❌ Failed: ${stats.failed}`)
      log(`  🚨 Stuck: ${stats.stuck}`)

      if (stats.stuck > 0) {
        logWarning(`Found ${stats.stuck} stuck notes (processing for >15 minutes)`)
      } else {
        logSuccess('No stuck notes found')
      }

      return stats

    } catch (error) {
      logError(`Queue analysis failed: ${error}`)
      throw error
    }
  }

  async clearStuckProcessingLocks(): Promise<number> {
    logStep(2, 'Clearing stuck processing locks...')

    try {
      // Find notes that have been processing for more than 15 minutes
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()

      const { data: stuckNotes, error: findError } = await this.supabase
        .from('notes')
        .select('id, title, processing_started_at')
        .is('processed_at', null)
        .not('processing_started_at', 'is', null)
        .lt('processing_started_at', fifteenMinutesAgo)

      if (findError) {
        logError(`Failed to find stuck notes: ${findError.message}`)
        return 0
      }

      if (!stuckNotes || stuckNotes.length === 0) {
        logSuccess('No stuck processing locks found')
        return 0
      }

      log(`Found ${stuckNotes.length} stuck notes to reset:`)
      stuckNotes.forEach(note => {
        const stuckFor = Math.round((Date.now() - new Date(note.processing_started_at).getTime()) / (1000 * 60))
        log(`  • ${note.title || note.id} (stuck for ${stuckFor} minutes)`)
      })

      // Clear the processing locks
      const { data: resetData, error: resetError } = await this.supabase
        .from('notes')
        .update({ processing_started_at: null })
        .in('id', stuckNotes.map(n => n.id))
        .select('id')

      if (resetError) {
        logError(`Failed to reset stuck notes: ${resetError.message}`)
        return 0
      }

      const resetCount = resetData?.length || 0
      logSuccess(`Reset ${resetCount} stuck processing locks`)
      return resetCount

    } catch (error) {
      logError(`Stuck lock clearing failed: ${error}`)
      return 0
    }
  }

  async clearErrorStates(retryableOnly: boolean = true): Promise<number> {
    logStep(3, `Clearing error states${retryableOnly ? ' (retryable errors only)' : ' (all errors)'}...`)

    try {
      // Check if error tracking columns exist
      const { data: sampleNote, error: sampleError } = await this.supabase
        .from('notes')
        .select('*')
        .limit(1)
      
      const hasErrorTracking = !sampleError && sampleNote && sampleNote[0] && 
        ('error_message' in sampleNote[0])

      if (!hasErrorTracking) {
        logWarning('Error tracking columns not found - skipping error state clearing')
        return 0
      }

      // Find notes with errors
      let query = this.supabase
        .from('notes')
        .select('id, title, error_message, processing_attempts')
        .not('error_message', 'is', null)

      // If retryable only, limit to notes with low attempt counts
      if (retryableOnly) {
        query = query.or('processing_attempts.is.null,processing_attempts.lt.3')
      }

      const { data: errorNotes, error: findError } = await query

      if (findError) {
        logError(`Failed to find error notes: ${findError.message}`)
        return 0
      }

      if (!errorNotes || errorNotes.length === 0) {
        logSuccess('No error states found to clear')
        return 0
      }

      log(`Found ${errorNotes.length} notes with errors to clear:`)
      errorNotes.forEach(note => {
        const attempts = note.processing_attempts || 0
        log(`  • ${note.title || note.id} (${attempts} attempts): ${note.error_message?.substring(0, 50)}...`)
      })

      // Clear the error states
      const { data: clearData, error: clearError } = await this.supabase
        .from('notes')
        .update({ 
          error_message: null,
          last_error_at: null
        })
        .in('id', errorNotes.map(n => n.id))
        .select('id')

      if (clearError) {
        logError(`Failed to clear error states: ${clearError.message}`)
        return 0
      }

      const clearedCount = clearData?.length || 0
      logSuccess(`Cleared ${clearedCount} error states`)
      return clearedCount

    } catch (error) {
      logError(`Error state clearing failed: ${error}`)
      return 0
    }
  }

  async triggerTestBatchProcessing(): Promise<boolean> {
    logStep(4, 'Triggering test batch processing...')

    try {
      const response = await fetch(`${this.baseUrl}/api/process/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          'X-Service-Auth': 'true'
        },
        body: JSON.stringify({ 
          batchSize: 3,
          action: 'test'
        })
      })

      const data = await response.json()

      if (response.ok) {
        logSuccess(`Batch processing test successful`)
        log(`  • Processed: ${data.processed || 0}`)
        log(`  • Failed: ${data.failed || 0}`)
        log(`  • Health status: ${data.healthMetrics?.healthStatus || 'unknown'}`)
        return true
      } else {
        logError(`Batch processing test failed: ${data.error || 'Unknown error'}`)
        log(`  • Status: ${response.status}`)
        log(`  • Details: ${JSON.stringify(data, null, 2)}`)
        return false
      }

    } catch (error) {
      logError(`Batch processing test failed: ${error}`)
      return false
    }
  }

  async monitorProcessingHealth(): Promise<void> {
    logStep(5, 'Monitoring processing service health...')

    try {
      const response = await fetch(`${this.baseUrl}/api/process/batch`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          'X-Service-Auth': 'true'
        }
      })

      const data = await response.json()

      if (response.ok) {
        logSuccess('Processing service health check passed')
        log(`  • Status: ${data.status || 'unknown'}`)
        log(`  • Circuit breaker: ${data.processing?.circuitBreaker?.isOpen ? 'OPEN' : 'closed'}`)
        log(`  • Active metrics: ${data.processing?.activeMetrics || 0}`)
        
        if (data.processing?.stats) {
          const stats = data.processing.stats
          log(`  • Queue: ${stats.pending || 0} pending, ${stats.processing || 0} processing, ${stats.failed || 0} failed`)
        }

        // Check for health issues
        if (data.status === 'unhealthy') {
          logWarning('Service status is unhealthy')
        }
        if (data.processing?.circuitBreaker?.isOpen) {
          logWarning('Circuit breaker is open - may indicate API issues')
        }

      } else {
        logError(`Health check failed: ${data.error || 'Unknown error'}`)
        log(`  • Status: ${response.status}`)
      }

    } catch (error) {
      logError(`Health monitoring failed: ${error}`)
    }
  }

  async generateResetReport(result: ResetResult): Promise<void> {
    log(`\n${colors.bold}${colors.magenta}RESET PROCESSING STATE REPORT${colors.reset}`)
    log(`${colors.magenta}==============================${colors.reset}\n`)

    // Reset summary
    log(`${colors.bold}RESET ACTIONS TAKEN:${colors.reset}`)
    log(`  • Stuck processing locks cleared: ${result.stuckNotesReset}`)
    log(`  • Error states cleared: ${result.errorsCleared}`)
    log(`  • Processing locks cleared: ${result.processingLocksCleared}`)

    // Queue analysis
    log(`\n${colors.bold}CURRENT QUEUE STATUS:${colors.reset}`)
    const stats = result.queueAnalysis
    log(`  • Total notes: ${stats.total}`)
    log(`  • ✅ Completed: ${stats.completed}`)
    log(`  • ⏳ Pending: ${stats.pending}`)
    log(`  • 🔄 Processing: ${stats.processing}`)
    log(`  • ❌ Failed: ${stats.failed}`)
    log(`  • 🚨 Stuck: ${stats.stuck}`)

    // Health assessment
    log(`\n${colors.bold}HEALTH ASSESSMENT:${colors.reset}`)
    
    const isHealthy = stats.stuck === 0 && stats.processing < 5 && (stats.failed / Math.max(stats.total, 1)) < 0.1
    
    if (isHealthy) {
      logSuccess('Processing queue appears healthy')
    } else {
      logWarning('Processing queue may need attention')
      
      if (stats.stuck > 0) {
        log(`  ⚠️  ${stats.stuck} notes are still stuck - may need manual intervention`)
      }
      if (stats.processing > 5) {
        log(`  ⚠️  ${stats.processing} notes are currently processing - this may be normal`)
      }
      if (stats.failed > 0) {
        log(`  ⚠️  ${stats.failed} notes have failed - check error messages`)
      }
    }

    // Recommendations
    log(`\n${colors.bold}RECOMMENDATIONS:${colors.reset}`)
    if (result.stuckNotesReset > 0 || result.errorsCleared > 0) {
      log(`${colors.green}✓ Reset actions were taken - processing should resume automatically${colors.reset}`)
    }
    
    if (stats.pending > 0) {
      log(`${colors.cyan}• ${stats.pending} notes are pending processing - cron jobs should process these automatically${colors.reset}`)
    }
    
    if (stats.failed > 0) {
      log(`${colors.yellow}• ${stats.failed} notes have failed - check error messages and consider manual retry${colors.reset}`)
    }

    if (stats.stuck > 0) {
      log(`${colors.red}• ${stats.stuck} notes are still stuck - consider running this script again or manual intervention${colors.reset}`)
    }

    log(`\n${colors.bold}NEXT STEPS:${colors.reset}`)
    log(`1. Monitor the processing queue for the next 10-15 minutes`)
    log(`2. Check that new voice notes can be uploaded and processed`)
    log(`3. Run the verification script to confirm system health`)
    log(`4. If issues persist, check Vercel function logs for errors`)
  }
}

async function main() {
  log(`${colors.bold}${colors.magenta}VOICE MEMORY - RESET PROCESSING STATE${colors.reset}`)
  log(`${colors.magenta}====================================${colors.reset}\n`)
  
  try {
    const resetService = new ProcessingStateReset()
    
    const result: ResetResult = {
      stuckNotesReset: 0,
      errorsCleared: 0,
      processingLocksCleared: 0,
      queueAnalysis: { total: 0, pending: 0, processing: 0, completed: 0, failed: 0, stuck: 0 }
    }

    // Analyze the current state
    result.queueAnalysis = await resetService.analyzeProcessingQueue()
    
    // Clear stuck processing locks
    result.stuckNotesReset = await resetService.clearStuckProcessingLocks()
    result.processingLocksCleared = result.stuckNotesReset // Same value for now
    
    // Clear retryable error states
    result.errorsCleared = await resetService.clearErrorStates(true)
    
    // Test batch processing
    const batchTestSuccess = await resetService.triggerTestBatchProcessing()
    
    // Monitor health
    await resetService.monitorProcessingHealth()
    
    // Generate comprehensive report
    await resetService.generateResetReport(result)
    
    // Final status
    if (result.stuckNotesReset > 0 || result.errorsCleared > 0) {
      log(`\n${colors.bold}${colors.green}🎉 RESET COMPLETE!${colors.reset}`)
      log(`${colors.green}Processing state has been reset. System should resume normal operation.${colors.reset}`)
    } else {
      log(`\n${colors.bold}${colors.cyan}ℹ️  NO RESET NEEDED${colors.reset}`)
      log(`${colors.cyan}Processing state appears normal. No stuck jobs or errors found.${colors.reset}`)
    }

    if (!batchTestSuccess) {
      log(`\n${colors.bold}${colors.yellow}⚠️  BATCH TEST FAILED${colors.reset}`)
      log(`${colors.yellow}The reset was applied but batch processing test failed.${colors.reset}`)
      log(`${colors.yellow}Check the migration status and verify database schema.${colors.reset}`)
    }
    
  } catch (error) {
    logError(`Critical error during reset: ${error}`)
    log('\nPlease check your environment variables and database connectivity.')
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}

export { ProcessingStateReset }