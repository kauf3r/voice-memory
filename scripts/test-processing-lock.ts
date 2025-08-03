#!/usr/bin/env tsx
import { processingService } from '../lib/processing/ProcessingService'
import { createServiceClient } from '../lib/supabase-server'

// Load environment variables
import dotenv from 'dotenv'
dotenv.config()

const supabase = createServiceClient()

async function testProcessingLock() {
  console.log('🧪 Testing processing lock functionality...\n')

  try {
    // 1. Get a test note (or create one for testing)
    console.log('1. Looking for test notes...')
    const { data: notes, error } = await supabase
      .from('notes')
      .select('id, user_id, processed_at, processing_started_at, error_message')
      .not('audio_url', 'is', null)
      .limit(3)

    if (error) {
      throw new Error(`Failed to get notes: ${error.message}`)
    }

    if (!notes || notes.length === 0) {
      console.log('❌ No notes found for testing')
      return
    }

    console.log(`   Found ${notes.length} notes for testing`)
    notes.forEach(note => {
      console.log(`   • Note ${note.id}: processed=${!!note.processed_at}, processing=${!!note.processing_started_at}`)
    })

    // 2. Test lock acquisition
    console.log('\n2. Testing lock acquisition...')
    const testNote = notes[0]
    
    const { data: lockResult1, error: lockError1 } = await supabase
      .rpc('acquire_processing_lock', { 
        p_note_id: testNote.id,
        p_lock_timeout_minutes: 15 
      })

    if (lockError1) {
      console.error('❌ Error acquiring lock:', lockError1)
    } else {
      console.log(`   ✅ First lock attempt: ${lockResult1 ? 'SUCCESS' : 'FAILED'}`)
    }

    // 3. Test concurrent lock attempt (should fail)
    console.log('\n3. Testing concurrent lock protection...')
    const { data: lockResult2, error: lockError2 } = await supabase
      .rpc('acquire_processing_lock', { 
        p_note_id: testNote.id,
        p_lock_timeout_minutes: 15 
      })

    if (lockError2) {
      console.error('❌ Error on second lock attempt:', lockError2)
    } else {
      console.log(`   ✅ Second lock attempt (should fail): ${lockResult2 ? 'UNEXPECTED SUCCESS' : 'CORRECTLY FAILED'}`)
    }

    // 4. Test cleanup function
    console.log('\n4. Testing cleanup function...')
    const { data: cleanupResult, error: cleanupError } = await supabase
      .rpc('cleanup_abandoned_processing_locks', { p_timeout_minutes: 0 }) // Force cleanup

    if (cleanupError) {
      console.error('❌ Error during cleanup:', cleanupError)
    } else {
      console.log(`   ✅ Cleanup completed, cleaned up: ${cleanupResult?.[0]?.cleaned_count || 0} locks`)
    }

    // 5. Test lock acquisition after cleanup
    console.log('\n5. Testing lock acquisition after cleanup...')
    const { data: lockResult3, error: lockError3 } = await supabase
      .rpc('acquire_processing_lock', { 
        p_note_id: testNote.id,
        p_lock_timeout_minutes: 15 
      })

    if (lockError3) {
      console.error('❌ Error acquiring lock after cleanup:', lockError3)
    } else {
      console.log(`   ✅ Lock after cleanup: ${lockResult3 ? 'SUCCESS' : 'FAILED'}`)
    }

    // 6. Test proper lock release
    console.log('\n6. Testing lock release...')
    const { error: releaseError } = await supabase
      .rpc('release_processing_lock', { p_note_id: testNote.id })

    if (releaseError) {
      console.error('❌ Error releasing lock:', releaseError)
    } else {
      console.log('   ✅ Lock released successfully')
    }

    // 7. Test get_next_notes_for_processing
    console.log('\n7. Testing get_next_notes_for_processing...')
    const { data: availableNotes, error: availableError } = await supabase
      .rpc('get_next_notes_for_processing', { 
        p_user_id: null,
        p_limit: 2,
        p_lock_timeout_minutes: 15
      })

    if (availableError) {
      console.error('❌ Error getting available notes:', availableError)
    } else {
      console.log(`   ✅ Found ${availableNotes?.length || 0} notes available for processing`)
    }

    // 8. Test processing stats
    console.log('\n8. Testing enhanced processing stats...')
    if (notes.length > 0) {
      const userId = notes[0].user_id
      const stats = await processingService.getProcessingStats(userId)
      console.log('   ✅ Processing stats:', stats)
    }

    console.log('\n🎉 All processing lock tests completed!')

  } catch (error) {
    console.error('\n❌ Test failed:', error)
  }
}

// Run if called directly
if (require.main === module) {
  testProcessingLock()
    .then(() => process.exit(0))
    .catch(console.error)
}

export { testProcessingLock } 