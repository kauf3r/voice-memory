#!/usr/bin/env tsx
import { createServiceClient } from '../lib/supabase-server'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const NOTE_ID = 'a9b6beab-b264-490d-9df7-d10f608c879b'

async function resetNote() {
  console.log(`🔄 Resetting note: ${NOTE_ID}`)
  
  const supabase = createServiceClient()
  
  try {
    // Reset the note to allow reprocessing
    const { error: resetError } = await supabase
      .from('notes')
      .update({ 
        transcription: null,
        analysis: null,
        processed_at: null
      })
      .eq('id', NOTE_ID)

    if (resetError) {
      throw new Error(`Reset failed: ${resetError.message}`)
    }

    console.log('✅ Note reset successfully - ready for reprocessing')
    
    // Check status
    const { data: note } = await supabase
      .from('notes')
      .select('processed_at, transcription, analysis')
      .eq('id', NOTE_ID)
      .single()
    
    console.log('📊 Current status:', {
      processed: !!note?.processed_at,
      transcription: !!note?.transcription,
      analysis: !!note?.analysis
    })
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

resetNote().catch(console.error)