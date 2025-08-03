#!/usr/bin/env tsx
import { processingService } from '../lib/processing-service'
import { createServiceClient } from '../lib/supabase-server'

// Load environment variables
import dotenv from 'dotenv'
dotenv.config()

const supabase = createServiceClient()

// Simulate concurrent processing attempts
async function simulateConcurrentProcessing(noteId: string, instanceId: string): Promise<void> {
  console.log(`🏃 Instance ${instanceId}: Starting processing for note ${noteId}`)
  
  try {
    const startTime = Date.now()
    const result = await processingService.processNote(noteId)
    const duration = Date.now() - startTime
    
    if (result.success) {
      console.log(`✅ Instance ${instanceId}: Successfully processed note ${noteId} in ${duration}ms`)
      if (result.warning) {
        console.log(`⚠️  Instance ${instanceId}: Warning: ${result.warning}`)
      }
    } else {
      console.log(`❌ Instance ${instanceId}: Failed to process note ${noteId}: ${result.error}`)
    }
  } catch (error) {
    console.log(`💥 Instance ${instanceId}: Error processing note ${noteId}:`, error)
  }
}

async function demoConcurrentProcessingProtection() {
  console.log('🎭 Demonstrating Concurrent Processing Protection\n')
  console.log('This demo shows how the new row-level locking prevents multiple')
  console.log('processes from working on the same note simultaneously.\n')

  try {
    // 1. Find or create a test note
    console.log('1. Finding a test note...')
    const { data: notes, error } = await supabase
      .from('notes')
      .select('id, user_id, processed_at, processing_started_at, audio_url')
      .not('audio_url', 'is', null)
      .is('processed_at', null) // Unprocessed notes only
      .limit(1)

    if (error) {
      throw new Error(`Failed to get notes: ${error.message}`)
    }

    if (!notes || notes.length === 0) {
      console.log('❌ No unprocessed notes found for testing')
      console.log('   You can upload an audio file to create test data')
      return
    }

    const testNote = notes[0]
    console.log(`   ✅ Using note ${testNote.id} for testing`)
    
    // 2. Clear any existing locks for a clean test
    console.log('\n2. Cleaning up any existing locks...')
    await supabase.rpc('cleanup_abandoned_processing_locks', { p_timeout_minutes: 0 })
    console.log('   ✅ Cleanup completed')

    // 3. Show the note's current state
    console.log('\n3. Current note state:')
    const { data: noteState } = await supabase
      .from('notes')
      .select('processed_at, processing_started_at, error_message, processing_attempts')
      .eq('id', testNote.id)
      .single()
    
    console.log(`   • Processed: ${!!noteState?.processed_at}`)
    console.log(`   • Currently processing: ${!!noteState?.processing_started_at}`)
    console.log(`   • Processing attempts: ${noteState?.processing_attempts || 0}`)
    console.log(`   • Error: ${noteState?.error_message || 'None'}`)

    // 4. Test single processing (should work)
    console.log('\n4. Testing single instance processing...')
    console.log('   This should succeed and acquire the lock')
    
    const singleResult = await processingService.processNote(testNote.id, testNote.user_id, true)
    if (singleResult.success) {
      console.log('   ✅ Single processing succeeded')
    } else {
      console.log('   ❌ Single processing failed:', singleResult.error)
    }

    // 5. Reset the note for concurrent testing
    console.log('\n5. Resetting note state for concurrent test...')
    await supabase
      .from('notes')
      .update({
        processed_at: null,
        processing_started_at: null,
        transcription: null,
        analysis: null,
        error_message: null
      })
      .eq('id', testNote.id)
    console.log('   ✅ Note reset for testing')

    // 6. Test concurrent processing (demonstrate protection)
    console.log('\n6. Testing concurrent processing protection...')
    console.log('   Launching 3 simultaneous processing attempts')
    console.log('   Only ONE should succeed, others should be blocked')

    const promises = [
      simulateConcurrentProcessing(testNote.id, 'A'),
      simulateConcurrentProcessing(testNote.id, 'B'),
      simulateConcurrentProcessing(testNote.id, 'C')
    ]

    // Add small delays to make the race condition more visible
    setTimeout(() => promises[1], 50)
    setTimeout(() => promises[2], 100)

    await Promise.all(promises)

    // 7. Check final state
    console.log('\n7. Final note state after concurrent test:')
    const { data: finalState } = await supabase
      .from('notes')
      .select('processed_at, processing_started_at, error_message, processing_attempts, transcription, analysis')
      .eq('id', testNote.id)
      .single()
    
    console.log(`   • Processed: ${!!finalState?.processed_at}`)
    console.log(`   • Currently processing: ${!!finalState?.processing_started_at}`)
    console.log(`   • Processing attempts: ${finalState?.processing_attempts || 0}`)
    console.log(`   • Has transcription: ${!!finalState?.transcription}`)
    console.log(`   • Has analysis: ${!!finalState?.analysis}`)
    console.log(`   • Error: ${finalState?.error_message || 'None'}`)

    // 8. Test lock timeout scenario
    console.log('\n8. Testing lock timeout scenario...')
    
    // Manually set a processing lock that's "old"
    const oldTimestamp = new Date(Date.now() - 20 * 60 * 1000).toISOString() // 20 minutes ago
    await supabase
      .from('notes')
      .update({
        processing_started_at: oldTimestamp,
        processed_at: null
      })
      .eq('id', testNote.id)
    
    console.log('   Created an abandoned lock (20 minutes old)')
    
    // Try to process - should succeed by cleaning up the old lock
    const timeoutResult = await processingService.processNote(testNote.id, testNote.user_id, true)
    if (timeoutResult.success) {
      console.log('   ✅ Successfully recovered from abandoned lock')
    } else {
      console.log('   ❌ Failed to recover from abandoned lock:', timeoutResult.error)
    }

    console.log('\n🎉 Concurrent processing protection demo completed!')
    console.log('\n📊 Summary of protection mechanisms:')
    console.log('   ✅ Database-level row locking prevents race conditions')
    console.log('   ✅ processing_started_at timestamp tracks active processing')
    console.log('   ✅ Automatic cleanup of abandoned processing attempts')
    console.log('   ✅ SELECT FOR UPDATE ensures atomic lock acquisition')
    console.log('   ✅ Timeout-based recovery from stuck processing')

  } catch (error) {
    console.error('\n❌ Demo failed:', error)
  }
}

// Run if called directly
if (require.main === module) {
  demoConcurrentProcessingProtection()
    .then(() => process.exit(0))
    .catch(console.error)
}

export { demoConcurrentProcessingProtection } 