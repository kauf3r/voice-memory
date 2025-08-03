#!/usr/bin/env tsx
import { createServiceClient } from '../lib/supabase-server'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const NOTE_ID = 'a9b6beab-b264-490d-9df7-d10f608c879b'

async function processNote() {
  console.log(`🔄 Force processing note: ${NOTE_ID}`)
  
  const supabase = createServiceClient()
  
  try {
    // Get the note first to verify it exists
    const { data: note, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', NOTE_ID)
      .single()

    if (error || !note) {
      throw new Error(`Note not found: ${error?.message}`)
    }

    console.log(`📝 Note found: ${note.audio_url}`)
    
    // Call the processing API directly
    const response = await fetch('http://localhost:3000/api/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'X-Service-Auth': 'true'
      },
      body: JSON.stringify({ 
        noteId: NOTE_ID,
        forceReprocess: true 
      })
    })
    
    const result = await response.json()
    
    if (result.success) {
      console.log('✅ Processing completed successfully')
      console.log(`📊 Analysis: ${result.note.analysis ? 'Present' : 'Missing'}`)
    } else {
      console.error('❌ Processing failed:', result.error)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

processNote().catch(console.error)