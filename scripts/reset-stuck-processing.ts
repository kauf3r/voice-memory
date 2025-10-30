#!/usr/bin/env tsx
/**
 * Reset Stuck Processing Jobs
 * 
 * This script resets all stuck notes in the processing queue.
 * Use with caution - it will reset ALL unprocessed notes.
 * 
 * Usage: tsx scripts/reset-stuck-processing.ts [--force]
 */

import { createServiceClient } from '../lib/supabase-server'
import { processingService } from '../lib/processing/ProcessingService'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const isForce = process.argv.includes('--force')

async function main() {
  console.log('🔧 Voice Memory - Reset Stuck Processing Jobs\n')
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase configuration in .env.local file')
    process.exit(1)
  }

  const supabase = createServiceClient()
  
  try {
    // First, get current stats
    console.log('📊 Checking current processing status...')
    const { data: notes, error } = await supabase
      .from('notes')
      .select('id, created_at, transcription, analysis, processed_at, audio_url')
      .not('audio_url', 'is', null)
      .is('processed_at', null)
      .order('created_at', { ascending: true })

    if (error) {
      throw error
    }

    if (!notes || notes.length === 0) {
      console.log('✅ No stuck notes found!')
      process.exit(0)
    }

    console.log(`\n🔍 Found ${notes.length} unprocessed notes:`)
    notes.forEach((note, index) => {
      const status = note.transcription 
        ? (note.analysis ? 'Has transcription and analysis' : 'Has transcription, missing analysis')
        : 'Missing transcription'
      console.log(`   ${index + 1}. Note ${note.id.substring(0, 8)}... - ${status}`)
    })

    if (!isForce) {
      console.log('\n⚠️  To reset these notes, run with --force flag:')
      console.log('   tsx scripts/reset-stuck-processing.ts --force')
      process.exit(0)
    }

    // Reset the notes
    console.log('\n🔄 Resetting stuck notes...')
    const result = await processingService.resetStuckProcessing(true)
    
    if (result.reset > 0) {
      console.log(`✅ Successfully reset ${result.reset} notes`)
      
      // Now trigger batch processing
      console.log('\n🚀 Triggering batch processing...')
      const processResult = await processingService.processNextBatch(5)
      
      console.log(`\n📋 Processing results:`)
      console.log(`   ✅ Processed: ${processResult.processed}`)
      console.log(`   ❌ Failed: ${processResult.failed}`)
      
      if (processResult.errors.length > 0) {
        console.log('\n⚠️  Errors:')
        processResult.errors.forEach(err => console.log(`   - ${err}`))
      }
    } else {
      console.log('❌ Failed to reset notes')
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  }
}

main().catch(console.error)