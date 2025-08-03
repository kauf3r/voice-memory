#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function quickCheck() {
  console.log('🔍 Quick Data Check\n')
  
  // Check for processed notes
  const { data: notes, error } = await supabase
    .from('notes')
    .select('id, user_id, analysis, recorded_at')
    .not('analysis', 'is', null)
    .limit(5)
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log(`Found ${notes?.length || 0} processed notes`)
  
  if (notes && notes.length > 0) {
    notes.forEach(note => {
      console.log(`Note ${note.id}: User ${note.user_id}`)
      if (note.analysis?.keyIdeas) {
        console.log(`  - ${note.analysis.keyIdeas.length} insights`)
      }
    })
  }
}

quickCheck()