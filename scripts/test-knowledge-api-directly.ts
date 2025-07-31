#!/usr/bin/env tsx

/**
 * Test Knowledge API Directly
 * 
 * This simulates what the frontend does and tests the actual API response
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testKnowledgeAPI() {
  console.log('🧪 Testing Knowledge API Directly\n')
  
  // First, let's get the user who has processed notes
  const userId = '48b4ff95-a3e4-44a8-a4be-553323387d17' // andy@andykaufman.net
  console.log(`Testing with user ID: ${userId}`)
  
  // Test the exact same query the API uses
  console.log('\n1️⃣ Testing notes query (what API does):')
  const { data: notes, error: notesError } = await supabase
    .from('notes')
    .select('id, analysis, transcription, recorded_at, processed_at')
    .eq('user_id', userId)
    .not('analysis', 'is', null)
    .order('recorded_at', { ascending: false })

  if (notesError) {
    console.error('❌ Notes query failed:', notesError)
    return
  }

  console.log(`✅ Found ${notes?.length || 0} notes with analysis`)
  
  if (notes && notes.length > 0) {
    console.log('\n📊 Sample analysis data:')
    const sample = notes[0]
    console.log(`Note ID: ${sample.id}`)
    console.log(`Recorded: ${sample.recorded_at}`)
    console.log(`Processed: ${sample.processed_at}`)
    
    if (sample.analysis) {
      console.log('Analysis structure:')
      console.log(`  - keyIdeas: ${sample.analysis.keyIdeas?.length || 0}`)
      console.log(`  - tasks.myTasks: ${sample.analysis.tasks?.myTasks?.length || 0}`)
      console.log(`  - tasks.delegatedTasks: ${sample.analysis.tasks?.delegatedTasks?.length || 0}`)
      console.log(`  - messagesToDraft: ${sample.analysis.messagesToDraft?.length || 0}`)
      console.log(`  - outreachIdeas: ${sample.analysis.outreachIdeas?.length || 0}`)
      console.log(`  - sentiment: ${sample.analysis.sentiment?.classification || 'none'}`)
      console.log(`  - focusTopics.primary: ${sample.analysis.focusTopics?.primary || 'none'}`)
      console.log(`  - focusTopics.minor: ${sample.analysis.focusTopics?.minor?.length || 0}`)
      
      if (sample.analysis.keyIdeas?.[0]) {
        console.log(`  📝 Sample insight: "${sample.analysis.keyIdeas[0].substring(0, 100)}..."`)
      }
    }
    
    // Now test the aggregation function manually
    console.log('\n2️⃣ Testing aggregation logic:')
    
    let totalInsights = 0
    let totalTasks = 0
    let totalMessages = 0
    let totalOutreach = 0
    let sentimentCounts = { positive: 0, neutral: 0, negative: 0 }
    let topTopics: Record<string, number> = {}
    let keyContacts: Record<string, number> = {}
    let timeRange = { earliest: null as string | null, latest: null as string | null }
    
    for (const note of notes) {
      const analysis = note.analysis
      if (!analysis) continue
      
      // Count insights
      if (analysis.keyIdeas) {
        totalInsights += analysis.keyIdeas.length
      }
      
      // Count tasks
      if (analysis.tasks?.myTasks) {
        totalTasks += analysis.tasks.myTasks.length
      }
      if (analysis.tasks?.delegatedTasks) {
        totalTasks += analysis.tasks.delegatedTasks.length
      }
      
      // Count messages
      if (analysis.messagesToDraft) {
        totalMessages += analysis.messagesToDraft.length
      }
      
      // Count outreach
      if (analysis.outreachIdeas) {
        totalOutreach += analysis.outreachIdeas.length
        
        // Extract contacts from outreach
        analysis.outreachIdeas.forEach((idea: any) => {
          if (idea.contact) {
            keyContacts[idea.contact] = (keyContacts[idea.contact] || 0) + 1
          }
        })
      }
      
      // Sentiment
      if (analysis.sentiment?.classification) {
        const sentiment = analysis.sentiment.classification.toLowerCase()
        if (sentiment in sentimentCounts) {
          sentimentCounts[sentiment as keyof typeof sentimentCounts]++
        }
      }
      
      // Topics
      if (analysis.focusTopics?.primary) {
        topTopics[analysis.focusTopics.primary] = (topTopics[analysis.focusTopics.primary] || 0) + 1
      }
      if (analysis.focusTopics?.minor) {
        analysis.focusTopics.minor.forEach((topic: string) => {
          topTopics[topic] = (topTopics[topic] || 0) + 1
        })
      }
      
      // Time range
      if (!timeRange.earliest || note.recorded_at < timeRange.earliest) {
        timeRange.earliest = note.recorded_at
      }
      if (!timeRange.latest || note.recorded_at > timeRange.latest) {
        timeRange.latest = note.recorded_at
      }
    }
    
    console.log('📊 Aggregated Results:')
    console.log(`  📚 Total Notes: ${notes.length}`)
    console.log(`  💡 Total Insights: ${totalInsights}`)
    console.log(`  ✅ Total Tasks: ${totalTasks}`)
    console.log(`  📧 Total Messages: ${totalMessages}`)
    console.log(`  🤝 Total Outreach: ${totalOutreach}`)
    console.log(`  😊 Sentiment: +${sentimentCounts.positive} ⚪${sentimentCounts.neutral} 😔${sentimentCounts.negative}`)
    console.log(`  🏷️ Topics: ${Object.keys(topTopics).length} unique`)
    console.log(`  👥 Contacts: ${Object.keys(keyContacts).length} unique`)
    console.log(`  📅 Time Range: ${timeRange.earliest} to ${timeRange.latest}`)
    
    if (Object.keys(topTopics).length > 0) {
      console.log('\n   🔝 Top Topics:')
      Object.entries(topTopics)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .forEach(([topic, count]) => {
          console.log(`      ${topic}: ${count}`)
        })
    }
    
    if (Object.keys(keyContacts).length > 0) {
      console.log('\n   👥 Key Contacts:')
      Object.entries(keyContacts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .forEach(([contact, count]) => {
          console.log(`      ${contact}: ${count}`)
        })
    }
    
    // Check if we have the basic stats that would make the page show content
    const hasContent = totalInsights > 0 || totalTasks > 0 || Object.keys(topTopics).length > 0
    
    console.log(`\n🎯 RESULT: ${hasContent ? '✅ Should show content' : '❌ No content to display'}`)
    
    if (hasContent) {
      console.log('\n💡 The data is there! The issue is likely:')
      console.log('   - Authentication problem in the API')
      console.log('   - Frontend not receiving/processing API response correctly')
      console.log('   - API returning empty data due to user context issue')
    }
    
    // Test project_knowledge table
    console.log('\n3️⃣ Testing project_knowledge table:')
    const { data: projectKnowledge, error: pkError } = await supabase
      .from('project_knowledge')
      .select('*')
      .eq('user_id', userId)
      .single()
    
    if (pkError && pkError.code !== 'PGRST116') {
      console.error('❌ Project knowledge error:', pkError)
    } else if (pkError?.code === 'PGRST116') {
      console.log('ℹ️ No project_knowledge record (this is OK, API creates one from notes)')
    } else {
      console.log('✅ Project knowledge record exists')
      console.log(`   Updated: ${projectKnowledge.updated_at}`)
    }
    
  } else {
    console.log('❌ No notes with analysis found!')
  }
}

testKnowledgeAPI().catch(console.error)