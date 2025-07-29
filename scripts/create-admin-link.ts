import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' })

async function createAdminAuthLink() {
  try {
    console.log('🔐 Creating admin authentication link...')
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    // Get the user associated with our processed notes
    const testUserId = '48b4ff95-a3e4-44a8-a4be-553323387d17'
    
    // Get user details
    const { data: user, error: userError } = await supabase.auth.admin.getUserById(testUserId)
    
    if (userError || !user) {
      console.error('❌ Error getting user:', userError)
      
      // Try to create a user with a test email
      console.log('🔄 Creating test user...')
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: 'admin@voicememory.test',
        password: 'temp-password-123',
        // user_id: testUserId, // Not supported in AdminUserAttributes
        email_confirm: true
      })
      
      if (createError) {
        console.error('❌ Error creating user:', createError)
        return
      }
      
      console.log('✅ Created test user:', newUser.user?.email)
    } else {
      console.log('✅ Found existing user:', user.user.email)
    }

    // Generate a magic link for authentication
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: user?.user?.email || 'admin@voicememory.test'
    })

    if (linkError) {
      console.error('❌ Error generating magic link:', linkError)
      return
    }

    console.log('\n🎯 AUTHENTICATION INSTRUCTIONS:')
    console.log('=' .repeat(50))
    console.log('1. Copy this magic link:')
    console.log('   ' + linkData.properties?.action_link)
    console.log('\n2. Open this link in your browser')
    console.log('3. You will be automatically authenticated')
    console.log('4. Return to http://localhost:3000 to see your processed notes')
    console.log('\n✨ This will give you access to view the 4 processed audio files with complete analysis!')

  } catch (error) {
    console.error('💥 Error creating admin link:', error)
  }
}

createAdminAuthLink()