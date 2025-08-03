#!/usr/bin/env tsx
/**
 * Debug Analysis Issues
 * 
 * Test analysis on a specific note to see what's failing
 */

import { createServiceClient } from '../lib/supabase-server'
import { analyzeTranscription } from '../lib/openai'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const NOTE_ID = 'c5ef6a45-f3e5-4e38-8370-ea32c2bf0204' // The 8-hour stuck note

async function main() {
  console.log(`🔍 Debug Analysis for Note: ${NOTE_ID}`)
  
  const supabase = createServiceClient()
  
  try {
    // Get the note with transcription
    const { data: note, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', NOTE_ID)
      .single()

    if (error || !note) {
      throw new Error(`Note not found: ${error?.message}`)
    }

    console.log(`📝 Note status:`)
    console.log(`   Transcription: ${note.transcription ? `${note.transcription.length} chars` : 'Missing'}`)
    console.log(`   Analysis: ${note.analysis ? 'Present' : 'Missing'}`)
    console.log(`   Processed: ${note.processed_at ? 'Yes' : 'No'}`)

    if (!note.transcription) {
      console.log('❌ No transcription to analyze')
      return
    }

    console.log('\n🧠 Testing AI analysis...')
    console.log(`📊 Transcription preview: "${note.transcription.substring(0, 200)}..."`)
    
    // Test the analysis
    const startTime = Date.now()
    const result = await analyzeTranscription(
      note.transcription,
      '', // No knowledge context for test
      note.recorded_at
    )
    const duration = Date.now() - startTime

    console.log(`\n⏱️  Analysis took: ${duration}ms`)
    
    if (result.error) {
      console.log('❌ Analysis failed:', result.error.message)
    } else {
      console.log('✅ Analysis succeeded!')
      console.log(`📋 Result size: ${JSON.stringify(result.analysis).length} chars`)
      
      // Try to save it
      const { error: saveError } = await supabase
        .from('notes')
        .update({
          analysis: result.analysis,
          processed_at: new Date().toISOString()
        })
        .eq('id', NOTE_ID)

      if (saveError) {
        console.log('❌ Save failed:', saveError.message)
      } else {
        console.log('✅ Analysis saved to database!')
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

main().catch(console.error)