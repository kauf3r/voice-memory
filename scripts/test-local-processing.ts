#!/usr/bin/env npx tsx

/**
 * Test local processing directly
 */

import { processingService } from '../lib/processing/ProcessingService';
import { createServiceClient } from '../lib/supabase-server';

async function testLocalProcessing() {
  console.log('🔍 Testing local processing service...\n');
  
  const supabase = createServiceClient();
  
  // Get unprocessed notes
  const { data: notes, error } = await supabase
    .from('notes')
    .select('*')
    .is('processed_at', null)
    .limit(1);
    
  if (error) {
    console.error('❌ Error fetching notes:', error);
    return;
  }
  
  if (!notes || notes.length === 0) {
    console.log('✅ No unprocessed notes found');
    return;
  }
  
  const note = notes[0];
  console.log(`📋 Found unprocessed note: ${note.id}`);
  console.log(`   Audio URL: ${note.audio_url}`);
  console.log(`   User ID: ${note.user_id}`);
  
  console.log('\n🚀 Attempting local processing...\n');
  
  try {
    const result = await processingService.processNote(note.id, note.user_id, true);
    
    if (result.success) {
      console.log('✅ Processing completed successfully!');
      console.log(`   Transcription: ${result.transcription?.substring(0, 100)}...`);
      console.log(`   Analysis topics:`, result.analysis?.focusTopics);
    } else {
      console.log('❌ Processing failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Processing error:', error);
  }
}

// Run the test
testLocalProcessing().catch(console.error);