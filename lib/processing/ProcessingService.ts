/**
 * Processing Service - Main orchestrator for the processing pipeline
 * 
 * This refactored service coordinates specialized service classes to handle
 * voice note processing with improved separation of concerns and maintainability.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '../supabase-server'
import { 
  ProcessingServiceInterface, 
  ProcessingResult, 
  ProcessingJob, 
  ProcessingContext,
  ProcessingMetrics,
  BatchProcessingResult,
  ProcessingStats,
  SystemHealthMetrics,
  ProcessingStage
} from './interfaces'

// Import specialized services
import { LockManagerService } from './LockManagerService'
import { AudioProcessorService } from './AudioProcessorService'
import { AnalysisProcessorService } from './AnalysisProcessorService'
import { MetricsCollectorService } from './MetricsCollectorService'
import { ErrorHandlerService } from './ErrorHandlerService'
import { CircuitBreakerService } from './CircuitBreakerService'
import { ProcessingQueueRecoveryService } from './ProcessingQueueRecoveryService'

// Import utilities
import { createDatabaseService } from '../database/queries'
import { hasErrorTracking } from '../migration-checker'
import { getConfig, getSection } from '../config/index'
import { PerformanceMetricsTracker } from '../monitoring/PerformanceMetricsTracker'
import { BackgroundJobProcessor } from '../optimization/BackgroundJobProcessor'

export class ProcessingService implements ProcessingServiceInterface {
  private client: SupabaseClient
  private config: ReturnType<typeof getSection<'processing'>>

  // Specialized service instances
  private lockManager: LockManagerService
  private audioProcessor: AudioProcessorService
  private analysisProcessor: AnalysisProcessorService
  private metricsCollector: MetricsCollectorService
  private errorHandler: ErrorHandlerService
  private circuitBreaker: CircuitBreakerService
  private queueRecovery: ProcessingQueueRecoveryService
  private performanceTracker: PerformanceMetricsTracker
  private backgroundJobProcessor: BackgroundJobProcessor

  constructor() {
    this.client = createServiceClient()
    
    // Use centralized configuration system
    this.config = getSection('processing')

    // Initialize specialized services with configuration
    this.lockManager = new LockManagerService(this.client, this.config.timeoutMinutes)
    this.audioProcessor = new AudioProcessorService(this.client)
    this.analysisProcessor = new AnalysisProcessorService(this.client)
    this.metricsCollector = new MetricsCollectorService()
    this.errorHandler = new ErrorHandlerService(this.config.maxAttempts, this.config.retryDelayMs)
    this.performanceTracker = new PerformanceMetricsTracker()
    
    // Only enable circuit breaker if configured
    if (this.config.enableCircuitBreaker) {
      this.circuitBreaker = new CircuitBreakerService(this.config.circuitBreaker)
    } else {
      // Create a pass-through circuit breaker for disabled mode
      this.circuitBreaker = new CircuitBreakerService({ failureThreshold: 999, timeoutMs: 0, resetTimeoutMs: 0 })
    }
    
    // Initialize queue recovery service
    this.queueRecovery = new ProcessingQueueRecoveryService(this.client)

    // Initialize background job processor
    this.backgroundJobProcessor = new BackgroundJobProcessor(this)
    
    // Start background job processing if enabled
    if (this.config.enableBackgroundJobs !== false) {
      this.backgroundJobProcessor.start()
    }

    console.log('✅ ProcessingService initialized with centralized configuration')
    console.log(`📊 Configuration: timeout=${this.config.timeoutMinutes}m, attempts=${this.config.maxAttempts}, batch=${this.config.batchSize}, circuitBreaker=${this.config.enableCircuitBreaker}`)
  }

  private validateEnvironmentVariables(): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    
    // Check required environment variables
    if (!process.env.OPENAI_API_KEY) {
      errors.push('OPENAI_API_KEY is required')
    }
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      errors.push('NEXT_PUBLIC_SUPABASE_URL is required')
    }
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is required')
    }
    
    if (!process.env.SUPABASE_SERVICE_KEY) {
      errors.push('SUPABASE_SERVICE_KEY is required')
    }
    
    // Log current environment variable status (without exposing values)
    console.log('🔍 Environment variable status:', {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'SET' : 'MISSING',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
      SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? 'SET' : 'MISSING',
      NODE_ENV: process.env.NODE_ENV || 'undefined'
    })
    
    return {
      valid: errors.length === 0,
      errors
    }
  }

  async processNote(noteId: string, userId?: string, forceReprocess: boolean = false): Promise<ProcessingResult> {
    const startTime = Date.now()
    console.log(`🚀 Processing note ${noteId} (force: ${forceReprocess}, userId: ${userId})`)
    
    // Validate environment variables first
    console.log('📋 Validating environment variables...')
    const envValidation = this.validateEnvironmentVariables()
    if (!envValidation.valid) {
      console.error('❌ Environment validation failed:', envValidation.errors)
      throw new Error(`Environment validation failed: ${envValidation.errors.join(', ')}`)
    }
    console.log('✅ Environment variables validated')
    
    // Initialize processing context
    const metrics = this.metricsCollector.recordProcessingStart(noteId)
    const context: ProcessingContext = {
      noteId,
      userId: userId || '',
      job: {} as ProcessingJob, // Will be populated below
      metrics,
      forceReprocess
    }

    // Start detailed performance tracking
    const perfMetrics = this.performanceTracker.startTracking(noteId, userId || '')

    try {
      // Verify error tracking migration is applied
      const errorTrackingAvailable = await hasErrorTracking()
      if (!errorTrackingAvailable) {
        console.warn('⚠️ Error tracking migration not applied. Some features may not work correctly.')
      }

      // Step 1: Acquire processing lock
      console.log('🔒 Step 1: Acquiring processing lock...')
      if (!forceReprocess) {
        const lockAcquired = await this.lockManager.acquireLock(noteId, this.config.timeoutMinutes)
        
        if (!lockAcquired) {
          console.log('❌ Failed to acquire processing lock')
          // Check if already processed or currently processing
          const dbService = createDatabaseService(this.client)
          const noteResult = await dbService.getNoteById(noteId, userId)
          
          if (!noteResult.success || !noteResult.data) {
            console.error('❌ Note not found during lock check')
            throw new Error('Note not found')
          }
          
          const note = noteResult.data
          console.log('📝 Note status during lock check:', {
            processed_at: note.processed_at,
            processing_started_at: note.processing_started_at,
            processing_attempts: note.processing_attempts
          })
          
          if (note.processed_at) {
            console.log('✅ Note already processed, returning cached result')
            return {
              success: true,
              warning: 'Note already processed',
              transcription: note.transcription,
              analysis: note.analysis
            }
          } else if (note.processing_started_at) {
            console.log('⏳ Note is currently being processed by another instance')
            return {
              success: false,
              error: 'Note is currently being processed by another instance'
            }
          } else {
            console.log('❌ Unable to acquire processing lock - unknown state')
            return {
              success: false,
              error: 'Unable to acquire processing lock'
            }
          }
        }
        console.log('✅ Processing lock acquired')
      } else {
        console.log('⚡ Forcing reprocess, skipping lock check')
      }

      // Step 2: Get note data and create job
      console.log('📋 Step 2: Getting note data...')
      let dbService: ReturnType<typeof createDatabaseService>
      let noteResult: Awaited<ReturnType<ReturnType<typeof createDatabaseService>['getNoteById']>>
      try {
        console.log('📋 Step 2a: Creating dbService...')
        dbService = createDatabaseService(this.client)
        console.log('📋 Step 2b: Calling getNoteById...')
        noteResult = await dbService.getNoteById(noteId, userId)
        console.log('📋 Step 2c: getNoteById completed')
      } catch (step2Error) {
        console.error('❌ CRASH in Step 2:', step2Error)
        console.error('❌ Stack:', step2Error instanceof Error ? step2Error.stack : 'no stack')
        throw step2Error
      }
      
      if (!noteResult.success || !noteResult.data) {
        console.error('❌ Failed to get note data:', noteResult.error)
        await this.lockManager.releaseLockWithError(noteId, 'Note not found')
        throw new Error('Note not found')
      }
      
      const note = noteResult.data
      console.log('📝 Note data retrieved:', {
        id: note.id,
        user_id: note.user_id,
        audio_url: note.audio_url ? 'SET' : 'MISSING',
        processed_at: note.processed_at,
        processing_attempts: note.processing_attempts
      })
      
      // Check if already processed (double-check)
      if (note.processed_at && !forceReprocess) {
        console.log('✅ Note already processed (double-check), releasing lock')
        await this.lockManager.releaseLock(noteId)
        return {
          success: true,
          transcription: note.transcription,
          analysis: note.analysis,
          warning: 'Note already processed'
        }
      }

      // Create processing job
      console.log('🏗️ Creating processing job...')
      const job: ProcessingJob = {
        queue_id: note.id,
        note_id: note.id,
        user_id: note.user_id,
        audio_url: note.audio_url,
        priority: 1,
        attempts: note.processing_attempts || 0,
        recorded_at: note.recorded_at || new Date().toISOString()
      }
      
      context.job = job
      context.userId = note.user_id
      console.log('✅ Processing job created')

      // Step 3: Process the job
      console.log('⚙️ Step 3: Processing the job...')
      const result = await this.processJobWithServices(context)
      
      // Step 4: Record completion metrics
      this.metricsCollector.recordProcessingComplete(noteId, result.success, result)
      
      // Complete performance tracking
      this.performanceTracker.completeTracking(noteId, result.success)
      
      return result

    } catch (error) {
      const processingTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      console.error('💥 PROCESSING ERROR:', {
        noteId,
        userId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        processingTime: `${processingTime}ms`,
        timestamp: new Date().toISOString()
      })
      
      // Classify and log error
      this.errorHandler.logError(context, error)
      const classification = this.errorHandler.classifyError(error)
      
      // Record error metrics
      this.metricsCollector.recordError(noteId, errorMessage, classification.category)
      this.metricsCollector.recordProcessingComplete(noteId, false)
      
      // Complete performance tracking with error
      this.performanceTracker.completeTracking(noteId, false, classification.category)
      
      // Release lock with error
      await this.lockManager.releaseLockWithError(noteId, errorMessage)

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  private async processJobWithServices(context: ProcessingContext): Promise<ProcessingResult> {
    const { noteId, job } = context
    let transcription = ''
    let analysis: any = null

    try {
      // Step 1: Transcribe audio (if needed)
      this.metricsCollector.recordProcessingStage(noteId, 'transcription')
      this.performanceTracker.updateStageMetrics(noteId, 'transcription')

      // Check if transcription already exists
      console.log(`🔍 Step 1a: Creating dbService for transcription check...`)
      const dbService = createDatabaseService(this.client)
      console.log(`🔍 Step 1b: Checking for existing transcription...`)
      const noteResult = await dbService.getNoteById(noteId)
      console.log(`🔍 Step 1c: Note result:`, { success: noteResult.success, hasTranscription: !!noteResult.data?.transcription })

      if (noteResult.success && noteResult.data?.transcription) {
        transcription = noteResult.data.transcription
        console.log(`✅ Using existing transcription for note ${noteId}`)
      } else {
        // Download and process audio
        console.log(`📥 Downloading audio from storage: ${job.audio_url}`)
        const transcriptionStartTime = Date.now()

        const { buffer, mimeType } = await this.audioProcessor.downloadAudioFromStorage(job.audio_url)
        console.log(`📥 Audio downloaded: ${buffer.length} bytes, type: ${mimeType}`)
        
        // Update performance tracking with audio metadata
        this.performanceTracker.updateStageMetrics(noteId, 'transcription', {
          transcriptionLength: undefined // Will be set after transcription
        })
        
        // Use circuit breaker for external API calls
        const audioResult = await this.circuitBreaker.execute(() => 
          this.audioProcessor.processAudio(buffer, mimeType, noteId)
        )
        
        transcription = audioResult.transcription
        
        // Record transcription timing
        const transcriptionTime = Date.now() - transcriptionStartTime
        this.metricsCollector.recordProcessingStage(noteId, 'transcription', transcriptionTime)
        
        // Update performance tracking with transcription results
        this.performanceTracker.updateStageMetrics(noteId, 'transcription', {
          transcriptionLength: transcription.length
        })
        
        // Save partial progress
        await this.audioProcessor.saveTranscriptionProgress(noteId, transcription)
      }

      // Step 2: Analyze transcription
      this.metricsCollector.recordProcessingStage(noteId, 'analysis')
      this.performanceTracker.updateStageMetrics(noteId, 'analysis')
      const analysisStartTime = Date.now()
      
      // Get project knowledge context
      const knowledgeContext = await this.analysisProcessor.getProjectKnowledgeContext(job.user_id)
      
      // Use circuit breaker for external API calls
      const analysisResult = await this.circuitBreaker.execute(() =>
        this.analysisProcessor.analyze(transcription, knowledgeContext, job.recorded_at)
      )
      
      analysis = analysisResult.analysis
      
      // Record analysis timing
      const analysisTime = Date.now() - analysisStartTime
      this.metricsCollector.recordProcessingStage(noteId, 'analysis', analysisTime)
      
      // Update performance tracking with analysis complexity
      const analysisComplexity = this.calculateAnalysisComplexity(analysis)
      this.performanceTracker.updateStageMetrics(noteId, 'analysis', {
        analysisComplexity
      })

      // Step 3: Save results and release lock
      this.metricsCollector.recordProcessingStage(noteId, 'saving')
      
      const updateData = {
        transcription,
        analysis,
        processed_at: new Date().toISOString(),
        processing_started_at: null,
        error_message: null,
        last_error_at: null
      }
      
      await dbService.updateNoteProcessing(noteId, updateData)
      
      // Release lock
      await this.lockManager.releaseLock(noteId)

      // Step 4: Update project knowledge if needed
      if (analysisResult.knowledgeUpdates?.length) {
        await this.analysisProcessor.updateProjectKnowledge(job.user_id, analysisResult.knowledgeUpdates)
      }

      this.metricsCollector.recordProcessingStage(noteId, 'completed')

      return {
        success: true,
        transcription,
        analysis,
        warning: analysisResult.warning
      }

    } catch (error) {
      // Release lock with error
      await this.lockManager.releaseLockWithError(noteId, error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  async processNextBatch(batchSize?: number): Promise<BatchProcessingResult> {
    const size = batchSize || this.config.batchSize
    console.log(`🚀 Starting batch processing (max ${size} items)`)
    const batchStartTime = Date.now()

    try {
      // Cleanup abandoned locks first
      await this.lockManager.cleanupAbandonedLocks()

      // Get notes for processing
      const { data: notes, error: notesError } = await this.client
        .rpc('get_next_notes_for_processing', {
          p_user_id: null,
          p_limit: size,
          p_lock_timeout_minutes: this.config.timeoutMinutes
        })

      if (notesError) {
        throw new Error(`Failed to get notes: ${notesError.message}`)
      }

      if (!notes || notes.length === 0) {
        console.log('📭 No notes available for processing')
        return { processed: 0, failed: 0, errors: [] }
      }

      // Sort notes by priority
      const sortedNotes = this.prioritizeNotes(notes)
      
      console.log(`📋 Got ${sortedNotes.length} notes to process`)

      let processed = 0
      let failed = 0
      const errors: string[] = []
      const processingTimes: number[] = []
      const errorBreakdown: Record<string, number> = {}

      // Process notes
      for (const note of sortedNotes) {
        const noteStartTime = Date.now()
        
        try {
          // Try to acquire lock
          const lockAcquired = await this.lockManager.acquireLock(note.id, this.config.timeoutMinutes)
          
          if (!lockAcquired) {
            console.log(`⏭️ Skipping note ${note.id} - could not acquire lock`)
            continue
          }

          const result = await this.processNote(note.id, note.user_id, false)
          const noteProcessingTime = Date.now() - noteStartTime
          processingTimes.push(noteProcessingTime)
          
          if (result.success) {
            processed++
            console.log(`✅ Successfully processed note ${note.id} in ${noteProcessingTime}ms`)
          } else {
            failed++
            const errorMsg = `Note ${note.id}: ${result.error}`
            errors.push(errorMsg)
            
            const errorCategory = this.errorHandler.categorizeForMetrics(result.error || 'unknown')
            errorBreakdown[errorCategory] = (errorBreakdown[errorCategory] || 0) + 1
            
            console.error(`❌ Failed to process note ${note.id}:`, result.error)
          }
        } catch (error) {
          failed++
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          errors.push(`Note ${note.id}: ${errorMessage}`)
          
          const errorCategory = this.errorHandler.categorizeForMetrics(errorMessage)
          errorBreakdown[errorCategory] = (errorBreakdown[errorCategory] || 0) + 1
          
          console.error(`💥 Failed to process note ${note.id}:`, error)
          
          await this.lockManager.releaseLockWithError(note.id, errorMessage)
        }

        // Adaptive delay between jobs
        const circuitBreakerStatus = this.circuitBreaker.getStatus()
        const delay = this.calculateAdaptiveDelay(circuitBreakerStatus, failed, processed + failed)
        
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }

      const batchEndTime = Date.now()
      const totalTime = batchEndTime - batchStartTime
      const averageProcessingTime = processingTimes.length > 0 
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length 
        : 0
      const successRate = sortedNotes.length > 0 ? (processed / sortedNotes.length) * 100 : 0

      const metrics = {
        totalTime,
        averageProcessingTime,
        successRate,
        errorBreakdown
      }

      // Record batch metrics
      this.metricsCollector.recordBatchMetrics(sortedNotes.length, processed, failed, totalTime)

      console.log(`📊 Batch processing completed: ${processed} successful, ${failed} failed (${successRate.toFixed(1)}% success rate)`)
      
      return { processed, failed, errors, metrics }

    } catch (error) {
      console.error('💥 Batch processing failed:', error)
      return {
        processed: 0,
        failed: 1,
        errors: [error instanceof Error ? error.message : 'Batch processing failed']
      }
    }
  }

  async getProcessingStats(userId: string): Promise<ProcessingStats> {
    const dbService = createDatabaseService(this.client)
    const result = await dbService.getProcessingStats(userId)
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to get processing stats')
    }
    
    return result.data!
  }

  async resetStuckProcessing(forceReset?: boolean): Promise<{ reset: number }> {
    if (forceReset) {
      // Force reset all unprocessed notes
      console.log('🔄 Force resetting all unprocessed notes...')
      const { error } = await this.client
        .from('notes')
        .update({ 
          processing_started_at: null,
          transcription: null,
          analysis: null,
          error_message: null,
          last_error_at: null
        })
        .is('processed_at', null)
        .not('audio_url', 'is', null)

      if (error) {
        console.error('❌ Error force resetting notes:', error)
        return { reset: 0 }
      }

      // Count affected rows
      const { data: resetNotes } = await this.client
        .from('notes')
        .select('id')
        .is('processed_at', null)
        .not('audio_url', 'is', null)

      return { reset: resetNotes?.length || 0 }
    } else {
      // Use cleanup function for abandoned locks
      const cleanedCount = await this.lockManager.cleanupAbandonedLocks(5)
      return { reset: cleanedCount }
    }
  }

  async getSystemHealthMetrics(): Promise<SystemHealthMetrics> {
    try {
      const circuitBreakerStatus = this.circuitBreaker.getStatus()
      const summaryMetrics = this.metricsCollector.getSummaryMetrics()
      const stuckNotes = this.metricsCollector.getStuckProcessing(this.config.timeoutMinutes * 2)
      
      return {
        circuitBreaker: {
          isOpen: circuitBreakerStatus.isOpen,
          failures: circuitBreakerStatus.failures,
          errorTypes: circuitBreakerStatus.errorTypes,
          lastFailureTime: circuitBreakerStatus.lastFailureTime
        },
        summary: summaryMetrics,
        stuckNotes,
        healthStatus: this.determineHealthStatus(circuitBreakerStatus, summaryMetrics, stuckNotes.length),
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('❌ Failed to get system health metrics:', error)
      return {
        circuitBreaker: { isOpen: false, failures: 0, errorTypes: {}, lastFailureTime: 0 },
        summary: { totalProcessed: 0, totalSuccessful: 0, totalFailed: 0, successRate: 0, averageProcessingTime: 0, errorCategoryBreakdown: {}, currentlyProcessing: 0, uptime: 0 },
        stuckNotes: [],
        healthStatus: 'critical',
        timestamp: new Date().toISOString()
      }
    }
  }

  // Utility methods
  private prioritizeNotes(notes: any[]): any[] {
    return notes.sort((a: any, b: any) => {
      const attemptsA = a.processing_attempts || 0
      const attemptsB = b.processing_attempts || 0
      
      // First: fresh notes (0 attempts)
      if (attemptsA === 0 && attemptsB > 0) return -1
      if (attemptsB === 0 && attemptsA > 0) return 1
      
      // Second: fewer attempts
      if (attemptsA !== attemptsB) {
        return attemptsA - attemptsB
      }
      
      // Third: older notes
      const timeA = new Date(a.recorded_at).getTime()
      const timeB = new Date(b.recorded_at).getTime()
      if (timeA !== timeB) {
        return timeA - timeB
      }
      
      // Fourth: shorter duration
      const durationA = a.duration_seconds || 0
      const durationB = b.duration_seconds || 0
      return durationA - durationB
    })
  }

  private calculateAdaptiveDelay(circuitBreakerStatus: any, failed: number, total: number): number {
    const currentErrorRate = total > 0 ? failed / total : 0
    
    let delay = 500 // Base delay
    if (circuitBreakerStatus.isOpen) {
      delay = 2000 // Longer delay if circuit breaker is open
    } else if (circuitBreakerStatus.failures > 2 || currentErrorRate > 0.3) {
      delay = 1000 // Medium delay for high error rates
    }
    
    return delay
  }

  private determineHealthStatus(circuitBreaker: any, summary: any, stuckCount: number): 'healthy' | 'degraded' | 'unhealthy' | 'critical' {
    // Critical: Circuit breaker open
    if (circuitBreaker.isOpen) {
      return 'critical'
    }
    
    // Critical: High number of stuck notes
    if (stuckCount > 5) {
      return 'critical'
    }
    
    // Unhealthy: Very low success rate
    if (summary.successRate < 50 && summary.totalProcessed > 10) {
      return 'unhealthy'
    }
    
    // Degraded: Circuit breaker has recent failures or moderate success rate
    if (circuitBreaker.failures > 3 || (summary.successRate < 80 && summary.totalProcessed > 5)) {
      return 'degraded'
    }
    
    // Degraded: Multiple stuck notes
    if (stuckCount > 2) {
      return 'degraded'
    }
    
    return 'healthy'
  }

  // Public getters for service instances (for testing/monitoring)
  getLockManager(): LockManagerService { return this.lockManager }
  getAudioProcessor(): AudioProcessorService { return this.audioProcessor }
  getAnalysisProcessor(): AnalysisProcessorService { return this.analysisProcessor }
  getMetricsCollector(): MetricsCollectorService { return this.metricsCollector }
  getErrorHandler(): ErrorHandlerService { return this.errorHandler }
  getCircuitBreaker(): CircuitBreakerService { return this.circuitBreaker }
  getPerformanceTracker(): PerformanceMetricsTracker { return this.performanceTracker }

  /**
   * Calculate analysis complexity score based on analysis content
   */
  private calculateAnalysisComplexity(analysis: any): number {
    if (!analysis || typeof analysis !== 'object') {
      return 0
    }

    let complexity = 0

    // Base complexity from analysis structure
    const sections = ['sentiment', 'topics', 'tasks', 'ideas', 'messages', 'crossReferences', 'outreach']
    const presentSections = sections.filter(section => analysis[section])
    complexity += presentSections.length * 10

    // Additional complexity from content depth
    if (analysis.topics && Array.isArray(analysis.topics)) {
      complexity += analysis.topics.length * 5
    }

    if (analysis.tasks && Array.isArray(analysis.tasks)) {
      complexity += analysis.tasks.length * 8
    }

    if (analysis.ideas && Array.isArray(analysis.ideas)) {
      complexity += analysis.ideas.length * 6
    }

    if (analysis.crossReferences && typeof analysis.crossReferences === 'object') {
      const crossRefCount = Object.keys(analysis.crossReferences).length
      complexity += crossRefCount * 12 // Cross-references are complex
    }

    return Math.min(complexity, 1000) // Cap at 1000
  }

  /**
   * Get the background job processor instance
   */
  getBackgroundJobProcessor(): BackgroundJobProcessor {
    return this.backgroundJobProcessor
  }

  /**
   * Schedule a background job
   */
  async scheduleBackgroundJob(
    type: 'batch_processing' | 'cleanup' | 'analytics' | 'maintenance' | 'migration',
    payload: any,
    priority: number = 5,
    scheduledAt?: Date
  ): Promise<string> {
    return await this.backgroundJobProcessor.addJob(type, payload, priority, scheduledAt)
  }

  /**
   * Get current processing metrics for monitoring (compatibility method)
   */
  getProcessingMetrics(): Map<string, any> {
    return this.metricsCollector.getAllActiveMetrics()
  }

  /**
   * Get circuit breaker status (compatibility method)
   */
  getCircuitBreakerStatus(): any {
    return this.circuitBreaker.getStatus()
  }

  /**
   * Get summary metrics for monitoring dashboards (compatibility method)
   */
  getSummaryMetrics(): any {
    return this.metricsCollector.getSummaryMetrics()
  }

  /**
   * Recover failed processing jobs in the queue
   */
  async recoverProcessingQueue() {
    console.log('🚑 Initiating processing queue recovery...')
    return await this.queueRecovery.recoverProcessingQueue()
  }

  /**
   * Get recovery statistics for monitoring
   */
  async getRecoveryStats() {
    return await this.queueRecovery.getRecoveryStats()
  }

  /**
   * Shutdown the processing service and all sub-services
   */
  shutdown(): void {
    console.log('🛑 Shutting down ProcessingService...')
    
    // Stop background job processing
    this.backgroundJobProcessor.stop()
    
    // Stop performance tracking
    this.performanceTracker.shutdown()
    
    console.log('✅ ProcessingService shut down')
  }
}

// Singleton instance
export const processingService = new ProcessingService()