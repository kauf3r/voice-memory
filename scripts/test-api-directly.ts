import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function testAPIDirectly() {
  console.log('🔍 Testing API Directly...\n');

  // Create admin client to generate a token
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Get the user with notes
  const testEmail = 'andy@andykaufman.net';
  const { data: user } = await adminClient
    .from('users')
    .select('id')
    .eq('email', testEmail)
    .single();

  if (!user) {
    console.error('❌ User not found');
    return;
  }

  console.log(`✅ Found user: ${testEmail} (${user.id})`);

  // Generate a magic link to get a token
  const { data: magicLinkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: testEmail,
  });

  if (linkError || !magicLinkData) {
    console.error('❌ Failed to generate magic link:', linkError);
    return;
  }

  // Extract the access token from the magic link
  const url = new URL(magicLinkData.properties.action_link);
  const accessToken = url.searchParams.get('access_token');

  if (!accessToken) {
    console.error('❌ No access token in magic link');
    return;
  }

  console.log('🎟️ Generated access token (first 20 chars):', accessToken.substring(0, 20) + '...');

  // Test the API with the token
  try {
    console.log('\n📡 Testing /api/knowledge endpoint...');
    
    const response = await fetch('http://localhost:3000/api/knowledge', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      return;
    }

    const data = await response.json();
    
    console.log('✅ API Response received');
    console.log('\n📊 Knowledge Stats:');
    if (data.knowledge?.stats) {
      const stats = data.knowledge.stats;
      console.log(`  - Total Notes: ${stats.totalNotes}`);
      console.log(`  - Total Insights: ${stats.totalInsights}`);
      console.log(`  - Total Tasks: ${stats.totalTasks}`);
      console.log(`  - Total Messages: ${stats.totalMessages}`);
      console.log(`  - Total Outreach: ${stats.totalOutreach}`);
    } else {
      console.log('❌ No stats found in response');
    }

    console.log('\n🔍 Response structure:');
    console.log(`  - success: ${data.success}`);
    console.log(`  - knowledge present: ${!!data.knowledge}`);
    
    if (data.knowledge) {
      console.log(`  - stats present: ${!!data.knowledge.stats}`);
      console.log(`  - content present: ${!!data.knowledge.content}`);
      console.log(`  - projectKnowledge present: ${!!data.knowledge.projectKnowledge}`);
    }

  } catch (error) {
    console.error('❌ API request failed:', error);
  }
}

testAPIDirectly().catch(console.error);