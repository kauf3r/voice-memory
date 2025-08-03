#!/usr/bin/env tsx
/**
 * Force Reset Single Stuck Note
 */

import { createServiceClient } from '../lib/supabase-server'
import { processingService } from '../lib/processing/ProcessingService'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const NOTE_ID = 'c5ef6a45-f3e5-4e38-8370-ea32c2bf0204'

async function main() {
  console.log(`🎯 Force Reset Single Note: ${NOTE_ID}`)
  
  const supabase = createServiceClient()
  
  try {
    // Reset the specific stuck note
    console.log('🔄 Resetting stuck note...')
    const { error: resetError } = await supabase
      .from('notes')
      .update({ 
        transcription: null,
        analysis: null
      })
      .eq('id', NOTE_ID)

    if (resetError) {
      throw resetError
    }

    console.log('✅ Note reset successfully!')
    
    // Now try to process it
    console.log('🚀 Processing the note...')
    const result = await processingService.processNextBatch(1)
    
    console.log(`📋 Results:`)
    console.log(`   ✅ Processed: ${result.processed}`)
    console.log(`   ❌ Failed: ${result.failed}`)
    
    if (result.errors.length > 0) {
      console.log('\n⚠️  Errors:')
      result.errors.forEach(err => console.log(`   - ${err}`))
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

main().catch(console.error)