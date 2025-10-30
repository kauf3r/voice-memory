#!/usr/bin/env tsx

/**
 * Debug Knowledge Data Flow - Quick Diagnostic Script
 * 
 * This script helps diagnose why the knowledge page shows "No Knowledge Available"
 * when users have successfully processed voice notes.
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  console.error('Need: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugKnowledgeDataFlow() {
  console.log('🔍 Voice Memory Knowledge Data Flow Diagnostic\n')
  
  try {
    // 1. Check for users in the system
    console.log('1️⃣ Checking users in system...')
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, email')
      .limit(5)
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError)
      return
    }
    
    console.log(`✅ Found ${users?.length || 0} users`)
    if (users && users.length > 0) {
      console.log('👥 Sample users:', users.map(u => ({ id: u.id, email: u.email })))
    }
    
    // 2. Check for notes with analysis data
    console.log('\n2️⃣ Checking processed notes with analysis...')
    const { data: processedNotes, error: notesError } = await supabase
      .from('notes')
      .select('id, user_id, analysis, transcription, recorded_at, processed_at')
      .not('analysis', 'is', null)
      .limit(10)
    
    if (notesError) {
      console.error('❌ Error fetching processed notes:', notesError)
      return
    }
    
    console.log(`✅ Found ${processedNotes?.length || 0} notes with analysis data`)
    
    if (processedNotes && processedNotes.length > 0) {
      console.log('\n📊 Sample processed note analysis structures:')
      processedNotes.slice(0, 3).forEach((note, i) => {
        console.log(`\n📝 Note ${i + 1} (${note.id}):`)
        console.log(`   User: ${note.user_id}`)
        console.log(`   Recorded: ${note.recorded_at}`)
        console.log(`   Processed: ${note.processed_at}`)
        
        if (note.analysis) {
          const analysis = note.analysis
          console.log('   🧠 Analysis structure:')
          console.log(`      - Key Ideas: ${analysis.keyIdeas?.length || 0}`)
          console.log(`      - Tasks: ${analysis.tasks?.myTasks?.length || 0} my tasks, ${analysis.tasks?.delegatedTasks?.length || 0} delegated`)
          console.log(`      - Messages: ${analysis.messagesToDraft?.length || 0}`)
          console.log(`      - Outreach: ${analysis.outreachIdeas?.length || 0}`)
          console.log(`      - Sentiment: ${analysis.sentiment?.classification || 'none'}`)
          console.log(`      - Primary Topic: ${analysis.focusTopics?.primary || 'none'}`)
          console.log(`      - Minor Topics: ${analysis.focusTopics?.minor?.length || 0}`)
          
          if (analysis.keyIdeas && analysis.keyIdeas.length > 0) {
            console.log(`      📍 Sample insight: "${analysis.keyIdeas[0].substring(0, 80)}..."`)
          }
        }
      })
      
      // 3. Test knowledge aggregation for a specific user
      console.log('\n3️⃣ Testing knowledge aggregation for sample user...')
      const sampleUserId = processedNotes[0].user_id
      
      const { data: userNotes, error: userNotesError } = await supabase
        .from('notes')
        .select('id, analysis, transcription, recorded_at, processed_at')
        .eq('user_id', sampleUserId)
        .not('analysis', 'is', null)
        .order('recorded_at', { ascending: false })
      
      if (userNotesError) {
        console.error('❌ Error fetching user notes:', userNotesError)
        return
      }
      
      console.log(`✅ User ${sampleUserId} has ${userNotes?.length || 0} processed notes`)
      
      if (userNotes && userNotes.length > 0) {
        // Simulate the aggregation logic
        let totalInsights = 0
        let totalTasks = 0
        let topTopics: Record<string, number> = {}
        let keyContacts: Record<string, number> = {}
        
        userNotes.forEach(note => {
          const analysis = note.analysis
          if (analysis) {
            totalInsights += analysis.keyIdeas?.length || 0
            totalTasks += (analysis.tasks?.myTasks?.length || 0) + (analysis.tasks?.delegatedTasks?.length || 0)
            
            if (analysis.focusTopics?.primary) {
              topTopics[analysis.focusTopics.primary] = (topTopics[analysis.focusTopics.primary] || 0) + 1
            }
            
            if (analysis.outreachIdeas) {
              analysis.outreachIdeas.forEach((idea: any) => {
                if (idea.contact) {
                  keyContacts[idea.contact] = (keyContacts[idea.contact] || 0) + 1
                }
              })
            }
          }
        })
        
        console.log('\n📈 Aggregated Knowledge Stats:')
        console.log(`   📚 Total Notes: ${userNotes.length}`)
        console.log(`   💡 Total Insights: ${totalInsights}`)
        console.log(`   ✅ Total Tasks: ${totalTasks}`)
        console.log(`   🏷️ Top Topics: ${Object.keys(topTopics).length} unique`)
        console.log(`   👥 Key Contacts: ${Object.keys(keyContacts).length} unique`)
        
        if (Object.keys(topTopics).length > 0) {
          console.log('\n   🔝 Top 3 Topics:')
          Object.entries(topTopics)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .forEach(([topic, count]) => {
              console.log(`      - ${topic}: ${count} mentions`)
            })
        }
        
        // 4. Check project_knowledge table
        console.log('\n4️⃣ Checking project_knowledge table...')
        const { data: projectKnowledge, error: pkError } = await supabase
          .from('project_knowledge')
          .select('*')
          .eq('user_id', sampleUserId)
          .single()
        
        if (pkError && pkError.code !== 'PGRST116') {
          console.error('❌ Error fetching project knowledge:', pkError)
        } else if (pkError?.code === 'PGRST116') {
          console.log('⚠️ No project_knowledge record found for user')
        } else {
          console.log('✅ Project knowledge record exists')
          console.log(`   Updated: ${projectKnowledge.updated_at}`)
          console.log(`   Content size: ${JSON.stringify(projectKnowledge.content).length} characters`)
        }
      }
    } else {
      console.log('⚠️ No processed notes found in the system!')
      console.log('This could mean:')
      console.log('  - Users are uploading but processing is failing')
      console.log('  - Processing is working but not storing analysis data')
      console.log('  - No users have uploaded any files yet')
    }
    
    // 5. Quick auth test
    console.log('\n5️⃣ Testing API authentication...')
    console.log('ℹ️ This would need to be tested with actual user tokens')
    console.log('   The /api/knowledge endpoint expects Bearer tokens from frontend')
    
    console.log('\n🎯 DIAGNOSIS COMPLETE!')
    console.log('\nNext steps based on findings:')
    if (processedNotes && processedNotes.length > 0) {
      console.log('✅ Data exists - likely an authentication or API issue')
      console.log('   → Test the /api/knowledge endpoint with real user tokens')
      console.log('   → Check frontend authentication flow')
    } else {
      console.log('❌ No processed data found - processing pipeline issue')
      console.log('   → Check if audio files are being processed correctly')
      console.log('   → Verify analysis data is being saved to database')
    }
    
  } catch (error) {
    console.error('💥 Fatal error during diagnosis:', error)
  }
}

// Run the diagnostic
debugKnowledgeDataFlow()