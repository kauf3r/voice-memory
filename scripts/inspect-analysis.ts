#!/usr/bin/env tsx
/**
 * Inspect Analysis Content
 * 
 * Check what's actually stored in the analysis field
 */

import { createServiceClient } from '../lib/supabase-server'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const NOTE_ID = 'c5ef6a45-f3e5-4e38-8370-ea32c2bf0204' // The 8-hour note

async function main() {
  console.log(`🔍 Inspecting Analysis for Note: ${NOTE_ID}`)
  
  const supabase = createServiceClient()
  
  try {
    const { data: note, error } = await supabase
      .from('notes')
      .select('analysis, transcription')
      .eq('id', NOTE_ID)
      .single()

    if (error || !note) {
      throw new Error(`Note not found: ${error?.message}`)
    }

    console.log('\n📊 Analysis Inspection:')
    console.log('==========================================')
    
    if (!note.analysis) {
      console.log('❌ No analysis found')
      return
    }

    console.log('✅ Analysis exists, structure:')
    console.log(JSON.stringify(note.analysis, null, 2))
    
    console.log('\n🔍 Key Fields:')
    console.log(`  sentiment: ${note.analysis.sentiment ? 'Present' : 'Missing'}`)
    console.log(`  focusTopics: ${note.analysis.focusTopics ? 'Present' : 'Missing'}`)
    console.log(`  tasks: ${note.analysis.tasks ? 'Present' : 'Missing'}`)
    console.log(`  keyIdeas: ${note.analysis.keyIdeas ? `Array(${note.analysis.keyIdeas.length})` : 'Missing'}`)
    console.log(`  messagesToDraft: ${note.analysis.messagesToDraft ? `Array(${note.analysis.messagesToDraft.length})` : 'Missing'}`)
    console.log(`  outreachIdeas: ${note.analysis.outreachIdeas ? `Array(${note.analysis.outreachIdeas.length})` : 'Missing'}`)
    
    if (note.analysis.tasks) {
      console.log('\n📋 Tasks Detail:')
      console.log(`  myTasks: ${note.analysis.tasks.myTasks ? `Array(${note.analysis.tasks.myTasks.length})` : 'Missing'}`)
      console.log(`  delegatedTasks: ${note.analysis.tasks.delegatedTasks ? `Array(${note.analysis.tasks.delegatedTasks.length})` : 'Missing'}`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

main().catch(console.error)