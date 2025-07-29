#!/usr/bin/env tsx

/**
 * Test Frontend Authentication Flow
 * 
 * This simulates exactly what the frontend does when calling the knowledge API
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create client exactly like frontend does
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testFrontendAuthFlow() {
  console.log('🔐 Testing Frontend Authentication Flow\n')
  
  // Test 1: Check current session (like frontend does)
  console.log('1️⃣ Checking current session...')
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  
  if (sessionError) {
    console.error('❌ Session error:', sessionError)
    return
  }
  
  if (!session) {
    console.log('❌ No active session found')
    console.log('This explains why the knowledge page shows "No Knowledge Available"!')
    console.log('The frontend is trying to fetch knowledge without being logged in.')
    
    console.log('\n🔧 SOLUTION NEEDED:')
    console.log('   1. Frontend needs proper session management')
    console.log('   2. Users need to be properly logged in when accessing knowledge page')
    console.log('   3. Session persistence between upload and knowledge page needs fixing')
    
    // Try to see if there are any users we can sign in as
    console.log('\n2️⃣ Checking available test users...')
    
    // Try signing in as the user we know has data
    console.log('3️⃣ Attempting to sign in as test user...')
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'andy@andykaufman.net',
      password: 'test123' // Common test password
    })
    
    if (signInError) {
      console.log('❌ Could not sign in with test credentials')
      console.log('This means we need to either:')
      console.log('   - Create a test user session')
      console.log('   - Fix the authentication flow in the app')
      console.log('   - Debug why users are not staying logged in')
    } else {
      console.log('✅ Successfully signed in!')
      console.log(`User: ${signInData.user?.email}`)
      console.log(`Session token: ${signInData.session?.access_token?.substring(0, 20)}...`)
      
      // Now test the knowledge API with this session
      await testKnowledgeAPIWithSession(signInData.session?.access_token!)
    }
    
    return
  }
  
  console.log('✅ Active session found!')
  console.log(`User: ${session.user?.email}`)
  console.log(`Token: ${session.access_token?.substring(0, 20)}...`)
  
  // Test the knowledge API with this session
  await testKnowledgeAPIWithSession(session.access_token)
}

async function testKnowledgeAPIWithSession(token: string) {
  console.log('\n4️⃣ Testing knowledge API with session token...')
  
  try {
    const response = await fetch('http://localhost:3000/api/knowledge', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (!response.ok) {
      console.error(`❌ API request failed: ${response.status} ${response.statusText}`)
      const errorText = await response.text()
      console.error('Error details:', errorText)
      return
    }
    
    const data = await response.json()
    console.log('✅ API call successful!')
    
    if (data.knowledge && data.knowledge.stats) {
      const stats = data.knowledge.stats
      console.log('📊 Received knowledge data:')
      console.log(`   Notes: ${stats.totalNotes}`)
      console.log(`   Insights: ${stats.totalInsights}`)
      console.log(`   Tasks: ${stats.totalTasks}`)
      console.log(`   Topics: ${Object.keys(data.knowledge.content?.topTopics || {}).length}`)
      
      if (stats.totalNotes > 0) {
        console.log('🎉 SUCCESS! The API is returning data properly!')
        console.log('The frontend authentication flow is working.')
      } else {
        console.log('❌ API returned empty stats despite having data')
        console.log('There might be a user ID mismatch in the API logic.')
      }
    } else {
      console.log('❌ API response missing expected knowledge structure')
      console.log('Response:', JSON.stringify(data, null, 2))
    }
    
  } catch (error) {
    console.error('💥 API call failed:', error)
  }
}

testFrontendAuthFlow().catch(console.error)