#!/usr/bin/env tsx
import { transcribeAudio, analyzeTranscription } from '../lib/openai'
import { createServiceClient } from '../lib/supabase-server'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const NOTE_ID = 'a9b6beab-b264-490d-9df7-d10f608c879b'

async function processNote() {
  console.log(`🔄 Manually processing note: ${NOTE_ID}`)
  
  const supabase = createServiceClient()
  
  try {
    // Get the note
    const { data: note, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', NOTE_ID)
      .single()

    if (error || !note) {
      throw new Error(`Note not found: ${error?.message}`)
    }

    console.log(`📝 Note found: ${note.audio_url}`)
    
    if (note.processed_at) {
      console.log('⚠️  Note already processed, forcing reprocess...')
    }

    // Get audio file from storage
    const { data: audioData, error: storageError } = await supabase.storage
      .from('audio-files')
      .download(getFilePathFromUrl(note.audio_url))

    if (storageError || !audioData) {
      throw new Error(`Could not retrieve audio file: ${storageError?.message}`)
    }

    // Convert to File object
    const mimeType = getMimeTypeFromUrl(note.audio_url)
    const extension = note.audio_url.split('.').pop() || 'mp3'
    const audioFile = new File([audioData], `audio.${extension}`, { type: mimeType })

    console.log('🎙️  Starting transcription...')
    const { text: transcription, error: transcriptionError } = await transcribeAudio(audioFile)

    if (transcriptionError || !transcription) {
      throw new Error(`Transcription failed: ${transcriptionError?.message}`)
    }

    console.log('✅ Transcription completed')
    console.log(`📝 Preview: ${transcription.substring(0, 100)}...`)

    // Get project knowledge
    const { data: projectKnowledge } = await supabase
      .from('project_knowledge')
      .select('content')
      .eq('user_id', note.user_id)
      .single()

    const knowledgeContext = projectKnowledge?.content ? 
      JSON.stringify(projectKnowledge.content) : 
      ''

    console.log('🧠 Starting analysis...')
    const { analysis, error: analysisError } = await analyzeTranscription(
      transcription, 
      knowledgeContext,
      note.recorded_at
    )

    if (analysisError) {
      console.error('❌ Analysis failed:', analysisError.message)
      
      // Save transcription anyway
      await supabase
        .from('notes')
        .update({
          transcription,
          processed_at: new Date().toISOString(),
        })
        .eq('id', NOTE_ID)
      
      console.log('💾 Saved transcription, but analysis failed')
      return
    }

    console.log('✅ Analysis completed')
    console.log(`📊 Analysis preview:`, {
      sentiment: analysis?.sentiment?.classification,
      primaryTopic: analysis?.focusTopics?.primary,
      keyIdeasCount: analysis?.keyIdeas?.length || 0
    })

    // Save results
    const { error: updateError } = await supabase
      .from('notes')
      .update({
        transcription,
        analysis,
        processed_at: new Date().toISOString(),
      })
      .eq('id', NOTE_ID)

    if (updateError) {
      throw new Error(`Failed to save results: ${updateError.message}`)
    }

    console.log('💾 Successfully saved all results')
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

function getFilePathFromUrl(url: string): string {
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

function getMimeTypeFromUrl(url: string): string {
  const extension = url.split('.').pop()?.toLowerCase()
  const mimeTypes: Record<string, string> = {
    'mp3': 'audio/mpeg',
    'm4a': 'audio/mp4',
    'wav': 'audio/wav',
    'aac': 'audio/aac',
    'ogg': 'audio/ogg',
    'webm': 'audio/webm',
    'mp4': 'audio/mp4'
  }
  return mimeTypes[extension || ''] || 'audio/mpeg'
}

processNote().catch(console.error)