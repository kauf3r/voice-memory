import { createServiceClient } from './supabase-server'
import { transcribeAudio, transcribeAudioWithCache, analyzeTranscription, analyzeTranscriptionEnhanced, analyzeTranscriptionMultiPass, getAnalysisMetrics } from './openai'
import { createServerFile, createServerFileFromBuffer, getFilePathFromUrl, getMimeTypeFromUrl } from './storage'
import { hasErrorTracking, logMigrationStatus } from './migration-checker'
import { isVideoFile, processVideoFile } from './video-processor'
import { optimizeAudioForTranscription, processAudioChunks, AudioOptimizationResult } from './audio-optimizer'
import { assessTranscriptionComplexity } from './analysis'

interface ProcessingJob {
  queue_id: string
  note_id: string
  user_id: string
  audio_url: string
  priority: number
  attempts: number
  recorded_at: string
}

interface ProcessingResult {
  success: boolean
  error?: string
  warning?: string
  transcription?: string
  analysis?: any
  optimization?: AudioOptimizationResult
  fromCache?: boolean
  processingMetrics?: {
    totalTime: number
    optimizationTime: number
    transcriptionTime: number
    analysisTime: number
    costEstimate: number
  }
}

interface ProcessingMetrics {
  startTime: number
  endTime?: number
  transcriptionTime?: number
  analysisTime?: number
  totalTime?: number
  attempts: number
  errorCategory?: string
  processingStage?: 'initialization' | 'transcription' | 'analysis' | 'saving' | 'completed'
}

// Enhanced circuit breaker for OpenAI API calls
class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private isOpen = false
  private readonly threshold = 5 // failures
  private readonly timeout = 5 * 60 * 1000 // 5 minutes
  private readonly resetTimeout = 30 * 1000 // 30 seconds
  private readonly errorTypes = new Map<string, number>()

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isOpen) {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.isOpen = false
        this.failures = 0
        console.log('Circuit breaker: resetting to closed state')
      } else {
        throw new Error('Circuit breaker is open - OpenAI API temporarily unavailable')
      }
    }

    try {
      const result = await operation()
      // Success - reset failure count
      this.failures = 0
      return result
    } catch (error) {
      this.failures++
      this.lastFailureTime = Date.now()
      
      // Track error types for better debugging
      if (error instanceof Error) {
        const errorType = this.categorizeError(error.message)
        this.errorTypes.set(errorType, (this.errorTypes.get(errorType) || 0) + 1)
      }
      
      if (this.failures >= this.threshold) {
        this.isOpen = true
        console.log(`Circuit breaker: opened after ${this.failures} failures`)
        console.log('Error type distribution:', Object.fromEntries(this.errorTypes))
      }
      
      throw error
    }
  }

  private categorizeError(errorMessage: string): string {
    if (errorMessage.includes('rate limit')) return 'rate_limit'
    if (errorMessage.includes('timeout')) return 'timeout'
    if (errorMessage.includes('network')) return 'network'
    if (errorMessage.includes('authentication')) return 'auth'
    if (errorMessage.includes('quota')) return 'quota'
    return 'unknown'
  }

  getStatus() {
    return {
      isOpen: this.isOpen,
      failures: this.failures,
      errorTypes: Object.fromEntries(this.errorTypes),
      lastFailureTime: this.lastFailureTime
    }
  }
}

export class ProcessingService {
  private supabase = createServiceClient()
  private circuitBreaker = new CircuitBreaker()
  private readonly PROCESSING_TIMEOUT_MINUTES = parseInt(process.env.PROCESSING_TIMEOUT_MINUTES || '15')
  private processingMetrics = new Map<string, ProcessingMetrics>()
  private processingSummaryMetrics = {
    totalProcessed: 0,
    totalSuccessful: 0,
    totalFailed: 0,
    averageProcessingTime: 0,
    errorCategoryBreakdown: new Map<string, number>(),
    lastResetTime: Date.now()
  }

