import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

async function testAPIHang() {
  console.log('🔍 Testing if API is hanging...\n');

  // Create admin client
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Get the user
  const { data: user } = await adminClient
    .from('users')
    .select('id, email')
    .eq('email', 'andy@andykaufman.net')
    .single();

  if (!user) {
    console.error('❌ User not found');
    return;
  }

  console.log(`✅ Found user: ${user.email}`);

  // Create a user client with service key for testing
  const userClient = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🧪 Testing individual API components...\n');

  // Test 1: Can we query notes?
  console.log('1️⃣ Testing notes query...');
  try {
    const { data: notes, error: notesError } = await userClient
      .from('notes')
      .select('id, analysis, transcription, recorded_at, processed_at')
      .eq('user_id', user.id)
      .not('analysis', 'is', null)
      .order('recorded_at', { ascending: false });

    if (notesError) {
      console.error('❌ Notes query error:', notesError);
    } else {
      console.log(`✅ Notes query successful: ${notes?.length || 0} notes`);
    }
  } catch (error) {
    console.error('❌ Notes query exception:', error);
  }

  // Test 2: Can we query project_knowledge?
  console.log('\n2️⃣ Testing project_knowledge query...');
  try {
    const { data: knowledge, error: knowledgeError } = await userClient
      .from('project_knowledge')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (knowledgeError && knowledgeError.code !== 'PGRST116') {
      console.error('❌ Project knowledge error:', knowledgeError);
    } else {
      console.log('✅ Project knowledge query successful');
    }
  } catch (error) {
    console.error('❌ Project knowledge exception:', error);
  }

  // Test 3: Direct HTTP request to API
  console.log('\n3️⃣ Testing direct HTTP request...');
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    console.log('⏰ Request timed out after 10 seconds');
  }, 10000);

  try {
    console.log('📡 Making request to http://localhost:3000/api/knowledge...');
    
    const response = await fetch('http://localhost:3000/api/knowledge', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    console.log(`📨 Response status: ${response.status}`);
    console.log(`📨 Response headers:`, Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API response received');
      console.log('📊 Response structure:', {
        success: data.success,
        hasKnowledge: !!data.knowledge,
        totalNotes: data.knowledge?.stats?.totalNotes || 0
      });
    } else {
      const errorText = await response.text();
      console.error('❌ API error response:', errorText);
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ Request was aborted (timeout)');
    } else {
      console.error('❌ Request failed:', error);
    }
  }

  // Test 4: Check if server is responding at all
  console.log('\n4️⃣ Testing server health...');
  try {
    const healthResponse = await fetch('http://localhost:3000/api/health', {
      signal: AbortSignal.timeout(5000)
    });
    console.log(`✅ Health check: ${healthResponse.status}`);
  } catch (error) {
    console.error('❌ Health check failed:', error);
  }
}

testAPIHang().catch(console.error);