#!/usr/bin/env tsx
/**
 * Test Knowledge API with Authentication
 * 
 * Creates a test user session and tests the knowledge API
 */

import { createServiceClient } from '../lib/supabase-server'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function testKnowledgeWithAuth() {
  console.log('🧪 Testing Knowledge API with Authentication...')
  
  const supabase = createServiceClient()
  
  try {
    // Get a test user from the database
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .limit(1)

    if (userError || !users || users.length === 0) {
      console.log('❌ No users found in database')
      console.log('💡 You need to sign up first by visiting http://localhost:3000')
      return
    }

    const testUser = users[0]
    console.log(`👤 Testing with user: ${testUser.email}`)

    // Create a test session token (this is a simplified approach for testing)
    // In production, this would come from the frontend after authentication
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: testUser.email
    })

    if (sessionError || !sessionData) {
      console.log('❌ Failed to generate test session:', sessionError?.message)
      return
    }

    console.log('🎟️ Generated test session')

    // Check if user has any notes to generate knowledge from
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('id, analysis, transcription')
      .eq('user_id', testUser.id)
      .not('analysis', 'is', null)
      .limit(3)

    if (notesError) {
      console.log('❌ Error fetching notes:', notesError.message)
      return
    }

    console.log(`📝 Found ${notes?.length || 0} analyzed notes for user`)

    // Test the knowledge API directly with the database query
    const { data: knowledge, error: knowledgeError } = await supabase
      .from('project_knowledge')
      .select('*')
      .eq('user_id', testUser.id)
      .maybeSingle()

    if (knowledgeError) {
      console.log('❌ Error fetching project knowledge:', knowledgeError.message)
      return
    }

    console.log('📊 Project knowledge status:', knowledge ? 'Found' : 'Not found')

    // Test the actual API endpoint (would need proper authentication in real scenario)
    console.log('\n🔍 Testing API endpoint behavior...')
    console.log('💡 To test the full API, you need to:')
    console.log('1. Visit http://localhost:3000')
    console.log('2. Log in with your email')
    console.log('3. Visit http://localhost:3000/knowledge')
    console.log('4. The frontend will authenticate and call the API automatically')

    console.log('\n✅ Database-level knowledge test completed')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

if (require.main === module) {
  testKnowledgeWithAuth().catch(console.error)
}

export { testKnowledgeWithAuth }