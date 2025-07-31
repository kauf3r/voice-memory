import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' })

async function fixAuthSetup() {
  try {
    console.log('🔧 Fixing authentication setup...')
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    const testUserId = '48b4ff95-a3e4-44a8-a4be-553323387d17'
    
    // First, check if user exists in auth.users
    console.log('1. Checking current user...')
    const { data: currentUser, error: getUserError } = await supabase.auth.admin.getUserById(testUserId)
    
    if (getUserError) {
      console.log('❌ User not found in auth.users:', getUserError.message)
      
      // Get the email from the users table
      const { data: dbUser, error: dbError } = await supabase
        .from('users')
        .select('email')
        .eq('id', testUserId)
        .single()
      
      if (dbError || !dbUser) {
        console.log('❌ User not found in users table either:', dbError?.message)
        
        // Create both auth user and database user
        console.log('🔄 Creating complete user setup...')
        
        const email = 'admin@voicememory.test'
        
        // Create auth user
        const { data: newAuthUser, error: createAuthError } = await supabase.auth.admin.createUser({
          email: email,
          password: 'VoiceMemory2025!',
          user_id: testUserId,
          email_confirm: true
        })
        
        if (createAuthError) {
          console.error('❌ Error creating auth user:', createAuthError)
          return
        }
        
        // Update users table
        const { error: updateDbError } = await supabase
          .from('users')
          .upsert({
            id: testUserId,
            email: email,
            created_at: new Date().toISOString()
          })
        
        if (updateDbError) {
          console.error('❌ Error updating users table:', updateDbError)
        }
        
        console.log('✅ Created complete user setup')
      } else {
        // User exists in database but not in auth
        console.log('🔄 Creating auth user for existing database user...')
        
        const { data: newAuthUser, error: createAuthError } = await supabase.auth.admin.createUser({
          email: dbUser.email,
          password: 'VoiceMemory2025!',
          user_id: testUserId,
          email_confirm: true
        })
        
        if (createAuthError) {
          console.error('❌ Error creating auth user:', createAuthError)
          return
        }
        
        console.log('✅ Created auth user for existing database user')
      }
    } else {
      console.log('✅ User exists:', currentUser.user.email)
    }

    // Method 1: Try magic link again
    console.log('\n📧 Method 1: Magic Link')
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: currentUser?.user?.email || 'admin@voicememory.test'
    })

    if (!linkError && linkData.properties?.action_link) {
      console.log('Magic Link:', linkData.properties.action_link)
    }

    // Method 2: Create a simple login with email/password
    console.log('\n🔑 Method 2: Email/Password Login')
    console.log('Email: admin@voicememory.test')
    console.log('Password: VoiceMemory2025!')
    console.log('Use these credentials in the login form')

    // Method 3: Create a test script to directly sign in
    console.log('\n⚡ Method 3: Direct Browser Login Script')
    console.log('Run this in your browser console on localhost:3000:')
    console.log(`
// Paste this in browser console:
const { createClient } = supabase;
const supabaseClient = createClient(
  '${process.env.NEXT_PUBLIC_SUPABASE_URL}',
  '${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}'
);

supabaseClient.auth.signInWithPassword({
  email: 'admin@voicememory.test',
  password: 'VoiceMemory2025!'
}).then(result => {
  console.log('Auth result:', result);
  if (result.data.user) {
    console.log('✅ Logged in successfully!');
    window.location.reload();
  }
});
`)

  } catch (error) {
    console.error('💥 Error fixing auth setup:', error)
  }
}

fixAuthSetup()