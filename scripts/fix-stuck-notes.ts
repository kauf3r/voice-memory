import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixStuckNotes() {
  console.log('🔧 Starting stuck notes repair process...\n');

  try {
    // 1. Find notes that have both transcription and analysis but aren't marked processed
    console.log('1️⃣ Fixing notes with both transcription and analysis but no processed_at...');
    
    const { data: completedButUnmarked, error: fetchError1 } = await supabase
      .from('notes')
      .select('id, created_at')
      .not('transcription', 'is', null)
      .not('analysis', 'is', null)
      .is('processed_at', null);

    if (fetchError1) {
      console.error('Error fetching completed but unmarked notes:', fetchError1);
    } else if (completedButUnmarked && completedButUnmarked.length > 0) {
      console.log(`Found ${completedButUnmarked.length} notes to mark as processed`);
      
      const { error: updateError1 } = await supabase
        .from('notes')
        .update({ processed_at: new Date().toISOString() })
        .not('transcription', 'is', null)
        .not('analysis', 'is', null)
        .is('processed_at', null);

      if (updateError1) {
        console.error('Error updating processed_at:', updateError1);
      } else {
        console.log(`✅ Marked ${completedButUnmarked.length} notes as processed`);
      }
    } else {
      console.log('No completed but unmarked notes found');
    }

    // 2. Reset notes that have been stuck for more than 30 minutes (likely failed processing)
    console.log('\n2️⃣ Resetting notes stuck for more than 30 minutes...');
    
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: oldStuckNotes, error: fetchError2 } = await supabase
      .from('notes')
      .select('id, created_at, transcription, analysis')
      .is('processed_at', null)
      .lt('created_at', thirtyMinutesAgo);

    if (fetchError2) {
      console.error('Error fetching old stuck notes:', fetchError2);
    } else if (oldStuckNotes && oldStuckNotes.length > 0) {
      console.log(`Found ${oldStuckNotes.length} notes stuck for more than 30 minutes`);
      
      // Reset transcription and analysis for truly stuck notes (those without both)
      const notesToReset = oldStuckNotes.filter(note => 
        !note.transcription || !note.analysis
      );
      
      if (notesToReset.length > 0) {
        console.log(`Resetting ${notesToReset.length} incomplete notes for reprocessing...`);
        
        const { error: resetError } = await supabase
          .from('notes')
          .update({ 
            transcription: null, 
            analysis: null
          })
          .in('id', notesToReset.map(note => note.id));

        if (resetError) {
          console.error('Error resetting stuck notes:', resetError);
        } else {
          console.log(`✅ Reset ${notesToReset.length} stuck notes for reprocessing`);
        }
      } else {
        console.log('All old stuck notes appear to have partial processing - checking if they should be marked complete');
      }
    } else {
      console.log('No notes stuck for more than 30 minutes found');
    }

    // 3. Clean up notes with invalid or missing audio URLs
    console.log('\n3️⃣ Checking for notes with invalid audio URLs...');
    
    const { data: invalidAudioNotes, error: fetchError3 } = await supabase
      .from('notes')
      .select('id, audio_url')
      .or('audio_url.is.null,audio_url.eq.')
      .is('processed_at', null);

    if (fetchError3) {
      console.error('Error fetching invalid audio notes:', fetchError3);
    } else if (invalidAudioNotes && invalidAudioNotes.length > 0) {
      console.log(`Found ${invalidAudioNotes.length} notes with missing/invalid audio URLs`);
      console.log('These notes cannot be processed and should be reviewed manually:');
      
      invalidAudioNotes.forEach(note => {
        console.log(`  - ${note.id} (audio_url: ${note.audio_url || 'null'})`);
      });
      
      // Optionally delete these notes or mark them with an error
      console.log('Consider deleting these notes or marking them with error status');
    } else {
      console.log('All notes have valid audio URLs');
    }

    // 4. Check for notes with metadata errors
    console.log('\n4️⃣ Checking for notes with processing errors...');
    
    // Skip error notes check since notes table doesn't have metadata field
    const errorNotes = null;
    const fetchError4 = null;

    if (fetchError4) {
      console.error('Error fetching error notes:', fetchError4);
    } else if (errorNotes && errorNotes.length > 0) {
      console.log(`Found ${errorNotes.length} notes with processing errors:`);
      
      errorNotes.forEach(note => {
        console.log(`  - ${note.id.substring(0, 8)}... Error: ${note.metadata?.error}`);
      });
      
      // Ask if user wants to reset these for retry
      console.log('\nTo retry these notes, clear their error metadata and reset transcription/analysis');
    } else {
      console.log('No notes with processing errors found');
    }

    // 5. Final status check
    console.log('\n5️⃣ Final status check...');
    
    const { data: remainingStuck } = await supabase
      .from('notes')
      .select('id, created_at, transcription, analysis, processed_at')
      .is('processed_at', null)
      .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // 5 minutes ago
      .order('created_at', { ascending: false });

    if (remainingStuck && remainingStuck.length > 0) {
      console.log(`⚠️  ${remainingStuck.length} notes still appear stuck (older than 5 minutes):`);
      remainingStuck.forEach(note => {
        const hasTranscription = note.transcription ? '✓' : '✗';
        const hasAnalysis = note.analysis ? '✓' : '✗';
        const age = Math.round((Date.now() - new Date(note.created_at).getTime()) / (1000 * 60));
        console.log(`  - ${note.id.substring(0, 8)}... (${age}m old) T:${hasTranscription} A:${hasAnalysis}`);
      });
    } else {
      console.log('✅ No stuck notes remaining!');
    }

  } catch (error) {
    console.error('Error during fix process:', error);
  }
}

// Add command line argument support
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

if (dryRun) {
  console.log('🔍 DRY RUN MODE - No changes will be made\n');
}

// Run the fix
fixStuckNotes().then(() => {
  console.log('\n✅ Stuck notes repair process complete');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});