  // Public method for processing individual notes with locking
  async processNote(noteId: string, userId?: string, forceReprocess: boolean = false): Promise<ProcessingResult> {
    console.log(`Processing note ${noteId} (force: ${forceReprocess})`)
    const metrics: ProcessingMetrics = { 
      startTime: Date.now(), 
      attempts: 0,
      processingStage: 'initialization'
    }

    // Store metrics for monitoring
    this.processingMetrics.set(noteId, metrics)

    // Verify error tracking migration is applied
    const errorTrackingAvailable = await hasErrorTracking()
    if (!errorTrackingAvailable) {
      console.warn('Error tracking migration not applied. Some features may not work correctly.')
    }

    try {
      // First, try to acquire processing lock
      if (!forceReprocess) {
        const { data: lockResult, error: lockError } = await this.supabase
          .rpc('acquire_processing_lock', { 
            p_note_id: noteId,
            p_lock_timeout_minutes: this.PROCESSING_TIMEOUT_MINUTES 
          })

        if (lockError) {
          metrics.errorCategory = 'lock_acquisition'
          throw new Error(`Failed to acquire processing lock: ${lockError.message}`)
        }

        if (!lockResult) {
          // Lock was not acquired (note already being processed or already processed)
          const { data: note } = await this.supabase
            .from('notes')
            .select('processed_at, processing_started_at')
            .eq('id', noteId)
            .single()

          if (note?.processed_at) {
            return {
              success: true,
              warning: 'Note already processed'
            }
          } else if (note?.processing_started_at) {
            return {
              success: false,
              error: 'Note is currently being processed by another instance'
            }
          } else {
            return {
              success: false,
              error: 'Unable to acquire processing lock'
            }
          }
        }
      }

      // Enhanced timeout validation with more detailed checks
      const { data: note } = await this.supabase
        .from('notes')
        .select('processing_started_at, processing_attempts')
        .eq('id', noteId)
        .single()

      if (note?.processing_started_at && !forceReprocess) {
        const processingStartTime = new Date(note.processing_started_at).getTime()
        const timeoutMs = this.PROCESSING_TIMEOUT_MINUTES * 60 * 1000
        const elapsedTime = Date.now() - processingStartTime
        
        if (elapsedTime > timeoutMs) {
          await this.releaseProcessingLockWithError(noteId, `Processing timeout exceeded after ${Math.floor(elapsedTime / 1000)}s (max: ${this.PROCESSING_TIMEOUT_MINUTES}m)`)
          metrics.errorCategory = 'timeout'
          throw new Error(`Processing timeout exceeded after ${Math.floor(elapsedTime / 1000)}s`)
        }
        
        // Enhanced warning system for long-running processes
        const warningThresholds = [
          { threshold: 0.5, message: '50%' },
          { threshold: 0.7, message: '70%' }, 
          { threshold: 0.9, message: '90%' }
        ]
        
        for (const { threshold, message } of warningThresholds) {
          if (elapsedTime > (timeoutMs * threshold) && elapsedTime < (timeoutMs * (threshold + 0.1))) {
            console.warn(`⚠️ Note ${noteId} has been processing for ${Math.floor(elapsedTime / 1000)}s (${message} of timeout limit)`)
          }
        }
      }

      metrics.attempts = (note?.processing_attempts || 0) + 1

      // Get the note with FOR UPDATE lock for additional safety
      let noteQuery = this.supabase
        .from('notes')
        .select('*')
        .eq('id', noteId)
      
      if (userId) {
        noteQuery = noteQuery.eq('user_id', userId)
      }
      
      const { data: fullNote, error: fetchError } = await noteQuery.single()

      if (fetchError || !fullNote) {
        // Release lock on error
        metrics.errorCategory = 'note_fetch'
        await this.releaseProcessingLockWithError(noteId, `Note not found: ${fetchError?.message}`)
        throw new Error(`Note not found: ${fetchError?.message}`)
      }

      // Check if already processed (double-check)
      if (fullNote.processed_at && !forceReprocess) {
        await this.releaseProcessingLock(noteId)
        return {
          success: true,
          transcription: fullNote.transcription,
          analysis: fullNote.analysis,
          warning: 'Note already processed'
        }
      }

      // Convert note to job format
      const job: ProcessingJob & { transcription?: string } = {
        queue_id: fullNote.id,
        note_id: fullNote.id,
        user_id: fullNote.user_id,
        audio_url: fullNote.audio_url,
        transcription: fullNote.transcription,
        priority: 1,
        attempts: fullNote.processing_attempts || 0,
        recorded_at: fullNote.recorded_at
      }

      const result = await this.processJobWithLock(job, metrics)
      
      metrics.endTime = Date.now()
      metrics.totalTime = metrics.endTime - metrics.startTime
      metrics.processingStage = 'completed'
      
      // Log comprehensive processing metrics
      console.log(`Processing metrics for note ${noteId}:`, {
        totalTime: metrics.totalTime,
        transcriptionTime: metrics.transcriptionTime,
        analysisTime: metrics.analysisTime,
        attempts: metrics.attempts,
        success: result.success,
        errorCategory: metrics.errorCategory,
        processingStage: metrics.processingStage
      })

      // Collect metrics for monitoring and performance tracking
      this.collectProcessingMetrics(noteId, metrics, result.success)

      // Release lock on success or error (handled in processJobWithLock)
      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Enhanced error categorization for better debugging and retry logic
      if (!metrics.errorCategory) {
        metrics.errorCategory = this.categorizeError(errorMessage)
      }
      
      console.log(`Processing failed for note ${noteId} with error category: ${metrics.errorCategory} at stage: ${metrics.processingStage}`)
      
      // Collect failure metrics
      metrics.endTime = Date.now()
      metrics.totalTime = metrics.endTime - metrics.startTime
      this.collectProcessingMetrics(noteId, metrics, false)
      
      // Release lock with error
      await this.releaseProcessingLockWithError(noteId, errorMessage)

      return {
        success: false,
        error: errorMessage
      }
    } finally {
      // Clean up metrics after a delay to allow for monitoring
      setTimeout(() => {
        this.processingMetrics.delete(noteId)
      }, 5 * 60 * 1000) // Keep for 5 minutes
    }
  }

