#!/usr/bin/env tsx
import { createServiceClient } from '../lib/supabase-server'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function check() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('notes')
    .select('id, processed_at, transcription, analysis')
    .order('created_at', { ascending: false })
    .limit(3)
  
  console.log('Recent notes:')
  data?.forEach(note => {
    const hasProcessed = !!note.processed_at
    const hasTranscription = !!note.transcription
    const hasAnalysis = !!note.analysis
    console.log(`- ${note.id}: processed=${hasProcessed}, transcription=${hasTranscription}, analysis=${hasAnalysis}`)
  })
}

check().catch(console.error)