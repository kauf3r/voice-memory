import { createServiceClient } from '../lib/supabase-server';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function forceProcessNote() {
  const supabase = createServiceClient();

  // First, let's see what notes need processing
  const { data: notes, error } = await supabase
    .from('notes')
    .select('id, audio_url, transcription, analysis, processed_at, created_at')
    .is('transcription', null)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Found', notes?.length || 0, 'notes without transcription');
  
  if (notes && notes.length > 0) {
    // Try to process each note
    for (const note of notes) {
      console.log('\nAttempting to process note:', note.id);
      console.log('Created:', new Date(note.created_at).toLocaleString());
      
      // Try the direct processing approach
      try {
        // Import the processing service
        const { processingService } = await import('../lib/processing-service');
        
        // Process the note
        const result = await processingService.processNote(note.id);
        
        console.log('Process result:', result);
        
        if (result.success) {
          console.log('✅ Successfully processed note');
        } else {
          console.log('❌ Failed to process note:', result.error);
        }
        
        // Wait a bit between notes
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err) {
        console.error('Error processing note:', err);
      }
    }
  }
}

// Run the function
forceProcessNote().catch(console.error);