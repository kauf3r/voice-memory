#!/usr/bin/env tsx
/**
 * Quick Stuck Note Check
 * 
 * Fast check for stuck notes without processing
 */

import { createServiceClient } from '../lib/supabase-server'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

async function main() {
  console.log('🔍 Quick Stuck Note Check\n')
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase configuration')
    process.exit(1)
  }

  const supabase = createServiceClient()
  
  try {
    // Get notes with various stuck states
    const { data: notes, error } = await supabase
      .from('notes')
      .select('id, created_at, transcription, analysis, processed_at, audio_url')
      .not('audio_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      throw error
    }

    if (!notes || notes.length === 0) {
      console.log('✅ No notes found')
      return
    }

    console.log(`📊 Recent ${notes.length} notes status:`)
    console.log('=' * 60)
    
    notes.forEach((note, index) => {
      const age = Math.round((Date.now() - new Date(note.created_at).getTime()) / (1000 * 60 * 60))
      const hasTranscription = !!note.transcription
      const hasAnalysis = !!note.analysis
      const isProcessed = !!note.processed_at
      
      let status = '🔴 STUCK'
      if (hasTranscription && hasAnalysis) {
        status = '✅ Complete'
      } else if (hasTranscription && !hasAnalysis) {
        status = '🟡 Analysis Missing'
      } else if (!hasTranscription && !hasAnalysis && !isProcessed) {
        status = '⏳ Processing'
      } else if (!hasTranscription && !hasAnalysis && isProcessed) {
        status = '🔴 FAILED (phantom processed)'
      }
      
      console.log(`${index + 1}. ${note.id.substring(0, 8)}... | ${age}h ago | ${status}`)
      console.log(`   Trans: ${hasTranscription ? '✅' : '❌'} | Analysis: ${hasAnalysis ? '✅' : '❌'} | Processed: ${isProcessed ? '✅' : '❌'}`)
      console.log('')
    })
    
    // Find actually stuck notes (old + no transcription)
    const stuckNotes = notes.filter(note => {
      const ageHours = (Date.now() - new Date(note.created_at).getTime()) / (1000 * 60 * 60)
      return ageHours > 1 && !note.transcription && !note.processed_at
    })
    
    if (stuckNotes.length > 0) {
      console.log(`⚠️  Found ${stuckNotes.length} truly stuck notes (>1h old, no transcription):`)
      stuckNotes.forEach(note => {
        const age = Math.round((Date.now() - new Date(note.created_at).getTime()) / (1000 * 60 * 60))
        console.log(`   - ${note.id.substring(0, 8)}... (${age}h old)`)
      })
      console.log(`\n💡 Run: npx tsx scripts/reset-stuck-processing.ts --force`)
    } else {
      console.log('✅ No truly stuck notes found!')
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

main().catch(console.error)