import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSingleNote() {
  console.log('🔍 Testing single note processing...\n');

  try {
    // Get one unprocessed note
    const { data: notes, error: fetchError } = await supabase
      .from('notes')
      .select('id, created_at, audio_url, user_id')
      .is('processed_at', null)
      .limit(1);

    if (fetchError) {
      console.error('Error fetching note:', fetchError);
      return;
    }

    if (!notes || notes.length === 0) {
      console.log('No unprocessed notes found');
      return;
    }

    const note = notes[0];
    console.log(`Found note: ${note.id}`);
    console.log(`Audio URL: ${note.audio_url}`);
    console.log(`User ID: ${note.user_id}`);
    console.log(`Created: ${note.created_at}`);

    // Test audio file download
    console.log('\n📁 Testing audio file download...');
    
    const filePath = getFilePathFromUrl(note.audio_url);
    console.log(`File path: ${filePath}`);

    const { data: audioData, error: storageError } = await supabase.storage
      .from('audio-files')
      .download(filePath);

    if (storageError) {
      console.error('Storage error:', storageError);
      return;
    }

    if (!audioData) {
      console.error('No audio data returned');
      return;
    }

    console.log(`✅ Audio file downloaded successfully (${audioData.size} bytes)`);

    // Test OpenAI API availability
    console.log('\n🧪 Testing OpenAI API...');
    
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error('OpenAI API key not found');
      return;
    }

    console.log('✅ OpenAI API key found');
    console.log('✅ Ready for processing');

    console.log('\nTo process this note, run:');
    console.log(`npm run process-directly -- --note-id=${note.id}`);

  } catch (error) {
    console.error('Error during test:', error);
  }
}

function getFilePathFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const bucketIndex = pathParts.indexOf('audio-files');
    if (bucketIndex === -1) return '';
    
    return pathParts.slice(bucketIndex + 1).join('/');
  } catch (error) {
    console.error('Error extracting file path from URL:', url, error);
    return '';
  }
}

testSingleNote().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});