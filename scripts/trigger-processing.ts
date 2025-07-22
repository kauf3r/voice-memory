import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function triggerProcessing() {
  console.log('🚀 Triggering processing for stuck notes...\n');

  try {
    // 1. Get all unprocessed notes
    const { data: unprocessedNotes, error: fetchError } = await supabase
      .from('notes')
      .select('id, created_at, audio_url')
      .is('processed_at', null)
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('Error fetching unprocessed notes:', fetchError);
      return;
    }

    if (!unprocessedNotes || unprocessedNotes.length === 0) {
      console.log('✅ No unprocessed notes found!');
      return;
    }

    console.log(`Found ${unprocessedNotes.length} unprocessed notes to trigger processing for:\n`);

    unprocessedNotes.forEach((note, index) => {
      const age = Math.round((Date.now() - new Date(note.created_at).getTime()) / (1000 * 60));
      console.log(`${index + 1}. ${note.id.substring(0, 8)}... (${age}m old)`);
    });

    console.log('\n🔄 Starting processing...\n');

    // 2. Process each note individually using the API
    const results = [];
    for (let i = 0; i < unprocessedNotes.length; i++) {
      const note = unprocessedNotes[i];
      console.log(`Processing ${i + 1}/${unprocessedNotes.length}: ${note.id.substring(0, 8)}...`);
      
      try {
        const response = await fetch(`${appUrl}/api/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'X-Service-Auth': 'true'
          },
          body: JSON.stringify({ noteId: note.id })
        });

        const result = await response.json();
        
        if (response.ok && result.success) {
          console.log(`  ✅ Success: ${result.message || 'Processing completed'}`);
          results.push({ noteId: note.id, success: true, result });
        } else {
          console.log(`  ❌ Failed: ${result.error || 'Unknown error'}`);
          results.push({ noteId: note.id, success: false, error: result.error });
        }

      } catch (error) {
        console.log(`  ❌ Network error: ${error}`);
        results.push({ noteId: note.id, success: false, error: `Network error: ${error}` });
      }

      // Add a small delay between requests
      if (i < unprocessedNotes.length - 1) {
        console.log('  ⏳ Waiting 2 seconds before next note...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // 3. Summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log('\n📊 Processing Summary:');
    console.log(`  ✅ Successful: ${successful}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  📄 Total: ${results.length}`);

    if (failed > 0) {
      console.log('\n❌ Failed notes:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.noteId.substring(0, 8)}...: ${r.error}`);
      });
    }

    // 4. Final check
    console.log('\n🔍 Final verification...');
    
    const { data: remainingUnprocessed } = await supabase
      .from('notes')
      .select('id')
      .is('processed_at', null);

    if (remainingUnprocessed && remainingUnprocessed.length > 0) {
      console.log(`⚠️  ${remainingUnprocessed.length} notes still unprocessed`);
    } else {
      console.log('🎉 All notes are now processed!');
    }

  } catch (error) {
    console.error('Error during processing trigger:', error);
  }
}

// Add command line arguments support
const args = process.argv.slice(2);
const specificNoteId = args.find(arg => arg.startsWith('--note-id='))?.split('=')[1];

if (specificNoteId) {
  console.log(`Processing specific note: ${specificNoteId}`);
  // Process just one note
  triggerSingleNote(specificNoteId);
} else {
  // Process all unprocessed notes
  triggerProcessing();
}

async function triggerSingleNote(noteId: string) {
  console.log(`🚀 Triggering processing for note: ${noteId}\n`);

  try {
    const response = await fetch(`${appUrl}/api/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'X-Service-Auth': 'true'
      },
      body: JSON.stringify({ noteId })
    });

    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log(`✅ Success: ${result.message || 'Processing completed'}`);
      console.log('Note details:', result.note);
    } else {
      console.log(`❌ Failed: ${result.error || 'Unknown error'}`);
    }

  } catch (error) {
    console.error('Error processing note:', error);
  }
}

// Export the functions for potential reuse
export { triggerProcessing, triggerSingleNote };