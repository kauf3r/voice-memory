import { createServiceClient } from '../lib/supabase-server';
import { analyzeTranscription } from '../lib/openai';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function completeAnalysis() {
  const supabase = createServiceClient();
  
  console.log('🧠 Completing analysis for transcribed notes...\n');

  // Find notes with transcription but no analysis
  const { data: notes, error } = await supabase
    .from('notes')
    .select('id, transcription, analysis, user_id, recorded_at')
    .not('transcription', 'is', null)
    .is('analysis', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching notes:', error);
    return;
  }

  console.log(`Found ${notes?.length || 0} notes with transcription but no analysis\n`);

  if (notes && notes.length > 0) {
    for (const note of notes) {
      console.log(`\n📝 Analyzing note: ${note.id}`);
      console.log(`   Transcription length: ${note.transcription.length} chars`);
      
      try {
        // Get project knowledge for context
        const { data: projectKnowledge } = await supabase
          .from('project_knowledge')
          .select('content')
          .eq('user_id', note.user_id)
          .single();

        const knowledgeContext = projectKnowledge?.content ? 
          JSON.stringify(projectKnowledge.content) : 
          '';

        // Analyze the transcription
        console.log('   🧠 Starting analysis...');
        const { analysis, error: analysisError, warning } = await analyzeTranscription(
          note.transcription,
          knowledgeContext,
          note.recorded_at
        );

        if (analysisError) {
          console.error('   ❌ Analysis failed:', analysisError.message);
          continue;
        }

        if (warning) {
          console.warn('   ⚠️ Analysis warning:', warning);
        }

        // Update the note with analysis
        const { error: updateError } = await supabase
          .from('notes')
          .update({
            analysis,
            processed_at: new Date().toISOString()
          })
          .eq('id', note.id);

        if (updateError) {
          console.error('   ❌ Failed to update note:', updateError.message);
        } else {
          console.log('   ✅ Analysis completed and saved!');
        }

        // Wait between analyses to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err) {
        console.error('   ❌ Unexpected error:', err);
      }
    }
  }

  console.log('\n✅ Analysis completion process finished');
}

// Run the function
completeAnalysis().catch(console.error);