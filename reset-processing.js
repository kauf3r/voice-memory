const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function resetProcessing() {
  console.log('🚨 Resetting stuck processing states...');

  try {
    // Step 1: Clear the specific stuck note
    const stuckNoteId = '208b375f-2e24-48ba-9642-2208114289e9';
    
    console.log(`🔧 Clearing stuck note: ${stuckNoteId}`);
    const { error: clearError } = await supabase
      .from('notes')
      .update({
        processing_started_at: null,
        error_message: null,
        last_error_at: null,
        processing_attempts: 0
      })
      .eq('id', stuckNoteId);

    if (clearError) {
      console.error('❌ Error clearing stuck note:', clearError);
    } else {
      console.log('✅ Stuck note cleared successfully');
    }

    // Step 2: Test the acquire_processing_lock function
    console.log('🧪 Testing acquire_processing_lock function...');
    const { data: lockResult, error: lockError } = await supabase
      .rpc('acquire_processing_lock', { 
        p_note_id: stuckNoteId,
        p_lock_timeout_minutes: 15 
      });

    if (lockError) {
      console.error('❌ Error testing lock function:', lockError);
    } else {
      console.log('✅ Lock function test result:', lockResult);
    }

    // Step 3: Check the note status after lock attempt
    const { data: noteStatus, error: statusError } = await supabase
      .from('notes')
      .select('id, processing_started_at, processed_at, error_message, processing_attempts')
      .eq('id', stuckNoteId);

    if (!statusError && noteStatus && noteStatus.length > 0) {
      console.log('📋 Note status after lock test:', noteStatus[0]);
    }

    // Step 4: Release the lock to clean up
    if (lockResult) {
      console.log('🔓 Releasing test lock...');
      const { error: releaseError } = await supabase
        .from('notes')
        .update({ processing_started_at: null })
        .eq('id', stuckNoteId);

      if (!releaseError) {
        console.log('✅ Test lock released');
      }
    }

    // Step 5: Check overall processing queue health
    console.log('📊 Checking processing queue health...');
    const { data: queueStats, error: statsError } = await supabase
      .rpc('get_processing_stats', { p_user_id: '48b4ff95-a3e4-44a8-a4be-553323387d17' });

    if (!statsError && queueStats && queueStats.length > 0) {
      console.log('📈 Processing queue stats:', queueStats[0]);
    }

  } catch (err) {
    console.error('❌ Reset processing failed:', err);
  }
}

resetProcessing();