  async processNextBatch(batchSize: number = 5): Promise<{
    processed: number
    failed: number
    errors: string[]
    metrics?: {
      totalTime: number
      averageProcessingTime: number
      successRate: number
      errorBreakdown: Record<string, number>
    }
  }> {
    console.log(`Starting batch processing (max ${batchSize} items)`)
    const batchStartTime = Date.now()

    // Verify error tracking migration is applied
    const errorTrackingAvailable = await hasErrorTracking()
    if (!errorTrackingAvailable) {
      console.warn('Error tracking migration not applied. Some features may not work correctly.')
    }

    try {
      // First cleanup any abandoned processing locks
      await this.cleanupAbandonedLocks()

      // Get notes available for processing with optimized ordering
      // Prioritize notes with fewer processing attempts first for better success rates
      const { data: notes, error: notesError } = await this.supabase
        .rpc('get_next_notes_for_processing', {
          p_user_id: null, // Process for all users in batch
          p_limit: batchSize,
          p_lock_timeout_minutes: this.PROCESSING_TIMEOUT_MINUTES
        })

      if (notesError) {
        throw new Error(`Failed to get notes: ${notesError.message}`)
      }

      if (!notes || notes.length === 0) {
        console.log('No notes available for processing')
        return { processed: 0, failed: 0, errors: [] }
      }

      // Enhanced batch processing order optimization
      // Priority system: 1) Fresh notes (0 attempts), 2) Lower attempts, 3) Older records, 4) Shorter audio
      const sortedNotes = notes.sort((a: any, b: any) => {
        const attemptsA = a.processing_attempts || 0
        const attemptsB = b.processing_attempts || 0
        
        // First priority: fresh notes with 0 attempts go first
        if (attemptsA === 0 && attemptsB > 0) return -1
        if (attemptsB === 0 && attemptsA > 0) return 1
        
        // Second priority: fewer attempts
        if (attemptsA !== attemptsB) {
          return attemptsA - attemptsB
        }
        
        // Third priority: older notes (recorded earlier) to prevent starvation
        const timeA = new Date(a.recorded_at).getTime()
        const timeB = new Date(b.recorded_at).getTime()
        if (timeA !== timeB) {
          return timeA - timeB
        }
        
        // Fourth priority: shorter duration for faster processing
        const durationA = a.duration_seconds || 0
        const durationB = b.duration_seconds || 0
        return durationA - durationB
      })
      
      console.log(`Got ${sortedNotes.length} notes to process (prioritized: fresh → low attempts → older → shorter)`)
      console.log(`Priority breakdown: ${sortedNotes.filter((n: any) => (n.processing_attempts || 0) === 0).length} fresh, ${sortedNotes.filter((n: any) => (n.processing_attempts || 0) > 0).length} retries`)

      let processed = 0
      let failed = 0
      const errors: string[] = []
      const processingTimes: number[] = []
      const errorBreakdown: Record<string, number> = {}

      // Process notes with proper locking and enhanced error tracking
      for (const note of sortedNotes) {
        const noteStartTime = Date.now()
        
        try {
          // Acquire lock for this specific note
          const { data: lockResult, error: lockError } = await this.supabase
            .rpc('acquire_processing_lock', { 
              p_note_id: note.id,
              p_lock_timeout_minutes: this.PROCESSING_TIMEOUT_MINUTES 
            })

          if (lockError || !lockResult) {
            console.log(`Skipping note ${note.id} - could not acquire lock`)
            continue
          }

          const result = await this.processNote(note.id, note.user_id, false)
          const noteEndTime = Date.now()
          const noteProcessingTime = noteEndTime - noteStartTime
          processingTimes.push(noteProcessingTime)
          
          if (result.success) {
            processed++
            console.log(`✅ Successfully processed note ${note.id} in ${noteProcessingTime}ms (attempt ${(note.processing_attempts || 0) + 1})`)
          } else {
            failed++
            const errorMsg = `Note ${note.id}: ${result.error}`
            errors.push(errorMsg)
            
            // Track error categories for better insights
            const errorCategory = this.categorizeError(result.error || 'unknown')
            errorBreakdown[errorCategory] = (errorBreakdown[errorCategory] || 0) + 1
            
            console.error(`❌ Failed to process note ${note.id} (attempt ${(note.processing_attempts || 0) + 1}):`, result.error)
          }
        } catch (error) {
          failed++
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          errors.push(`Note ${note.id}: ${errorMessage}`)
          
          // Track error categories
          const errorCategory = this.categorizeError(errorMessage)
          errorBreakdown[errorCategory] = (errorBreakdown[errorCategory] || 0) + 1
          
          console.error(`💥 Failed to process note ${note.id}:`, error)
          
          // Release lock on unexpected error
          await this.releaseProcessingLockWithError(note.id, errorMessage)
        }

        // Adaptive delay between jobs based on circuit breaker status and error rate
        const circuitBreakerStatus = this.circuitBreaker.getStatus()
        const currentErrorRate = failed / (processed + failed)
        
        let delay = 500 // Base delay
        if (circuitBreakerStatus.isOpen) {
          delay = 2000 // Longer delay if circuit breaker is open
        } else if (circuitBreakerStatus.failures > 2 || currentErrorRate > 0.3) {
          delay = 1000 // Medium delay for high error rates
        }
        
        await new Promise(resolve => setTimeout(resolve, delay))
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

      console.log(`📊 Batch processing completed: ${processed} successful, ${failed} failed (${successRate.toFixed(1)}% success rate)`)
      console.log(`📈 Batch metrics:`, metrics)
      console.log(`⚡ Circuit breaker status:`, this.circuitBreaker.getStatus())
      
      return { processed, failed, errors, metrics }

    } finally {
      console.log('🏁 Batch processing finished')
    }
  }

  private async processJobWithLock(job: ProcessingJob & { transcription?: string }, metrics: ProcessingMetrics): Promise<ProcessingResult> {
    console.log(`Processing job ${job.queue_id} for note ${job.note_id}`)

    let optimization: AudioOptimizationResult | undefined
    let processingMetrics = {
      totalTime: 0,
      optimizationTime: 0,
      transcriptionTime: 0,
      analysisTime: 0,
      costEstimate: 0
    }

    try {
      let transcription = job.transcription
      let fromCache = false

      // Step 1: Transcribe audio (skip if transcription already exists)
      if (!transcription) {
        metrics.processingStage = 'transcription'
        const transcriptionStartTime = Date.now()
        
        // Get audio file from storage
        const filePath = getFilePathFromUrl(job.audio_url)
        const { data: audioData, error: storageError } = await this.supabase.storage
          .from('audio-files')
          .download(filePath)

        if (storageError || !audioData) {
          metrics.errorCategory = 'storage'
          throw new Error(`Could not retrieve audio file: ${storageError?.message}`)
        }

        // Convert blob to Buffer for optimization
        const buffer = await audioData.arrayBuffer()
        const nodeBuffer = Buffer.from(buffer)
        const extension = job.audio_url.split('.').pop()?.toLowerCase() || 'mp3'
        
        console.log(`Processing file: ${job.audio_url}`);
        console.log(`  Extension: .${extension}`);
        console.log(`  File size: ${nodeBuffer.length} bytes`);

        // Check if this is a video file that requires special processing
        const magicBytes = nodeBuffer.slice(0, 32)
        const mimeType = getMimeTypeFromUrl(job.audio_url, magicBytes)
        
        if (isVideoFile(mimeType, job.audio_url)) {
          console.log(`Video file detected: ${job.audio_url}`);
          
          // Process video file to extract audio
          const videoProcessingResult = await processVideoFile(nodeBuffer, job.audio_url, mimeType);
          
          if (!videoProcessingResult.success) {
            metrics.errorCategory = 'video_processing';
            console.error('Video processing failed:', videoProcessingResult.error);
            throw new Error(`Video processing failed: ${videoProcessingResult.error}`);
          }
          
          // If successful, use the extracted audio buffer
          if (videoProcessingResult.audioBuffer && videoProcessingResult.audioMimeType) {
            console.log('Audio successfully extracted from video');
            // Update nodeBuffer with extracted audio
            // nodeBuffer = videoProcessingResult.audioBuffer
          }
        }

        // Step 1.1: Optimize audio for transcription
        const optimizationStartTime = Date.now()
        optimization = await optimizeAudioForTranscription(nodeBuffer, `${job.note_id}.${extension}`)
        processingMetrics.optimizationTime = Date.now() - optimizationStartTime
        processingMetrics.costEstimate = optimization.processingCost

        console.log('Audio optimization complete:', {
          originalSize: optimization.originalSize,
          optimizedSize: optimization.optimizedSize,
          compressionRatio: optimization.compressionRatio.toFixed(2),
          whisperModel: optimization.whisperModel,
          shouldChunk: optimization.shouldChunk,
          estimatedCost: `$${optimization.processingCost.toFixed(4)}`
        })

        // Step 1.2: Create optimized audio file
        const audioFile = createServerFileFromBuffer(
          optimization.optimizedBuffer, 
          `${job.note_id}.${extension}`, 
          mimeType
        )

        // Step 1.3: Handle chunked processing for large files
        if (optimization.shouldChunk && optimization.chunkStrategy) {
          console.log(`Processing ${optimization.chunkStrategy.chunks.length} audio chunks`)
          
          const chunkTranscriptionFunction = async (chunkBuffer: Buffer, chunkFilename: string) => {
            const chunkFile = createServerFileFromBuffer(chunkBuffer, chunkFilename, mimeType)
            const result = await this.circuitBreaker.execute(
              () => transcribeAudioWithCache(chunkFile, {
                model: optimization!.whisperModel,
                enableLanguageDetection: true
              })
            )
            
            if (result.error) {
              throw new Error(`Chunk transcription failed: ${result.error.message}`)
            }
            
            return result.text || ''
          }

          const chunkResults = await processAudioChunks(
            optimization.chunkStrategy.chunks,
            chunkTranscriptionFunction,
            `${job.note_id}.${extension}`
          )

          transcription = chunkResults.text
          fromCache = chunkResults.chunkResults.some(r => r.text.includes('[cached]')) // Simplified cache detection
          
          console.log(`Chunked transcription complete: ${chunkResults.chunkResults.length} chunks processed`)
        } else {
          // Step 1.4: Single file transcription with caching
          console.log(`Sending optimized audio to Whisper API: ${audioFile.name} (${audioFile.type}, ${audioFile.size} bytes)`);
          
          const transcriptionResult = await this.circuitBreaker.execute(
            () => transcribeAudioWithCache(audioFile, {
              model: optimization!.whisperModel,
              enableLanguageDetection: true,
              prompt: "This is a voice note recording. Please provide accurate transcription with proper punctuation."
            })
          )

          if (transcriptionResult.error || !transcriptionResult.text) {
            metrics.errorCategory = 'transcription'
            
            // Enhanced error logging
            console.error(`Transcription failed for ${extension} file:`, {
              noteId: job.note_id,
              fileName: audioFile.name,
              fileType: audioFile.type,
              fileSize: audioFile.size,
              originalUrl: job.audio_url,
              extension: extension,
              detectedMimeType: mimeType,
              optimization: optimization,
              errorMessage: transcriptionResult.error?.message
            });
            
            throw new Error(`Transcription failed: ${transcriptionResult.error?.message}`)
          }

          transcription = transcriptionResult.text
          fromCache = transcriptionResult.fromCache || false
          
          console.log('Transcription completed:', {
            length: transcription.length,
            fromCache,
            model: optimization.whisperModel,
            language: transcriptionResult.metadata?.language
          })
        }

        processingMetrics.transcriptionTime = Date.now() - transcriptionStartTime

        // Save partial progress (transcription)
        await this.supabase
          .from('notes')
          .update({ transcription })
          .eq('id', job.note_id)
      } else {
        console.log(`Using existing transcription for note ${job.note_id}`)
      }

      // Step 2: Get project knowledge for context
      const { data: projectKnowledge } = await this.supabase
        .from('project_knowledge')
        .select('content')
        .eq('user_id', job.user_id)
        .single()

      const knowledgeContext = projectKnowledge?.content ? 
        JSON.stringify(projectKnowledge.content) : 
        ''

      // Step 3: Enhanced Analysis with intelligent model selection
      metrics.processingStage = 'analysis'
      const analysisStartTime = Date.now()
      
      console.log('Starting enhanced analysis...')
      
      // Assess complexity to determine analysis approach
      const complexity = assessTranscriptionComplexity(transcription, knowledgeContext)
      console.log(`Analysis complexity: ${complexity.level} (score: ${complexity.score.toFixed(2)})`, {
        factors: complexity.factors,
        reasoning: complexity.reasoning
      })
      
      // Determine analysis strategy based on complexity and content length
      let analysisResult
      
      if (complexity.level === 'complex' || transcription.length > 3000) {
        console.log('Using multi-pass analysis for complex content')
        // Use multi-pass analysis for complex content
        const multiPassResult = await this.circuitBreaker.execute(
          () => analyzeTranscriptionMultiPass(transcription, knowledgeContext, job.recorded_at)
        )
        
        analysisResult = {
          analysis: multiPassResult.analysis,
          error: multiPassResult.error,
          warning: multiPassResult.warning || `Multi-pass analysis completed with ${multiPassResult.passes.length} passes`,
          metadata: {
            analysisStrategy: 'multi-pass',
            passes: multiPassResult.passes,
            complexity: complexity.level
          }
        }
      } else {
        console.log('Using enhanced single-pass analysis')
        // Use enhanced single-pass analysis for standard content
        const enhancedResult = await this.circuitBreaker.execute(
          () => analyzeTranscriptionEnhanced(
            transcription, 
            knowledgeContext, 
            job.recorded_at,
            undefined, // userPatterns - could be populated from historical data
            {
              // Let the system choose the optimal model based on complexity
              enableMultiPass: false,
              confidenceThreshold: 0.8
            }
          )
        )
        
        analysisResult = {
          analysis: enhancedResult.analysis,
          error: enhancedResult.error,
          warning: enhancedResult.warning,
          metadata: {
            analysisStrategy: 'enhanced-single-pass',
            model: enhancedResult.metadata.model,
            confidence: enhancedResult.metadata.confidence,
            cost: enhancedResult.metadata.cost,
            complexity: enhancedResult.metadata.complexity,
            fromCache: enhancedResult.metadata.fromCache
          }
        }
      }
      
      const { analysis, error: analysisError, warning } = analysisResult

      if (analysisError) {
        metrics.errorCategory = 'analysis'
        throw new Error(`Enhanced analysis failed: ${analysisError.message}`)
      }
      
      // Log analysis metrics
      const analysisMetrics = getAnalysisMetrics()
      console.log('Analysis performance metrics:', {
        cacheHitRate: (analysisMetrics.cacheHitRate * 100).toFixed(1) + '%',
        averageCost: '$' + analysisMetrics.averageCostPerRequest.toFixed(4),
        totalCost: '$' + analysisMetrics.totalCost.toFixed(4),
        modelDistribution: {
          gpt4: analysisMetrics.gpt4Requests,
          gpt35: analysisMetrics.gpt35Requests
        }
      })

      metrics.analysisTime = Date.now() - analysisStartTime
      
      // Enhanced warning message with analysis metadata
      const enhancedWarning = warning ? 
        `${warning} | Strategy: ${analysisResult.metadata.analysisStrategy}` : 
        undefined

      // Step 4: Update note with results and release lock
      metrics.processingStage = 'saving'
      
      // Check migration status for error tracking columns
      const migrationStatus = { hasErrorColumns: true }
      
      const updateData: any = {
        transcription,
        analysis,
        processed_at: new Date().toISOString(),
        processing_started_at: null
      }
      
      // Only include error tracking columns if they exist
      if (migrationStatus.hasErrorColumns) {
        updateData.error_message = null
        updateData.last_error_at = null
      }
      
      await this.supabase
        .from('notes')
        .update(updateData)
        .eq('id', job.note_id)

      // Release lock with successful completion
      await this.releaseProcessingLock(job.note_id)

      // Step 5: Update project knowledge if needed (with improved error handling)
      if (analysis && analysis.crossReferences?.projectKnowledgeUpdates?.length > 0) {
        await this.updateProjectKnowledge(job.user_id, analysis.crossReferences.projectKnowledgeUpdates)
      }

      if (warning) {
        console.warn(`Processing completed with warning for note ${job.note_id}: ${warning}`)
      }

      // Calculate final metrics
      processingMetrics.totalTime = Date.now() - metrics.startTime
      processingMetrics.analysisTime = Date.now() - analysisStartTime

      return {
        success: true,
        transcription,
        analysis,
        warning: enhancedWarning,
        optimization,
        fromCache,
        processingMetrics,
        analysisMetadata: analysisResult.metadata
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Release lock with error
      await this.releaseProcessingLockWithError(job.note_id, errorMessage)
      
      throw error
    }
  }

  private async releaseProcessingLock(noteId: string): Promise<void> {
    try {
      await this.supabase.rpc('release_processing_lock', { p_note_id: noteId })
    } catch (error) {
      console.error(`Failed to release processing lock for note ${noteId}:`, error)
    }
  }

  private async releaseProcessingLockWithError(noteId: string, errorMessage: string): Promise<void> {
    try {
      // Check migration status to determine available methods
      const migrationStatus = { hasErrorColumns: true, hasFunctions: false }
      
      if (migrationStatus.hasFunctions) {
        // Try using the database function first
        const { error: functionError } = await this.supabase.rpc('release_processing_lock_with_error', { 
          p_note_id: noteId,
          p_error_message: errorMessage
        })
        
        if (!functionError) {
          return // Success with function
        }
        console.warn(`Database function failed, using fallback: ${functionError.message}`)
      }
      
      // Fallback to direct update
      const updateData: any = {
        processing_started_at: null
      }
      
      // Only include error tracking columns if they exist
      if (migrationStatus.hasErrorColumns) {
        updateData.error_message = errorMessage
        updateData.last_error_at = new Date().toISOString()
        // Note: would need a database function to safely increment this value
        // For now, just omit it to avoid the raw SQL issue
      } else {
        console.warn(`Error tracking not available, logging to console: Note ${noteId} error: ${errorMessage}`)
      }
      
      const { error: updateError } = await this.supabase
        .from('notes')
        .update(updateData)
        .eq('id', noteId)
        
      if (updateError) {
        console.error(`Failed to release processing lock with error for note ${noteId}:`, updateError)
      }
    } catch (error) {
      console.error(`Failed to release processing lock with error for note ${noteId}:`, error)
      // Final fallback - just log to console
      console.warn(`Final fallback: Note ${noteId} processing failed with error: ${errorMessage}`)
    }
  }

  private async cleanupAbandonedLocks(timeoutMinutes: number = 15): Promise<number> {
    try {
      const { data: cleanedCount, error } = await this.supabase
        .rpc('cleanup_abandoned_processing_locks', { p_timeout_minutes: timeoutMinutes })

      if (error) {
        console.error('Failed to cleanup abandoned locks:', error)
        return 0
      }

      const count = cleanedCount?.[0]?.cleaned_count || 0
      if (count > 0) {
        console.log(`Cleaned up ${count} abandoned processing locks`)
      }
      return count
    } catch (error) {
      console.error('Error in cleanupAbandonedLocks:', error)
      return 0
    }
  }

  private async updateProjectKnowledge(userId: string, updates: string[]): Promise<void> {
    try {
      // Get current knowledge
      const { data: currentKnowledge } = await this.supabase
        .from('project_knowledge')
        .select('content')
        .eq('user_id', userId)
        .single()

      const current = currentKnowledge?.content || {}
      
      // Update knowledge
      const newKnowledge = {
        ...current,
        lastUpdated: new Date().toISOString(),
        recentInsights: [
          ...(current.recentInsights || []),
          ...updates
        ].slice(-50) // Keep last 50 insights
      }

      await this.supabase
        .from('project_knowledge')
        .upsert({
          user_id: userId,
          content: newKnowledge,
          updated_at: new Date().toISOString(),
        })
    } catch (error) {
      console.warn('Failed to update project knowledge:', error)
      // Don't fail the whole job for this
    }
  }

  async resetStuckProcessing(forceReset: boolean = false): Promise<{ reset: number }> {
    try {
      if (forceReset) {
        // Force reset ALL unprocessed notes by clearing locks
        console.log('Force resetting all unprocessed notes...')
        const { error } = await this.supabase
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
          console.error('Error force resetting notes:', error)
          return { reset: 0 }
        }

        // Count affected rows (would need to be done separately in a real implementation)
        const { data: resetNotes } = await this.supabase
          .from('notes')
          .select('id')
          .is('processed_at', null)
          .not('audio_url', 'is', null)

        return { reset: resetNotes?.length || 0 }
      } else {
        // Use the dedicated cleanup function for abandoned locks
        const cleanedCount = await this.cleanupAbandonedLocks(5) // 5 minute timeout for stuck detection
        return { reset: cleanedCount }
      }
    } catch (error) {
      console.error('Error in resetStuckProcessing:', error)
      return { reset: 0 }
    }
  }

  async getProcessingStats(userId: string): Promise<{
    total: number
    pending: number
    processing: number
    completed: number
    failed: number
  }> {
    try {
      // Check migration status to determine available features
      const migrationStatus = { hasErrorColumns: true, isApplied: true, hasFunctions: false }
      
      // First, cleanup any abandoned processing locks if available
      if (migrationStatus.isApplied) {
        await this.cleanupAbandonedLocks()
      }
      
      if (migrationStatus.hasFunctions) {
        // Use the database function if available
        const { data: stats, error } = await this.supabase
          .rpc('get_processing_stats', { p_user_id: userId })

        if (!error && stats && stats.length > 0) {
          const result = stats[0]
          return {
            total: Number(result.total),
            pending: Number(result.pending),
            processing: Number(result.processing),
            completed: Number(result.completed),
            failed: Number(result.failed)
          }
        }
        console.warn('Database function failed, using fallback calculation')
      }

      // Fallback to manual calculation
      console.warn('Database function not available, calculating stats manually')
      
      // Build select query based on available columns
      let selectColumns = 'processed_at, transcription, analysis'
      if (migrationStatus.hasErrorColumns) {
        selectColumns += ', error_message, processing_started_at'
      }
      
      const { data: notes, error: notesError } = await this.supabase
        .from('notes')
        .select(selectColumns)
        .eq('user_id', userId)

      if (notesError) {
        throw new Error(`Failed to get notes for stats: ${notesError.message}`)
      }

      const total = notes?.length || 0
      const completed = notes?.filter((n: any) => n.processed_at).length || 0
      
      let failed = 0
      let processing = 0
      
      if (migrationStatus.hasErrorColumns) {
        failed = notes?.filter((n: any) => n.error_message).length || 0
        processing = notes?.filter((n: any) => n.processing_started_at && !n.processed_at && !n.error_message).length || 0
      } else {
        // Without error tracking, estimate based on completion status
        const incomplete = notes?.filter((n: any) => !n.processed_at).length || 0
        const withTranscription = notes?.filter((n: any) => !n.processed_at && n.transcription).length || 0
        processing = withTranscription
        failed = Math.max(0, incomplete - processing) // Rough estimate
      }
      
      const pending = Math.max(0, total - completed - failed - processing)

      return {
        total,
        pending,
        processing,
        completed,
        failed
      }
    } catch (error) {
      console.error('Failed to get processing stats:', error)
      // Return basic stats even if query fails
      return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 }
    }
  }

