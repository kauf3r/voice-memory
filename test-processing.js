const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testProcessing() {
  console.log('🧪 Testing processing pipeline via API...');

  const stuckNoteId = '208b375f-2e24-48ba-9642-2208114289e9';
  const userId = '48b4ff95-a3e4-44a8-a4be-553323387d17';

  try {
    // Get a valid user session first
    console.log('🔐 Getting user session...');
    
    // Create a user client with the service key to get the session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Session error:', sessionError);
      return;
    }

    // Test the processing API endpoint
    console.log('📡 Calling /api/process endpoint...');
    
    const response = await fetch('http://localhost:3000/api/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'X-Service-Auth': 'true'
      },
      body: JSON.stringify({
        noteId: stuckNoteId,
        forceReprocess: true
      })
    });

    console.log('📊 Response status:', response.status);
    console.log('📋 Response headers:', Object.fromEntries(response.headers.entries()));

    const result = await response.json();
    console.log('✅ Processing API response:', result);

    if (result.success) {
      console.log('🎉 Processing completed successfully!');
      console.log('📝 Updated note:', result.note);
    } else {
      console.log('❌ Processing failed:', result.error || result.details);
    }

  } catch (err) {
    console.error('❌ Test processing failed:', err);
  }
}

testProcessing();