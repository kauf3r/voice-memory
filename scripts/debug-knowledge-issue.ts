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

async function debugKnowledgeIssue() {
  console.log('🔍 Debugging Knowledge Base Issue...\n');

  // 1. Check all users
  console.log('👥 Checking all users:');
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (usersError) {
    console.error('❌ Error fetching users:', usersError);
    return;
  }

  console.log(`Found ${users?.length || 0} users:`);
  users?.forEach(user => {
    console.log(`  - ${user.email} (ID: ${user.id})`);
  });

  // 2. Check auth.users table
  console.log('\n🔐 Checking auth.users table:');
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error('❌ Error fetching auth users:', authError);
  } else {
    console.log(`Found ${authUsers?.users?.length || 0} auth users:`);
    authUsers?.users?.forEach(user => {
      console.log(`  - ${user.email} (ID: ${user.id})`);
    });
  }

  // 3. Check for ID mismatches
  console.log('\n🔄 Checking for ID mismatches:');
  const publicUserIds = new Set(users?.map(u => u.id) || []);
  const authUserIds = new Set(authUsers?.users?.map(u => u.id) || []);
  
  const missingInPublic = [...authUserIds].filter(id => !publicUserIds.has(id));
  const missingInAuth = [...publicUserIds].filter(id => !authUserIds.has(id));
  
  if (missingInPublic.length > 0) {
    console.log('❌ Auth users missing in public.users table:', missingInPublic);
  }
  if (missingInAuth.length > 0) {
    console.log('❌ Public users missing in auth.users table:', missingInAuth);
  }
  if (missingInPublic.length === 0 && missingInAuth.length === 0) {
    console.log('✅ All user IDs match between auth and public tables');
  }

  // 4. Check notes by user
  console.log('\n📝 Checking notes by user:');
  for (const user of users || []) {
    const { data: notes, count } = await supabase
      .from('notes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const { data: analyzedNotes, count: analyzedCount } = await supabase
      .from('notes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('analysis', 'is', null);

    console.log(`  ${user.email}: ${count || 0} total notes, ${analyzedCount || 0} with analysis`);
  }

  // 5. Test aggregation for specific user
  const testEmail = 'andyalex66@gmail.com';
  console.log(`\n🧪 Testing aggregation for ${testEmail}:`);
  
  const { data: testUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', testEmail)
    .single();

  if (testUser) {
    const { data: testNotes, error: testError } = await supabase
      .from('notes')
      .select('id, analysis, transcript, recorded_at')
      .eq('user_id', testUser.id)
      .not('analysis', 'is', null)
      .order('recorded_at', { ascending: false });

    if (testError) {
      console.error('❌ Error fetching test notes:', testError);
    } else {
      console.log(`✅ Found ${testNotes?.length || 0} notes for test user`);
      
      if (testNotes && testNotes.length > 0) {
        console.log('\nSample analysis structure:');
        const sampleAnalysis = testNotes[0].analysis;
        if (sampleAnalysis) {
          Object.keys(sampleAnalysis).forEach(key => {
            const value = sampleAnalysis[key];
            const info = Array.isArray(value) ? `array[${value.length}]` : typeof value;
            console.log(`  - ${key}: ${info}`);
          });
        }
      }
    }
  }

  // 6. Check for any RLS policies
  console.log('\n🔒 Checking RLS policies status:');
  const { data: rlsStatus } = await supabase
    .from('notes')
    .select('id')
    .limit(1);
  
  console.log('Notes table RLS test:', rlsStatus ? '✅ Accessible' : '❌ Blocked');
}

debugKnowledgeIssue().catch(console.error);