  private categorizeError(errorMessage: string): string {
    const message = errorMessage.toLowerCase()
    
    // Database/Migration specific errors (highest priority)
    if (message.includes('column') && message.includes('does not exist')) return 'missing_migration'
    if (message.includes('relation') && message.includes('does not exist')) return 'missing_table'
    if (message.includes('function') && message.includes('does not exist')) return 'missing_function'
    
    // Enhanced error categorization for better debugging and retry strategies
    if (message.includes('timeout') || message.includes('time out')) {
      return 'timeout'
    } else if (message.includes('rate limit') || message.includes('too many requests')) {
      return 'rate_limit'
    } else if (message.includes('openai') || message.includes('api') || message.includes('model')) {
      return 'api_error'
    } else if (message.includes('validation') || message.includes('invalid')) {
      return 'validation'
    } else if (message.includes('network') || message.includes('connection') || message.includes('fetch')) {
      return 'network'
    } else if (message.includes('storage') || message.includes('file') || message.includes('download')) {
      return 'storage'
    } else if (message.includes('lock') || message.includes('concurrent')) {
      return 'concurrency'
    } else if (message.includes('authentication') || message.includes('authorization')) {
      return 'auth'
    } else if (message.includes('quota') || message.includes('billing')) {
      return 'quota'
    } else if (message.includes('circuit breaker')) {
      return 'circuit_breaker'
    } else if (message.includes('memory') || message.includes('resource')) {
      return 'resource'
    } else if (message.includes('database') || message.includes('supabase')) {
      return 'database'
    } else {
      return 'unknown'
    }
  }

