const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkSchema() {
  console.log('🔍 Checking current database schema...');

  try {
    // Check if notes table exists by querying it
    console.log('📋 Checking notes table...');
    const { data: notes, error } = await supabase
      .from('notes')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Error querying notes table:', error);
      return;
    }

    if (notes && notes.length > 0) {
      console.log('✅ Notes table exists! Sample columns:', Object.keys(notes[0]));
      
      // Check if error tracking columns exist
      const hasErrorMessage = 'error_message' in notes[0];
      const hasProcessingAttempts = 'processing_attempts' in notes[0];
      const hasLastErrorAt = 'last_error_at' in notes[0];
      
      console.log('🔍 Error tracking columns status:');
      console.log('  error_message:', hasErrorMessage ? '✅' : '❌');
      console.log('  processing_attempts:', hasProcessingAttempts ? '✅' : '❌');
      console.log('  last_error_at:', hasLastErrorAt ? '✅' : '❌');
      
      if (!hasErrorMessage || !hasProcessingAttempts || !hasLastErrorAt) {
        console.log('🚨 Missing error tracking columns - migration needed!');
      } else {
        console.log('✅ All error tracking columns present');
      }
    } else {
      console.log('❌ Notes table is empty - cannot check structure');
    }

    // Also check for the stuck note
    const { data: stuckNote, error: noteError } = await supabase
      .from('notes')
      .select('id, processing_started_at, processed_at, error_message')
      .eq('id', '208b375f-2e24-48ba-9642-2208114289e9');

    if (!noteError && stuckNote && stuckNote.length > 0) {
      console.log('🔍 Stuck note status:', stuckNote[0]);
    }

  } catch (err) {
    console.error('❌ Schema check failed:', err);
  }
}

checkSchema();