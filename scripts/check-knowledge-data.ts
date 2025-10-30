import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

// Create admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkKnowledgeData() {
  console.log('🔍 Checking Knowledge Base Data...\n');

  // 1. Check notes with analysis
  console.log('📝 Checking notes table:');
  const { data: notes, error: notesError } = await supabase
    .from('notes')
    .select('*')
    .not('analysis', 'is', null)
    .order('created_at', { ascending: false });

  if (notesError) {
    console.error('❌ Error fetching notes:', notesError);
  } else {
    console.log(`✅ Found ${notes?.length || 0} notes with analysis data`);
    
    if (notes && notes.length > 0) {
      console.log('\nSample note:');
      const sampleNote = notes[0];
      console.log(`  - ID: ${sampleNote.id}`);
      console.log(`  - User ID: ${sampleNote.user_id}`);
      console.log(`  - File: ${sampleNote.file_name}`);
      console.log(`  - Created: ${sampleNote.created_at}`);
      console.log(`  - Has transcript: ${!!sampleNote.transcript}`);
      console.log(`  - Has analysis: ${!!sampleNote.analysis}`);
      
      if (sampleNote.analysis) {
        console.log('\n  Analysis structure:');
        const analysisKeys = Object.keys(sampleNote.analysis);
        analysisKeys.forEach(key => {
          console.log(`    - ${key}: ${typeof sampleNote.analysis[key]}`);
        });
      }
    }
  }

  // 2. Check project_knowledge table
  console.log('\n📊 Checking project_knowledge table:');
  const { data: knowledge, error: knowledgeError } = await supabase
    .from('project_knowledge')
    .select('*')
    .order('created_at', { ascending: false });

  if (knowledgeError) {
    console.error('❌ Error fetching project knowledge:', knowledgeError);
  } else {
    console.log(`✅ Found ${knowledge?.length || 0} project knowledge entries`);
    
    if (knowledge && knowledge.length > 0) {
      console.log('\nSample knowledge entry:');
      const sample = knowledge[0];
      console.log(`  - ID: ${sample.id}`);
      console.log(`  - User ID: ${sample.user_id}`);
      console.log(`  - Project ID: ${sample.project_id}`);
      console.log(`  - Created: ${sample.created_at}`);
    }
  }

  // 3. Check unique users with notes
  console.log('\n👥 Checking users with notes:');
  const { data: userNotes, error: userError } = await supabase
    .from('notes')
    .select('user_id')
    .not('analysis', 'is', null);

  if (!userError && userNotes) {
    const uniqueUsers = [...new Set(userNotes.map(n => n.user_id))];
    console.log(`✅ ${uniqueUsers.length} unique users have processed notes`);
    
    if (uniqueUsers.length > 0) {
      console.log('\nUser IDs with processed notes:');
      uniqueUsers.slice(0, 5).forEach(userId => {
        console.log(`  - ${userId}`);
      });
    }
  }

  // 4. Test the aggregation query used in API
  console.log('\n🔄 Testing knowledge aggregation query:');
  
  // Pick the first user with notes for testing
  const { data: firstUserNote } = await supabase
    .from('notes')
    .select('user_id')
    .not('analysis', 'is', null)
    .limit(1)
    .single();

  if (firstUserNote) {
    const testUserId = firstUserNote.user_id;
    console.log(`\nTesting with user: ${testUserId}`);
    
    const { data: userNotes, error } = await supabase
      .from('notes')
      .select('analysis')
      .eq('user_id', testUserId)
      .not('analysis', 'is', null);

    if (error) {
      console.error('❌ Error in aggregation query:', error);
    } else {
      console.log(`✅ Found ${userNotes?.length || 0} notes for aggregation`);
    }
  }
}

checkKnowledgeData().catch(console.error);