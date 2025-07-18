import { createServiceClient } from './supabase-server'
import { transcribeAudio, analyzeTranscription } from './openai'

interface ProcessingJob {
  queue_id: string
  note_id: string
  user_id: string
  audio_url: string
  priority: number
  attempts: number
}

export class ProcessingService {
  private supabase = createServiceClient()
  private isProcessing = false

  async processNextBatch(batchSize: number = 5): Promise<{
    processed: number
    failed: number
    errors: string[]
  }> {
    if (this.isProcessing) {
      console.log('Processing already in progress, skipping...')
      return { processed: 0, failed: 0, errors: ['Processing already in progress'] }
    }

    this.isProcessing = true
    console.log(`Starting batch processing (max ${batchSize} items)`)

    try {
      // Get next notes to process
      const { data: jobs, error: jobError } = await this.supabase
        .rpc('get_next_notes_to_process', { batch_size: batchSize })

      if (jobError) {
        throw new Error(`Failed to get processing jobs: ${jobError.message}`)
      }

      if (!jobs || jobs.length === 0) {
        console.log('No notes to process')
        return { processed: 0, failed: 0, errors: [] }
      }

      console.log(`Got ${jobs.length} notes to process`)

      let processed = 0
      let failed = 0
      const errors: string[] = []

      // Process jobs sequentially to avoid rate limiting
      for (const job of jobs as ProcessingJob[]) {
        try {
          await this.processJob(job)
          processed++
          console.log(`Successfully processed note ${job.note_id}`)
        } catch (error) {
          failed++
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          errors.push(`Note ${job.note_id}: ${errorMessage}`)
          console.error(`Failed to process note ${job.note_id}:`, error)
          
          // Mark as failed in queue
          await this.markJobFailed(job.queue_id, errorMessage)
        }

        // Small delay between jobs to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

      console.log(`Batch processing completed: ${processed} successful, ${failed} failed`)
      return { processed, failed, errors }

    } finally {
      this.isProcessing = false
    }
  }

  private async processJob(job: ProcessingJob): Promise<void> {
    console.log(`Processing job ${job.queue_id} for note ${job.note_id}`)

    // Get audio file from storage
    const filePath = this.getFilePathFromUrl(job.audio_url)
    const { data: audioData, error: storageError } = await this.supabase.storage
      .from('audio-files')
      .download(filePath)

    if (storageError || !audioData) {
      throw new Error(`Could not retrieve audio file: ${storageError?.message}`)
    }

    // Convert blob to File object for Whisper API
    const audioFile = new File([audioData], `${job.note_id}.mp3`, { type: 'audio/mpeg' })

    // Step 1: Transcribe audio
    const { text: transcription, error: transcriptionError } = await transcribeAudio(audioFile)

    if (transcriptionError || !transcription) {
      throw new Error(`Transcription failed: ${transcriptionError?.message}`)
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
      knowledgeContext
    )

    if (analysisError) {
      // Save transcription even if analysis failed
      await this.supabase
        .from('notes')
        .update({
          transcription,
          processed_at: new Date().toISOString(),
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

  async getProcessingStats(userId: string): Promise<{
    total: number
    pending: number
    processing: number
    completed: number
    failed: number
  }> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_processing_stats', { user_id_param: userId })

      if (error) {
        throw error
      }

      const stats = data?.[0] || {
        total_notes: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0
      }

      return {
        total: stats.total_notes,
        pending: stats.pending,
        processing: stats.processing,
        completed: stats.completed,
        failed: stats.failed
      }
    } catch (error) {
      console.error('Failed to get processing stats:', error)
      return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 }
    }
  }
}

// Singleton instance
export const processingService = new ProcessingService()