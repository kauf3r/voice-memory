#!/usr/bin/env tsx

/**
 * Debug script to test the date filter API endpoint
 * This script tests the specific date "2025-07-29" that was shown in the modal
 * and debugs why the date filtering isn't working when users click on tasks.
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY!

async function debugDateFilter() {
  console.log('🔍 DEBUG: Date Filter API Testing')
  console.log('=' .repeat(50))

  // Test date from the user report
  const testDate = '2025-07-29'
  
  try {
    // Create service role client for database inspection
    const supabaseService = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    
    console.log('📋 Step 1: Direct database query to check for notes on', testDate)
    
    // Query all notes for the test date range directly
    const startDate = new Date(testDate)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 1)
    
    console.log('📅 Date range for filter:')
    console.log('  Start:', startDate.toISOString())
    console.log('  End:', endDate.toISOString())
    
    const { data: allNotes, error: allNotesError } = await supabaseService
      .from('notes')
      .select('id, user_id, recorded_at, transcription, analysis, created_at')
      .gte('recorded_at', startDate.toISOString())
      .lt('recorded_at', endDate.toISOString())
      .order('recorded_at', { ascending: false })
    
    if (allNotesError) {
      console.error('❌ Error querying notes:', allNotesError)
      return
    }
    
    console.log(`📊 Found ${allNotes?.length || 0} notes in database for ${testDate}`)
    
    if (allNotes && allNotes.length > 0) {
      console.log('\n📝 Notes found:')
      allNotes.forEach((note, index) => {
        console.log(`  ${index + 1}. Note ID: ${note.id}`)
        console.log(`     User ID: ${note.user_id}`)
        console.log(`     Recorded: ${note.recorded_at}`)
        console.log(`     Has Analysis: ${!!note.analysis}`)
        console.log(`     Has Transcription: ${!!note.transcription}`)
        console.log(`     Created: ${note.created_at}`)
        
        if (note.analysis) {
          const analysis = note.analysis as any
          console.log(`     Analysis Keys: ${Object.keys(analysis).join(', ')}`)
          
          // Check for tasks specifically
          if (analysis.tasks) {
            const myTasks = analysis.tasks.myTasks?.length || 0
            const delegatedTasks = analysis.tasks.delegatedTasks?.length || 0
            console.log(`     Tasks: ${myTasks} my tasks, ${delegatedTasks} delegated`)
          }
        }
        console.log()
      })
    } else {
      console.log('🤔 No notes found in database for this date range')
      
      // Let's check what dates DO exist
      const { data: existingNotes, error: existingError } = await supabaseService
        .from('notes')
        .select('recorded_at, user_id')
        .not('analysis', 'is', null)
        .order('recorded_at', { ascending: false })
        .limit(10)
      
      if (existingError) {
        console.error('❌ Error querying existing notes:', existingError)
      } else {
        console.log('📅 Recent notes with analysis (last 10):')
        existingNotes?.forEach((note, index) => {
          const date = new Date(note.recorded_at).toISOString().split('T')[0]
          console.log(`  ${index + 1}. ${date} (${note.recorded_at}) - User: ${note.user_id}`)
        })
      }
    }
    
    console.log('\n📋 Step 2: Test API endpoint with simulated auth')
    
    // We'll need to test with a real user - let's get the first user from recent notes
    const { data: userNotes, error: userNotesError } = await supabaseService
      .from('notes')
      .select('user_id')
      .not('analysis', 'is', null)
      .limit(1)
    
    if (userNotesError || !userNotes?.[0]) {
      console.log('⚠️ No users found with analyzed notes to test with')
      return
    }
    
    const testUserId = userNotes[0].user_id
    console.log('👤 Testing with user ID:', testUserId)
    
    // Get user notes for the test date
    const { data: userDateNotes, error: userDateError } = await supabaseService
      .from('notes')
      .select('*')
      .eq('user_id', testUserId)
      .not('analysis', 'is', null)
      .gte('recorded_at', startDate.toISOString())
      .lt('recorded_at', endDate.toISOString())
      .order('recorded_at', { ascending: false })
    
    if (userDateError) {
      console.error('❌ Error querying user date notes:', userDateError)
      return
    }
    
    console.log(`📊 User ${testUserId} has ${userDateNotes?.length || 0} notes on ${testDate}`)
    
    // Now test the actual API logic
    console.log('\n📋 Step 3: Simulate API filter logic')
    
    // Simulate the exact logic from the filter API
    let query = supabaseService
      .from('notes')
      .select('*')
      .eq('user_id', testUserId)
      .not('analysis', 'is', null)
      .order('recorded_at', { ascending: false })
    
    // Apply date filter (exact logic from API)
    query = query
      .gte('recorded_at', startDate.toISOString())
      .lt('recorded_at', endDate.toISOString())
    
    const { data: filteredNotes, error: filteredError } = await query
    
    if (filteredError) {
      console.error('❌ Filter query error:', filteredError)
      return
    }
    
    console.log(`✅ Filter API simulation result: ${filteredNotes?.length || 0} notes`)
    
    if (filteredNotes && filteredNotes.length > 0) {
      console.log('\n📝 Filtered notes details:')
      filteredNotes.forEach((note, index) => {
        console.log(`  ${index + 1}. ${note.id} - ${note.recorded_at}`)
        
        if (note.analysis) {
          const analysis = note.analysis as any
          if (analysis.keyIdeas) {
            console.log(`     Key Ideas: ${analysis.keyIdeas.length} items`)
            console.log(`     First Idea: "${analysis.keyIdeas[0]?.substring(0, 100)}..."`)
          }
        }
      })
    }
    
    console.log('\n📋 Step 4: Test API endpoint via HTTP (if possible)')
    
    // For a complete test, we'd need a valid access token
    // Let's just show what the request would look like
    const apiUrl = `http://localhost:3000/api/notes/filter?type=date&value=${encodeURIComponent(testDate)}`
    console.log('🌐 API URL would be:', apiUrl)
    console.log('🔑 Headers would need: Authorization: Bearer <access_token>')
    
    console.log('\n📋 Step 5: Check task date formats')
    
    // Let's check if there are tasks with dates that might match
    const { data: notesWithTasks, error: tasksError } = await supabaseService
      .from('notes')
      .select('id, recorded_at, analysis')
      .eq('user_id', testUserId)
      .not('analysis', 'is', null)
      .order('recorded_at', { ascending: false })
      .limit(20)
    
    if (tasksError) {
      console.error('❌ Error querying notes with tasks:', tasksError)
      return
    }
    
    console.log('\n📋 Checking task dates in recent notes:')
    let taskCount = 0
    
    notesWithTasks?.forEach((note) => {
      const analysis = note.analysis as any
      if (analysis?.tasks) {
        const myTasks = analysis.tasks.myTasks || []
        const delegatedTasks = analysis.tasks.delegatedTasks || []
        
        const noteDate = note.recorded_at.split('T')[0]
        
        if (myTasks.length > 0 || delegatedTasks.length > 0) {
          taskCount++
          console.log(`  Note ${note.id} (${noteDate}):`)
          console.log(`    My Tasks: ${myTasks.length}`)
          console.log(`    Delegated: ${delegatedTasks.length}`)
          
          if (noteDate === testDate) {
            console.log(`    ⭐ MATCHES TEST DATE: ${testDate}`)
          }
        }
      }
    })
    
    console.log(`\n📊 Summary: Found ${taskCount} notes with tasks`)
    
    console.log('\n🔍 DEBUG COMPLETE')
    console.log('=' .repeat(50))
    
    // Final diagnosis
    console.log('\n🎯 DIAGNOSIS:')
    if ((filteredNotes?.length || 0) === 0) {
      console.log('❌ The date filter returns 0 results because:')
      console.log('   1. No notes exist for the exact date range being queried')
      console.log('   2. The date format conversion might be causing issues')
      console.log('   3. The user might not have notes with analysis on that date')
      console.log('\n💡 RECOMMENDATIONS:')
      console.log('   1. Check if task.date format matches recorded_at format')
      console.log('   2. Verify timezone handling in date conversion')
      console.log('   3. Add logging to the API to see exact query parameters')
      console.log('   4. Check if the user clicking has notes on that date')
    } else {
      console.log('✅ The date filter logic works correctly')
      console.log('   The issue might be in the frontend or authentication')
    }
    
  } catch (error) {
    console.error('❌ Debug script error:', error)
  }
}

// Test different date formats and edge cases
async function testDateFormats() {
  console.log('\n🔍 Testing different date formats...')
  
  const testDates = [
    '2025-07-29',
    '2025-07-28', 
    '2025-07-30',
    new Date().toISOString().split('T')[0], // Today
  ]
  
  const supabaseService = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  
  for (const testDate of testDates) {
    const startDate = new Date(testDate)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 1)
    
    const { data, error } = await supabaseService
      .from('notes')
      .select('id, recorded_at, user_id')
      .gte('recorded_at', startDate.toISOString())
      .lt('recorded_at', endDate.toISOString())
    
    console.log(`📅 ${testDate}: ${data?.length || 0} notes ${error ? '(ERROR)' : ''}`)
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting Date Filter Debug Script')
  console.log('Testing with date: 2025-07-29')
  console.log()
  
  await debugDateFilter()
  await testDateFormats()
  
  console.log('\n✅ Debug script completed')
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}