  private collectProcessingMetrics(noteId: string, metrics: ProcessingMetrics, success: boolean): void {
    // Update summary metrics for monitoring dashboard
    this.processingSummaryMetrics.totalProcessed++
    
    if (success) {
      this.processingSummaryMetrics.totalSuccessful++
    } else {
      this.processingSummaryMetrics.totalFailed++
      
      // Track error category distribution
      if (metrics.errorCategory) {
        const current = this.processingSummaryMetrics.errorCategoryBreakdown.get(metrics.errorCategory) || 0
        this.processingSummaryMetrics.errorCategoryBreakdown.set(metrics.errorCategory, current + 1)
      }
    }
    
    // Update rolling average processing time
    if (metrics.totalTime) {
      const currentAvg = this.processingSummaryMetrics.averageProcessingTime
      const totalProcessed = this.processingSummaryMetrics.totalProcessed
      this.processingSummaryMetrics.averageProcessingTime = 
        ((currentAvg * (totalProcessed - 1)) + metrics.totalTime) / totalProcessed
    }
    
    // Store detailed metrics for monitoring (could be enhanced to send to external monitoring service)
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

    // Log metrics for now (could be sent to monitoring service like DataDog, New Relic, etc.)
    console.log('📊 Processing metric collected:', metricData)
    
    // Reset summary metrics every hour to prevent memory growth
    const hoursSinceReset = (Date.now() - this.processingSummaryMetrics.lastResetTime) / (1000 * 60 * 60)
    if (hoursSinceReset >= 1) {
      this.resetSummaryMetrics()
    }
  }

