import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function sendMagicLink() {
  console.log('🔍 Sending Magic Link for Testing...\n');

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // The email that actually has data
  const userEmail = 'andy@andykaufman.net';
  
  console.log(`📧 Sending magic link to: ${userEmail}`);
  
  const { error } = await supabase.auth.signInWithOtp({
    email: userEmail,
    options: {
      shouldCreateUser: false,
    }
  });

  if (error) {
    console.error('❌ Failed to send magic link:', error);
    return;
  }

  console.log('✅ Magic link sent successfully!');
  console.log('\n📝 Next steps:');
  console.log('1. Check your email for the magic link');
  console.log('2. Click the link to authenticate');
  console.log('3. Navigate to http://localhost:3000/knowledge');
  console.log('4. Open browser devtools (F12) and check the Console tab');
  console.log('5. Look for the debug logs starting with 🔍 📋 📡 📊');
  console.log('\nThe user has 12 notes with analysis, so you should see data!');
}

sendMagicLink().catch(console.error);