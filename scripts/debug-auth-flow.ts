import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function debugAuthFlow() {
  console.log('🔍 Debugging Authentication Flow...\n');

  // Create client
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log('📋 Environment Check:');
  console.log(`  - Supabase URL: ${supabaseUrl}`);
  console.log(`  - Anon Key (first 20): ${supabaseAnonKey.substring(0, 20)}...`);
  console.log(`  - App URL: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}`);

  console.log('\n🔐 Testing Supabase Auth Setup:');
  
  // Test if we can create a client
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log('✅ Supabase client created successfully');
    console.log(`📋 Session check: ${session ? 'Has session' : 'No session'}`);
    
    if (sessionError) {
      console.log(`❌ Session error: ${sessionError.message}`);
    }
  } catch (error) {
    console.error('❌ Failed to create Supabase client:', error);
  }

  console.log('\n📧 Manual Login Instructions:');
  console.log('Since there\'s a rate limit, please try this manual approach:');
  console.log('');
  console.log('1. Open your browser to: http://localhost:3000');
  console.log('2. Enter this email: andy@andykaufman.net');
  console.log('3. Click "Send Magic Link"');
  console.log('4. Check your email and click the magic link');
  console.log('5. You should be redirected back to the app');
  console.log('');
  console.log('If you\'re still seeing "Not authenticated", try:');
  console.log('- Clear browser cache (Cmd+Shift+R or Ctrl+Shift+R)');
  console.log('- Try in an incognito/private browser window');
  console.log('- Make sure cookies are enabled');
  console.log('');
  console.log('🔍 To debug further, after logging in:');
  console.log('1. Open browser devtools (F12)');
  console.log('2. Go to Application/Storage tab');
  console.log('3. Look for localStorage items with "supabase" in the name');
  console.log('4. Check if there\'s a valid session stored');
  console.log('');
  console.log('Or in the Console tab, run:');
  console.log('window.localStorage.getItem(\'sb-vbjszugsvrqxosbtffqw-auth-token\')');
}

debugAuthFlow().catch(console.error);