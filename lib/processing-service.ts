import { createServiceClient } from './supabase-server'
import { transcribeAudio, analyzeTranscription } from './openai'
import { createServerFile, createServerFileFromBuffer, getFilePathFromUrl, getMimeTypeFromUrl } from './storage'
import { hasErrorTracking, logMigrationStatus } from './migration-checker'

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
}

export class ProcessingService {
  private supabase = createServiceClient()

  // Public method for processing individual notes with locking
  async processNote(noteId: string, userId?: string, forceReprocess: boolean = false): Promise<ProcessingResult> {
    console.log(`Processing note ${noteId} (force: ${forceReprocess})`)

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
            p_lock_timeout_minutes: 15 
          })

        if (lockError) {
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

      // Get the note with FOR UPDATE lock for additional safety
      let noteQuery = this.supabase
        .from('notes')
        .select('*')
        .eq('id', noteId)
      
      if (userId) {
        noteQuery = noteQuery.eq('user_id', userId)
      }
      
      const { data: note, error: fetchError } = await noteQuery.single()

      if (fetchError || !note) {
        // Release lock on error
        await this.releaseProcessingLockWithError(noteId, `Note not found: ${fetchError?.message}`)
        throw new Error(`Note not found: ${fetchError?.message}`)
      }

      // Check if already processed (double-check)
      if (note.processed_at && !forceReprocess) {
        await this.releaseProcessingLock(noteId)
        return {
          success: true,
          transcription: note.transcription,
          analysis: note.analysis,
          warning: 'Note already processed'
        }
      }

      // Convert note to job format
      const job: ProcessingJob & { transcription?: string } = {
        queue_id: note.id,
        note_id: note.id,
        user_id: note.user_id,
        audio_url: note.audio_url,
        transcription: note.transcription,
        priority: 1,
        attempts: note.processing_attempts || 0,
        recorded_at: note.recorded_at
      }

      const result = await this.processJobWithLock(job)
      
      // Release lock on success or error (handled in processJobWithLock)
      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Release lock with error
      await this.releaseProcessingLockWithError(noteId, errorMessage)

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  async processNextBatch(batchSize: number = 5): Promise<{
    processed: number
    failed: number
    errors: string[]
  }> {
    console.log(`Starting batch processing (max ${batchSize} items)`)

    // Verify error tracking migration is applied
    const errorTrackingAvailable = await hasErrorTracking()
    if (!errorTrackingAvailable) {
      console.warn('Error tracking migration not applied. Some features may not work correctly.')
    }

    try {
      // First cleanup any abandoned processing locks
      await this.cleanupAbandonedLocks()

      // Get notes available for processing using the new function
      const { data: notes, error: notesError } = await this.supabase
        .rpc('get_next_notes_for_processing', {
          p_user_id: null, // Process for all users in batch
          p_limit: batchSize,
          p_lock_timeout_minutes: 15
        })

      if (notesError) {
        throw new Error(`Failed to get notes: ${notesError.message}`)
      }

      if (!notes || notes.length === 0) {
        console.log('No notes available for processing')
        return { processed: 0, failed: 0, errors: [] }
      }

      console.log(`Got ${notes.length} notes to process`)

      let processed = 0
      let failed = 0
      const errors: string[] = []

      // Process notes with proper locking
      for (const note of notes) {
        try {
          // Acquire lock for this specific note
          const { data: lockResult, error: lockError } = await this.supabase
            .rpc('acquire_processing_lock', { 
              p_note_id: note.id,
              p_lock_timeout_minutes: 15 
            })

          if (lockError || !lockResult) {
            console.log(`Skipping note ${note.id} - could not acquire lock`)
            continue
          }

          const result = await this.processNote(note.id, note.user_id, false)
          
          if (result.success) {
            processed++
            console.log(`Successfully processed note ${note.id}`)
          } else {
            failed++
            errors.push(`Note ${note.id}: ${result.error}`)
            console.error(`Failed to process note ${note.id}:`, result.error)
          }
        } catch (error) {
          failed++
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          errors.push(`Note ${note.id}: ${errorMessage}`)
          console.error(`Failed to process note ${note.id}:`, error)
          
          // Release lock on unexpected error
          await this.releaseProcessingLockWithError(note.id, errorMessage)
        }

        // Small delay between jobs to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      console.log(`Batch processing completed: ${processed} successful, ${failed} failed`)
      return { processed, failed, errors }

    } finally {
      console.log('Batch processing finished')
    }
  }

  private async processJobWithLock(job: ProcessingJob & { transcription?: string }): Promise<ProcessingResult> {
    console.log(`Processing job ${job.queue_id} for note ${job.note_id}`)

    try {
      let transcription = job.transcription

      // Step 1: Transcribe audio (skip if transcription already exists)
      if (!transcription) {
        // Get audio file from storage
        const filePath = getFilePathFromUrl(job.audio_url)
        const { data: audioData, error: storageError } = await this.supabase.storage
          .from('audio-files')
          .download(filePath)

        if (storageError || !audioData) {
          throw new Error(`Could not retrieve audio file: ${storageError?.message}`)
        }

        // Convert blob to File object for Whisper API using robust Buffer-based method
        const buffer = await audioData.arrayBuffer()
        const nodeBuffer = Buffer.from(buffer)
        
        // Optimize MIME detection - only read first 32 bytes
        const mimeType = getMimeTypeFromUrl(job.audio_url, nodeBuffer.slice(0, 32))
        const extension = job.audio_url.split('.').pop() || 'mp3'
        
        console.log(`Detected file type: ${mimeType} (${extension}) for note ${job.note_id}`)
        console.log(`File size: ${nodeBuffer.length} bytes`)
        
        // Use the more robust Buffer-based file creation for better OpenAI compatibility
        const audioFile = createServerFileFromBuffer(nodeBuffer, `${job.note_id}.${extension}`, mimeType)

        const { text: transcriptionResult, error: transcriptionError } = await transcribeAudio(audioFile)

        if (transcriptionError || !transcriptionResult) {
          throw new Error(`Transcription failed: ${transcriptionError?.message}`)
        }

        transcription = transcriptionResult

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

      // Step 3: Analyze transcription
      const { analysis, error: analysisError, warning } = await analyzeTranscription(
        transcription, 
        knowledgeContext,
        job.recorded_at
      )

      if (analysisError) {
        throw new Error(`Analysis failed: ${analysisError.message}`)
      }

      // Step 4: Update note with results and release lock
      await this.supabase
        .from('notes')
        .update({
          transcription,
          analysis,
          error_message: null,
          last_error_at: null
        })
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

      return {
        success: true,
        transcription,
        analysis,
        warning
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
      await this.supabase.rpc('release_processing_lock_with_error', { 
        p_note_id: noteId,
        p_error_message: errorMessage
      })
    } catch (error) {
      console.error(`Failed to release processing lock with error for note ${noteId}:`, error)
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
      // First, cleanup any abandoned processing locks
      await this.cleanupAbandonedLocks()
      
      // Use the updated database function that accounts for processing locks
      const { data: stats, error } = await this.supabase
        .rpc('get_processing_stats', { p_user_id: userId })

      if (error) {
        throw error
      }

      if (!stats || stats.length === 0) {
        return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 }
      }

      const result = stats[0]
      return {
        total: Number(result.total),
        pending: Number(result.pending),
        processing: Number(result.processing),
        completed: Number(result.completed),
        failed: Number(result.failed)
      }
    } catch (error) {
      console.error('Failed to get processing stats:', error)
      return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 }
    }
  }
}

// Singleton instance
export const processingService = new ProcessingService()