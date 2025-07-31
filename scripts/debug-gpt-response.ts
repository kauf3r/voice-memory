#!/usr/bin/env tsx
/**
 * Debug GPT-4 Raw Response
 * 
 * See what GPT-4 returns vs what validation saves
 */

import { analyzeTranscription } from '../lib/openai'
import { validateAnalysis } from '../lib/validation'
import { createServiceClient } from '../lib/supabase-server'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function main() {
  console.log('🧠 Debug GPT-4 Response vs Validation')
  
  const supabase = createServiceClient()
  
  try {
    // Get a note with transcription
    const { data: note, error } = await supabase
      .from('notes')
      .select('transcription')
      .eq('id', 'c5ef6a45-f3e5-4e38-8370-ea32c2bf0204')
      .single()

    if (error || !note?.transcription) {
      throw new Error('Note not found')
    }

    console.log('\n📝 Transcription preview:')
    console.log(note.transcription.substring(0, 200) + '...')
    
    // Temporarily patch validateAnalysis to see raw response
    const originalValidate = validateAnalysis
    let rawGptResponse: any = null
    
    const mockValidate = (raw: any) => {
      rawGptResponse = raw
      console.log('\n🤖 RAW GPT-4 RESPONSE:')
      console.log('====================================')
      console.log(JSON.stringify(raw, null, 2))
      
      // Run original validation
      const result = originalValidate(raw)
      
      console.log('\n✅ AFTER VALIDATION:')
      console.log('====================================')
      console.log('Success:', !!result.analysis)
      console.log('Error:', result.error)
      if (result.analysis) {
        console.log('Validated result:')
        console.log(JSON.stringify(result.analysis, null, 2))
      }
      
      return result
    }
    
    // Replace validation temporarily
    require('../lib/validation').validateAnalysis = mockValidate
    
    console.log('\n🚀 Testing analysis...')
    const result = await analyzeTranscription(
      note.transcription,
      '',
      new Date().toISOString()
    )
    
    if (result.error) {
      console.log('\n❌ Analysis failed:', result.error.message)
    } else {
      console.log('\n✅ Analysis completed successfully')
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error)
  }
}

main().catch(console.error)