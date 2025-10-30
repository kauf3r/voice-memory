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

interface Note {
  id: string;
  created_at: string;
  audio_url: string;
  transcription: string | null;
  analysis: any | null;
  processed_at: string | null;
  user_id: string;
  recorded_at?: string;
  duration_seconds?: number;
}

async function diagnoseStuckNotes() {
  console.log('🔍 Diagnosing stuck notes in the database...\n');

  try {
    // 1. Get all notes that appear to be stuck (no processed_at after 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: stuckNotes, error: stuckError } = await supabase
      .from('notes')
      .select('*')
      .is('processed_at', null)
      .lt('created_at', tenMinutesAgo)
      .order('created_at', { ascending: false });

    if (stuckError) {
      console.error('Error fetching stuck notes:', stuckError);
      return;
    }

    console.log(`Found ${stuckNotes?.length || 0} potentially stuck notes\n`);

    if (!stuckNotes || stuckNotes.length === 0) {
      console.log('✅ No stuck notes found!');
      
      // Show recent notes for context
      const { data: recentNotes } = await supabase
        .from('notes')
        .select('id, created_at, processed_at, transcription, analysis')
        .order('created_at', { ascending: false })
        .limit(5);
      
      console.log('\n📋 Recent notes for reference:');
      recentNotes?.forEach(note => {
        const status = note.processed_at ? '✅ Processed' : '⏳ Processing';
        const hasTranscription = note.transcription ? '✓' : '✗';
        const hasAnalysis = note.analysis ? '✓' : '✗';
        console.log(`  ${status} - ${note.id.substring(0, 8)}... Created: ${new Date(note.created_at).toLocaleString()} | Transcription: ${hasTranscription} | Analysis: ${hasAnalysis}`);
      });
      
      return;
    }

    // 2. Analyze patterns in stuck notes
    console.log('📊 Analyzing stuck notes patterns:\n');
    
    const patterns = {
      noTranscription: 0,
      noAnalysis: 0,
      hasTranscriptionNoAnalysis: 0,
      hasAnalysisNoTranscription: 0,
      neitherTranscriptionNorAnalysis: 0,
      bothButNotProcessed: 0,
      missingAudioUrl: 0,
      invalidMetadata: 0
    };

    const detailedAnalysis: any[] = [];

    for (const note of stuckNotes) {
      const details: any = {
        id: note.id,
        created: new Date(note.created_at).toLocaleString(),
        ageMinutes: Math.round((Date.now() - new Date(note.created_at).getTime()) / (1000 * 60)),
        hasTranscription: !!note.transcription,
        hasAnalysis: !!note.analysis,
        hasAudioUrl: !!note.audio_url,
        audioUrlValid: note.audio_url ? note.audio_url.startsWith('http') : false,
        recordedAt: note.recorded_at,
        issues: []
      };

      // Check for issues
      if (!note.audio_url) {
        patterns.missingAudioUrl++;
        details.issues.push('Missing audio URL');
      }

      if (!note.transcription && !note.analysis) {
        patterns.neitherTranscriptionNorAnalysis++;
        details.issues.push('Neither transcription nor analysis');
      } else if (!note.transcription) {
        patterns.noTranscription++;
        details.issues.push('No transcription');
      } else if (!note.analysis) {
        patterns.noAnalysis++;
        details.issues.push('No analysis');
      }

      if (note.transcription && !note.analysis) {
        patterns.hasTranscriptionNoAnalysis++;
        details.issues.push('Has transcription but no analysis');
      }

      if (!note.transcription && note.analysis) {
        patterns.hasAnalysisNoTranscription++;
        details.issues.push('Has analysis but no transcription (unusual!)');
      }

      if (note.transcription && note.analysis && !note.processed_at) {
        patterns.bothButNotProcessed++;
        details.issues.push('Has both transcription and analysis but not marked processed');
      }

      // Note: The notes table doesn't have metadata field, so we skip error checking

      detailedAnalysis.push(details);
    }

    // 3. Print pattern summary
    console.log('🔍 Pattern Summary:');
    console.log(`  - Missing audio URL: ${patterns.missingAudioUrl}`);
    console.log(`  - No transcription: ${patterns.noTranscription}`);
    console.log(`  - No analysis: ${patterns.noAnalysis}`);
    console.log(`  - Has transcription but no analysis: ${patterns.hasTranscriptionNoAnalysis}`);
    console.log(`  - Has analysis but no transcription: ${patterns.hasAnalysisNoTranscription}`);
    console.log(`  - Neither transcription nor analysis: ${patterns.neitherTranscriptionNorAnalysis}`);
    console.log(`  - Both present but not marked processed: ${patterns.bothButNotProcessed}`);
    console.log(`  - Invalid metadata: ${patterns.invalidMetadata}`);

    // 4. Show detailed analysis for each stuck note
    console.log('\n📋 Detailed Analysis of Stuck Notes:\n');
    
    detailedAnalysis.forEach((note, index) => {
      console.log(`${index + 1}. Note ${note.id.substring(0, 8)}...`);
      console.log(`   Created: ${note.created} (${note.ageMinutes} minutes ago)`);
      console.log(`   Audio URL: ${note.hasAudioUrl ? (note.audioUrlValid ? '✓ Valid' : '✗ Invalid format') : '✗ Missing'}`);
      console.log(`   Transcription: ${note.hasTranscription ? '✓' : '✗'}`);
      console.log(`   Analysis: ${note.hasAnalysis ? '✓' : '✗'}`);
      if (note.issues.length > 0) {
        console.log(`   Issues: ${note.issues.join(', ')}`);
      }
      if (note.recordedAt) {
        console.log(`   Recorded: ${new Date(note.recordedAt).toLocaleString()}`);
      }
      console.log();
    });

    // 5. Check for any recent processing errors in metadata
    console.log('🔍 Checking for processing errors in metadata:\n');
    
    // Skip error checking since notes table doesn't have metadata field
    console.log('No notes found with errors in metadata (metadata field not available).');

    // 6. Recommendations
    console.log('\n💡 Recommendations:\n');
    
    if (patterns.bothButNotProcessed > 0) {
      console.log('1. Some notes have both transcription and analysis but aren\'t marked as processed.');
      console.log('   → Run the fix script to update their processed_at timestamps.');
    }
    
    if (patterns.hasTranscriptionNoAnalysis > 0) {
      console.log('2. Some notes have transcription but no analysis.');
      console.log('   → These might have failed during the analysis step.');
    }
    
    if (patterns.neitherTranscriptionNorAnalysis > 0) {
      console.log('3. Some notes have neither transcription nor analysis.');
      console.log('   → These likely failed early in the processing pipeline.');
    }
    
    if (patterns.missingAudioUrl > 0) {
      console.log('4. Some notes are missing audio URLs.');
      console.log('   → These cannot be processed without valid audio data.');
    }

    // 7. Ask if user wants to generate a fix script
    console.log('\n❓ Next Steps:');
    console.log('   - Run `npm run fix-stuck-notes` to attempt automatic fixes');
    console.log('   - Or create a custom fix based on the patterns above');

  } catch (error) {
    console.error('Error during diagnosis:', error);
  }
}

// Run the diagnosis
diagnoseStuckNotes().then(() => {
  console.log('\n✅ Diagnosis complete');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});