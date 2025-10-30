/**
 * Processing Queue Recovery Service
 * Handles recovery of failed processing jobs with intelligent retry strategies
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { ProcessingJob, ProcessingStage } from './interfaces'

export interface RecoveryResult {
  success: boolean
  recoveredJobs: number
  failedJobs: number
  skippedJobs: number
  errors: string[]
  details: RecoveryJobDetail[]
}

export interface RecoveryJobDetail {
  noteId: string
  stage: ProcessingStage
  action: 'recovered' | 'failed' | 'skipped'
  reason: string
  attempts: number
}

export interface RecoveryStrategy {
  name: string
  canRecover: (job: ProcessingJob) => boolean
  recover: (job: ProcessingJob) => Promise<boolean>
  priority: number
}

export class ProcessingQueueRecoveryService {
  private client: SupabaseClient
  private recoveryStrategies: RecoveryStrategy[] = []

  // Recovery configuration
  private static readonly MAX_RECOVERY_ATTEMPTS = 3
  private static readonly RECOVERY_BACKOFF_BASE = 2000 // 2 seconds
  private static readonly STALE_JOB_THRESHOLD = 30 * 60 * 1000 // 30 minutes

  constructor(client: SupabaseClient) {
    this.client = client
    this.initializeRecoveryStrategies()
  }

  /**
   * Initialize recovery strategies in priority order
   */
  private initializeRecoveryStrategies(): void {
    this.recoveryStrategies = [
      {
        name: 'StaleJobRecovery',
        canRecover: this.canRecoverStaleJob,
        recover: this.recoverStaleJob.bind(this),
        priority: 1
      },
      {
        name: 'TranscriptionFailureRecovery',
        canRecover: this.canRecoverTranscriptionFailure,
        recover: this.recoverTranscriptionFailure.bind(this),
        priority: 2
      },
      {
        name: 'AudioFormatRecovery',
        canRecover: this.canRecoverAudioFormat,
        recover: this.recoverAudioFormat.bind(this),
        priority: 3
      },
      {
        name: 'AnalysisFailureRecovery',
        canRecover: this.canRecoverAnalysisFailure,
        recover: this.recoverAnalysisFailure.bind(this),
        priority: 4
      },
      {
        name: 'GenericFailureRecovery',
        canRecover: this.canRecoverGenericFailure,
        recover: this.recoverGenericFailure.bind(this),
        priority: 5
      }
    ]

    // Sort by priority
    this.recoveryStrategies.sort((a, b) => a.priority - b.priority)
  }

  /**
   * Perform comprehensive queue recovery
   */
  async recoverProcessingQueue(): Promise<RecoveryResult> {
    console.log('🚑 Starting processing queue recovery...')

    const result: RecoveryResult = {
      success: false,
      recoveredJobs: 0,
      failedJobs: 0,
      skippedJobs: 0,
      errors: [],
      details: []
    }

    try {
      // Find all failed/stuck processing jobs
      const failedJobs = await this.findFailedJobs()
      console.log(`📋 Found ${failedJobs.length} jobs requiring recovery`)

      if (failedJobs.length === 0) {
        result.success = true
        console.log('✅ No jobs require recovery')
        return result
      }

      // Process each job through recovery strategies
      for (const job of failedJobs) {
        const jobResult = await this.recoverSingleJob(job)
        result.details.push(jobResult)

        switch (jobResult.action) {
          case 'recovered':
            result.recoveredJobs++
            break
          case 'failed':
            result.failedJobs++
            result.errors.push(`${job.noteId}: ${jobResult.reason}`)
            break
          case 'skipped':
            result.skippedJobs++
            break
        }
      }

      result.success = result.recoveredJobs > 0 || result.failedJobs === 0

      // Log summary
      console.log(`🚑 Recovery completed:`)
      console.log(`   ✅ Recovered: ${result.recoveredJobs}`)
      console.log(`   ❌ Failed: ${result.failedJobs}`)
      console.log(`   ⏭️ Skipped: ${result.skippedJobs}`)

      if (result.errors.length > 0) {
        console.log(`   ⚠️ Errors:`)
        result.errors.forEach(error => console.log(`      ${error}`))
      }

    } catch (error) {
      result.errors.push(`Recovery process failed: ${error instanceof Error ? error.message : String(error)}`)
      console.error('❌ Queue recovery failed:', error)
    }

    return result
  }

  /**
   * Recover a single job using available strategies
   */
  private async recoverSingleJob(job: ProcessingJob): Promise<RecoveryJobDetail> {
    console.log(`🔧 Attempting recovery for job ${job.noteId} (stage: ${job.stage})`)

    const detail: RecoveryJobDetail = {
      noteId: job.noteId,
      stage: job.stage,
      action: 'failed',
      reason: 'No suitable recovery strategy found',
      attempts: job.attempts || 0
    }

    // Try each recovery strategy in order
    for (const strategy of this.recoveryStrategies) {
      if (strategy.canRecover(job)) {
        console.log(`   🎯 Applying ${strategy.name} strategy`)
        
        try {
          const success = await strategy.recover(job)
          if (success) {
            detail.action = 'recovered'
            detail.reason = `Recovered using ${strategy.name}`
            console.log(`   ✅ Job ${job.noteId} recovered successfully`)
            return detail
          }
        } catch (error) {
          console.warn(`   ⚠️ ${strategy.name} failed:`, error)
          detail.reason = `${strategy.name} failed: ${error instanceof Error ? error.message : String(error)}`
        }
      }
    }

    // If we reach here, no strategy worked
    console.log(`   ❌ All recovery strategies failed for job ${job.noteId}`)
    return detail
  }

  /**
   * Find jobs that need recovery
   */
  private async findFailedJobs(): Promise<ProcessingJob[]> {
    const jobs: ProcessingJob[] = []

    try {
      // Find stuck jobs (processing_lock_timestamp is old)
      const staleThreshold = new Date(Date.now() - ProcessingQueueRecoveryService.STALE_JOB_THRESHOLD).toISOString()
      
      const { data: stuckNotes, error: stuckError } = await this.client
        .from('voice_notes')
        .select('id, status, processing_lock_timestamp, processing_attempts, audio_file_url, error_message')
        .eq('status', 'processing')
        .lt('processing_lock_timestamp', staleThreshold)

      if (stuckError) {
        console.warn('Error finding stuck jobs:', stuckError)
      } else if (stuckNotes) {
        jobs.push(...stuckNotes.map(note => ({
          noteId: note.id,
          stage: 'transcription' as ProcessingStage,
          attempts: note.processing_attempts || 0,
          error: note.error_message,
          metadata: {
            status: note.status,
            audioUrl: note.audio_file_url,
            processingLockTimestamp: note.processing_lock_timestamp
          }
        })))
      }

      // Find failed transcription jobs
      const { data: failedTranscription, error: transcriptionError } = await this.client
        .from('voice_notes')
        .select('id, status, processing_attempts, audio_file_url, error_message')
        .eq('status', 'transcription_failed')
        .lt('processing_attempts', ProcessingQueueRecoveryService.MAX_RECOVERY_ATTEMPTS)

      if (transcriptionError) {
        console.warn('Error finding failed transcription jobs:', transcriptionError)
      } else if (failedTranscription) {
        jobs.push(...failedTranscription.map(note => ({
          noteId: note.id,
          stage: 'transcription' as ProcessingStage,
          attempts: note.processing_attempts || 0,
          error: note.error_message,
          metadata: {
            status: note.status,
            audioUrl: note.audio_file_url
          }
        })))
      }

      // Find failed analysis jobs
      const { data: failedAnalysis, error: analysisError } = await this.client
        .from('voice_notes')
        .select('id, status, processing_attempts, transcription, error_message')
        .eq('status', 'analysis_failed')
        .lt('processing_attempts', ProcessingQueueRecoveryService.MAX_RECOVERY_ATTEMPTS)

      if (analysisError) {
        console.warn('Error finding failed analysis jobs:', analysisError)
      } else if (failedAnalysis) {
        jobs.push(...failedAnalysis.map(note => ({
          noteId: note.id,
          stage: 'analysis' as ProcessingStage,
          attempts: note.processing_attempts || 0,
          error: note.error_message,
          metadata: {
            status: note.status,
            transcription: note.transcription
          }
        })))
      }

    } catch (error) {
      console.error('Error finding failed jobs:', error)
    }

    return jobs
  }

  // Recovery strategy implementations

  /**
   * Recover stale jobs (stuck in processing)
   */
  private canRecoverStaleJob = (job: ProcessingJob): boolean => {
    return job.metadata?.status === 'processing' && !!job.metadata?.processingLockTimestamp
  }

  private async recoverStaleJob(job: ProcessingJob): Promise<boolean> {
    try {
      // Reset the job to pending status
      const { error } = await this.client
        .from('voice_notes')
        .update({
          status: 'pending',
          processing_lock_timestamp: null,
          error_message: null
        })
        .eq('id', job.noteId)

      if (error) {
        throw error
      }

      console.log(`   🔄 Reset stale job ${job.noteId} to pending`)
      return true
    } catch (error) {
      console.error(`Failed to recover stale job ${job.noteId}:`, error)
      return false
    }
  }

  /**
   * Recover transcription failures (especially audio format issues)
   */
  private canRecoverTranscriptionFailure = (job: ProcessingJob): boolean => {
    return job.stage === 'transcription' && 
           job.attempts < ProcessingQueueRecoveryService.MAX_RECOVERY_ATTEMPTS &&
           !!job.metadata?.audioUrl
  }

  private async recoverTranscriptionFailure(job: ProcessingJob): Promise<boolean> {
    try {
      // Check if the error suggests an audio format issue
      const isFormatIssue = job.error && (
        job.error.includes('container format') ||
        job.error.includes('M4A') ||
        job.error.includes('MP4') ||
        job.error.includes('codec') ||
        job.error.includes('format')
      )

      // Reset with incremented attempts and clear error
      const { error } = await this.client
        .from('voice_notes')
        .update({
          status: 'pending',
          processing_attempts: (job.attempts || 0) + 1,
          processing_lock_timestamp: null,
          error_message: isFormatIssue ? 
            `Previous attempt failed due to format issue. Retrying with enhanced format normalization.` : 
            null
        })
        .eq('id', job.noteId)

      if (error) {
        throw error
      }

      console.log(`   🎵 Queued transcription retry for ${job.noteId} (attempt ${(job.attempts || 0) + 1})`)
      return true
    } catch (error) {
      console.error(`Failed to recover transcription failure ${job.noteId}:`, error)
      return false
    }
  }

  /**
   * Recover audio format issues specifically
   */
  private canRecoverAudioFormat = (job: ProcessingJob): boolean => {
    return job.error !== undefined && (
      job.error.includes('M4A') ||
      job.error.includes('MP4') ||
      job.error.includes('container format') ||
      job.error.includes('compatibility')
    )
  }

  private async recoverAudioFormat(job: ProcessingJob): Promise<boolean> {
    try {
      // Mark for processing with format conversion flag
      const { error } = await this.client
        .from('voice_notes')
        .update({
          status: 'pending',
          processing_attempts: (job.attempts || 0) + 1,
          processing_lock_timestamp: null,
          error_message: `Retrying with audio format normalization (attempt ${(job.attempts || 0) + 1})`
        })
        .eq('id', job.noteId)

      if (error) {
        throw error
      }

      console.log(`   🔧 Queued format recovery for ${job.noteId}`)
      return true
    } catch (error) {
      console.error(`Failed to recover audio format ${job.noteId}:`, error)
      return false
    }
  }

  /**
   * Recover analysis failures
   */
  private canRecoverAnalysisFailure = (job: ProcessingJob): boolean => {
    return job.stage === 'analysis' && 
           job.attempts < ProcessingQueueRecoveryService.MAX_RECOVERY_ATTEMPTS &&
           !!job.metadata?.transcription
  }

  private async recoverAnalysisFailure(job: ProcessingJob): Promise<boolean> {
    try {
      // Reset analysis with incremented attempts
      const { error } = await this.client
        .from('voice_notes')
        .update({
          status: 'transcribed',
          processing_attempts: (job.attempts || 0) + 1,
          processing_lock_timestamp: null,
          error_message: null
        })
        .eq('id', job.noteId)

      if (error) {
        throw error
      }

      console.log(`   📊 Queued analysis retry for ${job.noteId} (attempt ${(job.attempts || 0) + 1})`)
      return true
    } catch (error) {
      console.error(`Failed to recover analysis failure ${job.noteId}:`, error)
      return false
    }
  }

  /**
   * Generic failure recovery (last resort)
   */
  private canRecoverGenericFailure = (job: ProcessingJob): boolean => {
    return job.attempts < ProcessingQueueRecoveryService.MAX_RECOVERY_ATTEMPTS
  }

  private async recoverGenericFailure(job: ProcessingJob): Promise<boolean> {
    try {
      // Apply exponential backoff
      const backoffMs = ProcessingQueueRecoveryService.RECOVERY_BACKOFF_BASE * Math.pow(2, job.attempts || 0)
      const retryTime = new Date(Date.now() + backoffMs).toISOString()

      const { error } = await this.client
        .from('voice_notes')
        .update({
          status: 'pending',
          processing_attempts: (job.attempts || 0) + 1,
          processing_lock_timestamp: retryTime, // Schedule for future retry
          error_message: `Generic recovery scheduled (attempt ${(job.attempts || 0) + 1})`
        })
        .eq('id', job.noteId)

      if (error) {
        throw error
      }

      console.log(`   ⏰ Scheduled generic recovery for ${job.noteId} in ${backoffMs}ms`)
      return true
    } catch (error) {
      console.error(`Failed generic recovery ${job.noteId}:`, error)
      return false
    }
  }

  /**
   * Get recovery statistics
   */
  async getRecoveryStats(): Promise<{
    totalStuckJobs: number
    totalFailedJobs: number
    recoverableJobs: number
    averageAttempts: number
  }> {
    try {
      const jobs = await this.findFailedJobs()
      const recoverableJobs = jobs.filter(job => 
        this.recoveryStrategies.some(strategy => strategy.canRecover(job))
      ).length

      const totalAttempts = jobs.reduce((sum, job) => sum + (job.attempts || 0), 0)
      const averageAttempts = jobs.length > 0 ? totalAttempts / jobs.length : 0

      return {
        totalStuckJobs: jobs.filter(job => job.metadata?.status === 'processing').length,
        totalFailedJobs: jobs.length,
        recoverableJobs,
        averageAttempts
      }
    } catch (error) {
      console.error('Error getting recovery stats:', error)
      return {
        totalStuckJobs: 0,
        totalFailedJobs: 0,
        recoverableJobs: 0,
        averageAttempts: 0
      }
    }
  }
}