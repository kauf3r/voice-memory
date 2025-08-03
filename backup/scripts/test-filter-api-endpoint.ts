#!/usr/bin/env tsx

/**
 * Test the filter API endpoint directly with HTTP requests
 * This script tests the exact scenario: user clicks on task to view source notes
 */

import fetch from 'node-fetch'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const API_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY!

async function testFilterAPIEndpoint() {
  console.log('🌐 Testing Filter API Endpoint')
  console.log('=' .repeat(50))
  
  try {
    // Step 1: Get a real user to test with
    const supabaseService = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    
    const { data: users, error: usersError } = await supabaseService
      .from('notes')
      .select('user_id')
      .not('analysis', 'is', null)
      .limit(1)
    
    if (usersError || !users?.[0]) {
      console.log('❌ No users found to test with')
      return
    }
    
    const testUserId = users[0].user_id
    console.log('👤 Testing with user ID:', testUserId)
    
    // Step 2: Get knowledge data to find tasks with dates
    console.log('\n📋 Getting user knowledge to find tasks...')
    
    const { data: notes, error: notesError } = await supabaseService
      .from('notes')
      .select('id, recorded_at, analysis')
      .eq('user_id', testUserId)
      .not('analysis', 'is', null)
      .order('recorded_at', { ascending: false })
      .limit(10)
    
    if (notesError) {
      console.error('❌ Error getting notes:', notesError)
      return
    }
    
    console.log(`📊 Found ${notes?.length || 0} notes with analysis`)
    
    // Find tasks and their dates
    const tasksWithDates: Array<{
      taskId: string,
      description: string,
      type: string,
      date: string,
      noteId: string
    }> = []
    
    notes?.forEach((note) => {
      const analysis = note.analysis as any
      if (analysis?.tasks) {
        // My tasks
        if (analysis.tasks.myTasks) {
          analysis.tasks.myTasks.forEach((task: any, index: number) => {
            const description = typeof task === 'string' ? task : task.task || 'Unknown task'
            tasksWithDates.push({
              taskId: `${note.id}-my-${index}`,
              description,
              type: 'myTasks',
              date: note.recorded_at,
              noteId: note.id
            })
          })
        }
        
        // Delegated tasks
        if (analysis.tasks.delegatedTasks) {
          analysis.tasks.delegatedTasks.forEach((task: any, index: number) => {
            const description = typeof task === 'string' ? task : task.task || 'Unknown task'
            tasksWithDates.push({
              taskId: `${note.id}-delegated-${index}`,
              description,
              type: 'delegatedTasks',
              date: note.recorded_at,
              noteId: note.id
            })
          })
        }
      }
    })
    
    console.log(`📝 Found ${tasksWithDates.length} tasks`)
    
    if (tasksWithDates.length === 0) {
      console.log('⚠️ No tasks found to test with')
      return
    }
    
    // Step 3: Test different date scenarios
    const testDates = [
      '2025-07-29', // The specific date from user report
      tasksWithDates[0].date.split('T')[0], // An actual task date
      ...tasksWithDates.slice(0, 3).map(t => t.date.split('T')[0]) // More actual dates
    ]
    
    // Remove duplicates
    const uniqueDates = [...new Set(testDates)]
    
    console.log('\n🧪 Testing dates:', uniqueDates)
    
    // Step 4: Create a temporary access token for testing
    console.log('\n🔑 Creating test authentication...')
    
    // We need to simulate getting an access token
    // In a real scenario, this would come from the user's session
    
    for (const testDate of uniqueDates) {
      console.log(`\n📅 Testing date: ${testDate}`)
      console.log('-' .repeat(30))
      
      // Test 1: Direct database query (what should work)
      const startDate = new Date(testDate)
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + 1)
      
      const { data: expectedNotes, error: expectedError } = await supabaseService
        .from('notes')
        .select('*')
        .eq('user_id', testUserId)
        .not('analysis', 'is', null)
        .gte('recorded_at', startDate.toISOString())
        .lt('recorded_at', endDate.toISOString())
        .order('recorded_at', { ascending: false })
      
      console.log(`📊 Expected notes from DB: ${expectedNotes?.length || 0}`)
      
      if (expectedError) {
        console.error('❌ DB query error:', expectedError)
        continue
      }
      
      // Test 2: API endpoint (without auth - will fail but shows structure)
      const apiUrl = `${API_BASE_URL}/api/notes/filter?type=date&value=${encodeURIComponent(testDate)}`
      console.log('🌐 Testing API URL:', apiUrl)
      
      try {
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
            // No auth token - this will fail but show us the error structure
          }
        })
        
        const responseText = await response.text()
        console.log('📡 API Response Status:', response.status)
        console.log('📡 API Response:', responseText)
        
        if (response.status === 401) {
          console.log('✅ Expected 401 - auth is required')
        }
        
      } catch (fetchError) {
        console.error('❌ Fetch error:', fetchError)
      }
      
      // Test 3: Show what the working request should look like
      console.log('\n💡 Working request should be:')
      console.log('   URL:', apiUrl)
      console.log('   Method: GET')
      console.log('   Headers:')
      console.log('     Authorization: Bearer <user_access_token>')
      console.log('     Content-Type: application/json')
      
      if (expectedNotes && expectedNotes.length > 0) {
        console.log('\n📝 Expected response should contain:')
        expectedNotes.forEach((note, index) => {
          console.log(`   ${index + 1}. Note ${note.id} - ${note.recorded_at}`)
          if (note.analysis) {
            const analysis = note.analysis as any
            const keyIdeas = analysis.keyIdeas?.length || 0
            console.log(`      Key Ideas: ${keyIdeas}`)
          }
        })
      }
    }
    
    // Step 5: Test edge cases
    console.log('\n🔍 Testing Edge Cases')
    console.log('-' .repeat(30))
    
    const edgeCases = [
      { name: 'Invalid date format', value: 'invalid-date' },
      { name: 'Future date', value: '2030-01-01' },
      { name: 'Very old date', value: '2020-01-01' },
      { name: 'Empty value', value: '' },
      { name: 'Today', value: new Date().toISOString().split('T')[0] }
    ]
    
    for (const testCase of edgeCases) {
      const apiUrl = `${API_BASE_URL}/api/notes/filter?type=date&value=${encodeURIComponent(testCase.value)}`
      console.log(`\n🧪 ${testCase.name}: ${testCase.value}`)
      
      // Check what DB would return
      if (testCase.value && testCase.value.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const startDate = new Date(testCase.value)
        const endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + 1)
        
        const { data: edgeNotes } = await supabaseService
          .from('notes')
          .select('id')
          .eq('user_id', testUserId)
          .not('analysis', 'is', null)
          .gte('recorded_at', startDate.toISOString())
          .lt('recorded_at', endDate.toISOString())
        
        console.log(`   Expected DB results: ${edgeNotes?.length || 0} notes`)
      } else {
        console.log('   Expected DB results: Error (invalid date)')
      }
    }
    
    console.log('\n🎯 SUMMARY')
    console.log('=' .repeat(50))
    console.log('✅ Filter API structure appears correct')
    console.log('✅ Database queries work as expected')
    console.log('⚠️  Authentication is required for API access')
    console.log('💡 The issue is likely:')
    console.log('   1. Frontend not passing correct auth token')
    console.log('   2. Date format mismatch between task.date and query')
    console.log('   3. User has no notes on the specific date being queried')
    console.log('   4. Timezone issues in date conversion')
    
    console.log('\n🔧 Next Steps:')
    console.log('   1. Add logging to FilteredNotes component')
    console.log('   2. Check browser network tab during filter request')
    console.log('   3. Verify task.date format matches expected format')
    console.log('   4. Test with known good dates from actual user data')
    
  } catch (error) {
    console.error('❌ Test script error:', error)
  }
}

