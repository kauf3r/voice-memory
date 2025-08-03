import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function testWithRealToken() {
  console.log('🔍 Testing with real user token...\n');

  // Create a client as a user would
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log('🔐 Attempting to sign in...');
  
  // We need to create a valid session
  // Since we can't easily get a magic link token, let's check what tokens look like
  
  // First, let's see what happens if we try to get user without auth
  const { data: userData, error: userError } = await supabase.auth.getUser();
  console.log('User check result:', { hasUser: !!userData?.user, error: userError?.message });

  // Let's try to get session
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  console.log('Session check result:', { hasSession: !!sessionData?.session, error: sessionError?.message });

  // Since we can't authenticate here, let's simulate what the browser does
  console.log('\n🧪 Checking what the API expects...');
  
  // Test with various token formats
  const testTokens = [
    supabaseAnonKey, // Anon key
    'invalid-token', // Invalid token
  ];

  for (const token of testTokens) {
    console.log(`\n🎟️ Testing with token (first 20 chars): ${token.substring(0, 20)}...`);
    
    try {
      const response = await fetch('http://localhost:3000/api/knowledge', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log(`📨 Status: ${response.status}`);
      
      if (response.status === 401) {
        const errorData = await response.json();
        console.log('❌ Auth error:', errorData);
      } else if (response.ok) {
        console.log('✅ Success! This token works');
        break;
      }
    } catch (error) {
      console.error('❌ Request failed:', error);
    }
  }

  console.log('\n💡 The issue is that we need a valid user access token, not the anon key.');
  console.log('The frontend gets this from supabase.auth.getSession() after login.');
  console.log('Since you clicked the magic link, you should have a valid session in the browser.');
  console.log('\nTo debug further:');
  console.log('1. Open http://localhost:3000 in your browser');
  console.log('2. Log in with the magic link');
  console.log('3. Open browser console (F12)');
  console.log('4. Run: const {data} = await window.supabase.auth.getSession(); console.log(data.session?.access_token);');
  console.log('5. Use that token to test the API manually');
}

testWithRealToken().catch(console.error);