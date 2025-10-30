#!/usr/bin/env tsx
/**
 * Debug Validation Issues
 * 
 * See what GPT-4 returns vs what validation expects
 */

import { createServiceClient } from '../lib/supabase-server'
import { analyzeTranscription } from '../lib/openai'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const NOTE_ID = '4f4f0eb6-d75d-4cb2-a3e1-b4f1c3b89357'

async function main() {
  console.log(`🔍 Debug Validation for Note: ${NOTE_ID}`)
  
  const supabase = createServiceClient()
  
  try {
    // Get the note with transcription
    const { data: note, error } = await supabase
      .from('notes')
      .select('transcription')
      .eq('id', NOTE_ID)
      .single()

    if (error || !note?.transcription) {
      throw new Error(`Note or transcription not found`)
    }

    console.log('\n🧠 Testing analysis without validation...')
    
    // Patch the analyzeTranscription to see raw response
    const originalValidate = require('../lib/validation').validateAnalysis
    
    // Mock validation to return raw response
    require('../lib/validation').validateAnalysis = (raw: any) => {
      console.log('\n📄 RAW GPT-4 RESPONSE:')
      console.log(JSON.stringify(raw, null, 2))
      
      // Try original validation
      const result = originalValidate(raw)
      console.log('\n🔍 VALIDATION RESULT:')
      console.log('Success:', !!result.analysis)
      console.log('Error:', result.error)
      
      return result
    }
    
    const result = await analyzeTranscription(
      note.transcription,
      '',
      new Date().toISOString()
    )
    
    if (result.error) {
      console.log('\n❌ Analysis failed:', result.error.message)
    } else {
      console.log('\n✅ Analysis succeeded after validation!')
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error)
  }
}

main().catch(console.error)