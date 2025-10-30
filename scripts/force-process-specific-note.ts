import { createServiceClient } from '../lib/supabase-server';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function forceProcessSpecificNote() {
  const noteId = '4a1eedd6-416b-45c5-a7ef-770109c8b54e';
  
  console.log(`🔧 Force processing note: ${noteId}\n`);
  
  // First clear the processed_at so direct processing will pick it up
  const supabase = createServiceClient();
  
  const { error: updateError } = await supabase
    .from('notes')
    .update({ 
      processed_at: null,
      transcription: null,
      analysis: null
    })
    .eq('id', noteId);
    
  if (updateError) {
    console.error('Error resetting note:', updateError);
    return;
  }
  
  console.log('✅ Note reset for processing');
  console.log('🚀 Running direct processing...\n');
  
  // Import and run direct processing
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  try {
    const { stdout, stderr } = await execAsync('npm run process-directly');
    console.log(stdout);
    if (stderr) console.error(stderr);
  } catch (error) {
    console.error('Error running direct processing:', error);
  }
}

forceProcessSpecificNote().catch(console.error);