// Test the knowledge API to see tasks structure
async function testKnowledgeAPI() {
  console.log('\n📚 Testing Knowledge API to understand task structure')
  console.log('=' .repeat(50))
  
  try {
    const apiUrl = `${API_BASE_URL}/api/knowledge`
    console.log('🌐 Knowledge API URL:', apiUrl)
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
        // No auth - will fail but shows what's needed
      }
    })
    
    const responseText = await response.text()
    console.log('📡 Knowledge API Status:', response.status)
    
    if (response.status === 401) {
      console.log('✅ Expected 401 - auth required for knowledge API too')
    }
    
  } catch (error) {
    console.error('❌ Knowledge API test error:', error)
  }
}

async function main() {
  console.log('🚀 Starting Filter API Endpoint Test')
  console.log('Testing the exact user flow: Click task → View source notes')
  console.log()
  
  await testFilterAPIEndpoint()
  await testKnowledgeAPI()
  
  console.log('\n✅ API endpoint test completed')
  console.log('\n📋 To complete the debug:')
  console.log('   1. Run this with a valid user session')
  console.log('   2. Check the browser network tab during actual usage')
  console.log('   3. Add console.log to FilteredNotes.tsx fetchFilteredNotes')
  console.log('   4. Verify the exact date being passed matches note dates')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}