import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const openaiApiKey = process.env.OPENAI_API_KEY!;

if (!supabaseUrl || !supabaseServiceKey || !openaiApiKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Import OpenAI functions directly
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: openaiApiKey,
});

async function transcribeAudio(audioFile: File): Promise<{ text?: string, error?: Error }> {
  try {
    console.log('  🎤 Starting transcription...');
    
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en', // Optional: specify language for better accuracy
      response_format: 'text'
    });

    return { text: transcription };
  } catch (error) {
    console.error('Transcription error:', error);
    return { error: error as Error };
  }
}

async function analyzeTranscription(
  transcription: string, 
  knowledgeContext: string = ''
): Promise<{ analysis?: any, error?: Error }> {
  try {
    console.log('  🧠 Starting analysis...');

    const systemPrompt = `You are an AI assistant that analyzes voice memos and provides structured insights. Your goal is to extract actionable information and provide valuable analysis.

${knowledgeContext ? `Here is the user's project knowledge for context: ${knowledgeContext}` : ''}

Please analyze the following voice memo and provide a structured JSON response with these sections:
1. summary - A concise summary of the main points
2. keyInsights - Array of important insights or realizations  
3. actionItems - Array of specific tasks or next steps mentioned
4. topics - Array of main topics or themes discussed
5. mood - Overall emotional tone (positive, neutral, negative, mixed)
6. urgency - How urgent this seems (low, medium, high)
7. crossReferences - Connections to other topics, projects, or knowledge areas

Format your response as valid JSON.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: transcription }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const analysisText = completion.choices[0]?.message?.content;
    
    if (!analysisText) {
      throw new Error('No analysis generated');
    }

    // Parse the JSON response
    const analysis = JSON.parse(analysisText);
    
    return { analysis };
  } catch (error) {
    console.error('Analysis error:', error);
    return { error: error as Error };
  }
}

// Helper functions from the API route
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

function getMimeTypeFromUrl(url: string): string {
  const extension = url.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'mp3': 'audio/mpeg',
    'm4a': 'audio/mp4',
    'wav': 'audio/wav',
    'aac': 'audio/aac',
    'ogg': 'audio/ogg',
    'webm': 'audio/webm',
    'mp4': 'audio/mp4'
  };
  return mimeTypes[extension || ''] || 'audio/mpeg';
}

async function processNote(noteId: string): Promise<{ success: boolean, error?: string }> {
  try {
    console.log(`\n🔄 Processing note ${noteId.substring(0, 8)}...`);

    // Get the note
    const { data: note, error: fetchError } = await supabase
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .single();

    if (fetchError) {
      console.error('  ❌ Note fetch error:', fetchError);
      return { success: false, error: 'Note not found' };
    }

    // Check if already processed
    if (note.processed_at) {
      console.log('  ℹ️  Note already processed');
      return { success: true };
    }

    // Get audio file from storage
    console.log('  📁 Downloading audio file...');
    const { data: audioData, error: storageError } = await supabase.storage
      .from('audio-files')
      .download(getFilePathFromUrl(note.audio_url));

    if (storageError || !audioData) {
      console.error('  ❌ Storage error:', storageError);
      return { success: false, error: 'Could not retrieve audio file' };
    }

    // Convert blob to File object for Whisper API
    const mimeType = getMimeTypeFromUrl(note.audio_url);
    const extension = note.audio_url.split('.').pop() || 'mp3';
    const audioFile = new File([audioData], `audio.${extension}`, { type: mimeType });

    // Step 1: Transcribe audio
    const { text: transcription, error: transcriptionError } = await transcribeAudio(audioFile);

    if (transcriptionError || !transcription) {
      console.error('  ❌ Transcription failed:', transcriptionError);
      
      // Update note with error status
      await supabase
        .from('notes')
        .update({
          processed_at: new Date().toISOString(),
        })
        .eq('id', noteId);

      return { success: false, error: transcriptionError?.message || 'Transcription failed' };
    }

    console.log(`  ✅ Transcription completed (${transcription.length} chars)`);

    // Step 2: Get project knowledge for context
    const { data: projectKnowledge } = await supabase
      .from('project_knowledge')
      .select('content')
      .eq('user_id', note.user_id)
      .single();

    const knowledgeContext = projectKnowledge?.content ? 
      JSON.stringify(projectKnowledge.content) : 
      '';

    // Step 3: Analyze transcription
    const { analysis, error: analysisError } = await analyzeTranscription(
      transcription, 
      knowledgeContext
    );

    if (analysisError) {
      console.error('  ❌ Analysis failed:', analysisError);
      
      // Update note with transcription but no analysis
      await supabase
        .from('notes')
        .update({
          transcription,
          processed_at: new Date().toISOString(),
        })
        .eq('id', noteId);

      return { success: false, error: analysisError.message };
    }

    console.log('  ✅ Analysis completed');

    // Step 4: Update note with results
    const { error: updateError } = await supabase
      .from('notes')
      .update({
        transcription,
        analysis,
        processed_at: new Date().toISOString(),
      })
      .eq('id', noteId);

    if (updateError) {
      console.error('  ❌ Update error:', updateError);
      return { success: false, error: 'Failed to save processing results' };
    }

    console.log('  🎉 Processing completed successfully');
    
    return { success: true };

  } catch (error) {
    console.error('  💥 Processing error:', error);
    return { success: false, error: `Processing failed: ${error}` };
  }
}

async function directProcessing() {
  console.log('🚀 Direct processing of stuck notes...\n');

  try {
    // Get all unprocessed notes
    const { data: unprocessedNotes, error: fetchError } = await supabase
      .from('notes')
      .select('id, created_at')
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

    console.log(`Found ${unprocessedNotes.length} unprocessed notes`);

    // Process each note
    const results = [];
    for (let i = 0; i < unprocessedNotes.length; i++) {
      const note = unprocessedNotes[i];
      const age = Math.round((Date.now() - new Date(note.created_at).getTime()) / (1000 * 60));
      
      console.log(`\n📝 [${i + 1}/${unprocessedNotes.length}] Note ${note.id.substring(0, 8)}... (${age}m old)`);
      
      const result = await processNote(note.id);
      results.push({ noteId: note.id, ...result });

      // Small delay between notes to avoid rate limiting
      if (i < unprocessedNotes.length - 1) {
        console.log('⏳ Waiting 3 seconds before next note...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Summary
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

  } catch (error) {
    console.error('Error during direct processing:', error);
  }
}

// Run the processing
directProcessing().then(() => {
  console.log('\n✅ Direct processing complete');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});