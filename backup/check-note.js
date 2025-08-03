const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkNote() {
  const stuckNoteId = '208b375f-2e24-48ba-9642-2208114289e9';
  
  console.log('🔍 Checking if note exists...');
  
  // Check if note exists
  const { data: note, error } = await supabase
    .from('notes')
    .select('id, user_id, audio_url, processed_at, error_message, transcription')
    .eq('id', stuckNoteId);
    
  if (error) {
    console.error('❌ Note query error:', error);
  } else if (note && note.length > 0) {
    console.log('✅ Note found:', note[0]);
  } else {
    console.log('❌ Note not found');
  }
  
  // Also check all notes for this user
  console.log('📋 Checking recent notes for user...');
  const { data: allNotes, error: allError } = await supabase
    .from('notes')
    .select('id, processed_at, error_message, audio_url')
    .eq('user_id', '48b4ff95-a3e4-44a8-a4be-553323387d17')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (!allError && allNotes) {
    console.log('📋 Recent notes for user:', allNotes);
  } else {
    console.error('❌ Error fetching user notes:', allError);
  }
}

checkNote();