  private resetSummaryMetrics(): void {
    console.log('🔄 Resetting summary metrics after 1 hour')
    this.processingSummaryMetrics = {
      totalProcessed: 0,
      totalSuccessful: 0,
      totalFailed: 0,
      averageProcessingTime: 0,
      errorCategoryBreakdown: new Map<string, number>(),
      lastResetTime: Date.now()
    }
  }

  // New method to get current processing metrics for monitoring
  getProcessingMetrics(): Map<string, ProcessingMetrics> {
    return new Map(this.processingMetrics)
  }

  // New method to get circuit breaker status
  getCircuitBreakerStatus() {
    return this.circuitBreaker.getStatus()
  }

  // New method to get summary metrics for monitoring dashboards
  getSummaryMetrics() {
    const errorBreakdown = Object.fromEntries(this.processingSummaryMetrics.errorCategoryBreakdown)
    const successRate = this.processingSummaryMetrics.totalProcessed > 0 
      ? (this.processingSummaryMetrics.totalSuccessful / this.processingSummaryMetrics.totalProcessed) * 100 
      : 0
    
    return {
      ...this.processingSummaryMetrics,
      errorCategoryBreakdown: errorBreakdown,
      successRate,
      currentlyProcessing: this.processingMetrics.size,
      uptime: Date.now() - this.processingSummaryMetrics.lastResetTime
    }
  }

  // New method for health checks and monitoring
  async getSystemHealthMetrics() {
    try {
      const circuitBreakerStatus = this.getCircuitBreakerStatus()
      const summaryMetrics = this.getSummaryMetrics()
      const currentlyProcessing = this.processingMetrics.size
      
      // Check for stuck processing (processing for more than 2x timeout)
      const stuckProcessingThreshold = (this.PROCESSING_TIMEOUT_MINUTES * 2) * 60 * 1000
      const stuckNotes = Array.from(this.processingMetrics.entries())
        .filter(([_, metrics]) => (Date.now() - metrics.startTime) > stuckProcessingThreshold)
        .map(([noteId]) => noteId)
      
      return {
        circuitBreaker: circuitBreakerStatus,
        summary: summaryMetrics,
        currentlyProcessing,
        stuckNotes,
        healthStatus: this.determineHealthStatus(circuitBreakerStatus, summaryMetrics, stuckNotes.length),
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('Failed to get system health metrics:', error)
      return {
        healthStatus: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
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
}

// Singleton instance
export const processingService = new ProcessingService()