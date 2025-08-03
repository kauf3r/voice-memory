import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function testKnowledgeAPI() {
  console.log('🔍 Testing Knowledge API...\n');

  // Create client
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // First, sign in with a test user or use existing session
  console.log('🔐 Authenticating...');
  
  // Get the first user with notes for testing
  const adminClient = createClient(
    supabaseUrl, 
    process.env.SUPABASE_SERVICE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
  
  const { data: firstUserNote } = await adminClient
    .from('notes')
    .select('user_id')
    .not('analysis', 'is', null)
    .limit(1)
    .single();

  if (!firstUserNote) {
    console.error('❌ No users with notes found');
    return;
  }

  // Get user email
  const { data: userData } = await adminClient
    .from('users')
    .select('email')
    .eq('id', firstUserNote.user_id)
    .single();

  console.log(`✅ Found user with notes: ${userData?.email || firstUserNote.user_id}`);

  // Sign in as this user (using service key to bypass auth)
  const { data: { session }, error: signInError } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: userData?.email || 'test@example.com',
  });

  // For testing, we'll use the service key to get a valid token
  const testToken = supabaseAnonKey; // This won't work for user-specific data
  
  console.log('\n📡 Testing API endpoint...');
  
  // Test with direct fetch
  try {
    const response = await fetch(`${appUrl}/api/knowledge`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${testToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`Response status: ${response.status}`);
    
    const data = await response.json();
    console.log('\nAPI Response:', JSON.stringify(data, null, 2));
    
    if (data.knowledge) {
      console.log('\n📊 Knowledge Stats:');
      console.log(`- Total Notes: ${data.knowledge.stats?.totalNotes || 0}`);
      console.log(`- Total Insights: ${data.knowledge.stats?.totalInsights || 0}`);
      console.log(`- Total Tasks: ${data.knowledge.stats?.totalTasks || 0}`);
    }
  } catch (error) {
    console.error('❌ API request failed:', error);
  }

  // Also test direct database query for comparison
  console.log('\n🔄 Direct database query for comparison:');
  const { data: notes, error } = await adminClient
    .from('notes')
    .select('id, analysis')
    .eq('user_id', firstUserNote.user_id)
    .not('analysis', 'is', null);

  if (error) {
    console.error('❌ Database query error:', error);
  } else {
    console.log(`✅ Direct query found ${notes?.length || 0} notes with analysis`);
  }
}

testKnowledgeAPI().catch(console.error);