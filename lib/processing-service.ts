import { createServiceClient } from './supabase-server'
import { transcribeAudio, analyzeTranscription } from './openai'

interface ProcessingJob {
  queue_id: string
  note_id: string
  user_id: string
  audio_url: string
  priority: number
  attempts: number
  recorded_at: string
}

export class ProcessingService {
  private supabase = createServiceClient()

  async processNextBatch(batchSize: number = 5): Promise<{
    processed: number
    failed: number
    errors: string[]
  }> {
    console.log(`Starting batch processing (max ${batchSize} items)`)

    try {
      // Get notes that need processing (no processed_at timestamp)
      const { data: notes, error: notesError } = await this.supabase
        .from('notes')
        .select('id, user_id, audio_url, transcription, analysis, processed_at, recorded_at')
        .not('audio_url', 'is', null)
        .is('processed_at', null)
        .order('created_at', { ascending: true })
        .limit(batchSize)

      if (notesError) {
        throw new Error(`Failed to get notes: ${notesError.message}`)
      }

      if (!notes || notes.length === 0) {
        console.log('No notes to process')
        return { processed: 0, failed: 0, errors: [] }
      }

      console.log(`Got ${notes.length} notes to process`)

      let processed = 0
      let failed = 0
      const errors: string[] = []

      // Process notes sequentially to avoid rate limiting
      for (const note of notes) {
        // Convert note to job format
        const job: ProcessingJob & { transcription?: string } = {
          queue_id: note.id, // Use note ID as queue ID for now
          note_id: note.id,
          user_id: note.user_id,
          audio_url: note.audio_url,
          transcription: note.transcription, // Pass existing transcription
          priority: 1,
          attempts: 0
        }
        try {
          await this.processJob(job)
          processed++
          console.log(`Successfully processed note ${job.note_id}`)
        } catch (error) {
          failed++
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          errors.push(`Note ${note.id}: ${errorMessage}`)
          console.error(`Failed to process note ${note.id}:`, error)
          
          // Note: Queue marking disabled since we're not using processing queue
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

  private async processJob(job: ProcessingJob & { transcription?: string }): Promise<void> {
    console.log(`Processing job ${job.queue_id} for note ${job.note_id}`)

    let transcription = job.transcription

    // Step 1: Transcribe audio (skip if transcription already exists)
    if (!transcription) {
      // Get audio file from storage
      const filePath = this.getFilePathFromUrl(job.audio_url)
      const { data: audioData, error: storageError } = await this.supabase.storage
        .from('audio-files')
        .download(filePath)

      if (storageError || !audioData) {
        throw new Error(`Could not retrieve audio file: ${storageError?.message}`)
      }

      // Convert blob to File object for Whisper API
      // Detect actual file type from content and use appropriate MIME type
      const buffer = await audioData.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      
      let mimeType = 'audio/mpeg'
      let extension = '.mp3'
      
      // Check file signature/magic bytes
      if (bytes.length >= 8) {
        // Check for M4A/MP4 format (starts with ftyp box)
        if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
          mimeType = 'audio/mp4'
          extension = '.m4a'
        }
        // Check for MP3 format (ID3 tag or MPEG frame sync)
        else if ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || // ID3v2
                 (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0)) { // MPEG frame sync
          mimeType = 'audio/mpeg'
          extension = '.mp3'
        }
        // Check for WAV format
        else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
          mimeType = 'audio/wav'
          extension = '.wav'
        }
      }
      
      console.log(`Detected file type: ${mimeType} (${extension}) for note ${job.note_id}`)
      const audioFile = new File([audioData], `${job.note_id}${extension}`, { type: mimeType })

      const { text: transcriptionResult, error: transcriptionError } = await transcribeAudio(audioFile)

      if (transcriptionError || !transcriptionResult) {
        throw new Error(`Transcription failed: ${transcriptionError?.message}`)
      }

      transcription = transcriptionResult
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
      // Save transcription but DON'T mark as processed if analysis failed
      await this.supabase
        .from('notes')
        .update({
          transcription
          // Note: NOT setting processed_at since analysis failed
        })
        .eq('id', job.note_id)

      throw new Error(`Analysis failed: ${analysisError.message}`)
    }

    // Step 4: Update note with results
    const { error: updateError } = await this.supabase
      .from('notes')
      .update({
        transcription,
        analysis,
        processed_at: new Date().toISOString(),
      })
      .eq('id', job.note_id)

    if (updateError) {
      throw new Error(`Failed to save results: ${updateError.message}`)
    }

    // Step 5: Update project knowledge if needed
    if (analysis?.crossReferences?.projectKnowledgeUpdates?.length > 0) {
      await this.updateProjectKnowledge(job.user_id, analysis.crossReferences.projectKnowledgeUpdates)
    }

    if (warning) {
      console.warn(`Processing completed with warning for note ${job.note_id}: ${warning}`)
    }
  }

  private async markJobFailed(queueId: string, errorMessage: string): Promise<void> {
    try {
      await this.supabase.rpc('mark_processing_failed', {
        queue_id_param: queueId,
        error_msg: errorMessage
      })
    } catch (error) {
      console.error('Failed to mark job as failed:', error)
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

  private getFilePathFromUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      const pathParts = urlObj.pathname.split('/')
      const bucketIndex = pathParts.indexOf('audio-files')
      if (bucketIndex === -1) return ''
      
      return pathParts.slice(bucketIndex + 1).join('/')
    } catch (error) {
      console.error('Error extracting file path from URL:', url, error)
      return ''
    }
  }

  async resetStuckProcessing(forceReset: boolean = false): Promise<{ reset: number }> {
    try {
      let stuckNotes
      
      if (forceReset) {
        // Force reset ALL unprocessed notes
        console.log('Force resetting all unprocessed notes...')
        const { data, error } = await this.supabase
          .from('notes')
          .select('id')
          .is('processed_at', null)
          .not('audio_url', 'is', null)
        
        stuckNotes = data
      } else {
        // Find notes that might be stuck in processing
        // (have transcription but no analysis and no processed_at after 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
        
        const { data, error } = await this.supabase
          .from('notes')
          .select('id, created_at, transcription, analysis')
          .is('processed_at', null)
          .not('audio_url', 'is', null)
          .or('transcription.not.is.null,updated_at.lt.' + fiveMinutesAgo)
        
        stuckNotes = data
      }

      if (!stuckNotes || stuckNotes.length === 0) {
        console.log('No stuck notes found')
        return { reset: 0 }
      }

      console.log(`Found ${stuckNotes.length} stuck notes, resetting for retry...`)
      
      // Reset both transcription and analysis to null for a clean retry
      const { error: resetError } = await this.supabase
        .from('notes')
        .update({ 
          transcription: null,
          analysis: null
        })
        .in('id', stuckNotes.map(n => n.id))

      if (resetError) {
        console.error('Error resetting stuck notes:', resetError)
        return { reset: 0 }
      }

      console.log(`Successfully reset ${stuckNotes.length} notes`)
      return { reset: stuckNotes.length }
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
      // First, reset any stuck processing
      await this.resetStuckProcessing()
      
      // Get all notes for the user
      const { data: notes, error } = await this.supabase
        .from('notes')
        .select('transcription, analysis, processed_at, created_at')
        .eq('user_id', userId)

      if (error) {
        throw error
      }

      if (!notes) {
        return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 }
      }

      const total = notes.length
      let pending = 0
      let processing = 0
      let completed = 0
      let failed = 0

      notes.forEach(note => {
        if (note.processed_at) {
          // Has processed_at timestamp = completed
          completed++
        } else if (!note.transcription) {
          // No transcription yet = pending
          pending++
        } else if (note.transcription && !note.analysis) {
          // Has transcription but no analysis = processing
          processing++
        } else {
          // Should not happen, but count as pending
          pending++
        }
      })

      return {
        total,
        pending,
        processing,
        completed,
        failed
      }
    } catch (error) {
      console.error('Failed to get processing stats:', error)
      return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 }
    }
  }
}

// Singleton instance
export const processingService = new ProcessingService()