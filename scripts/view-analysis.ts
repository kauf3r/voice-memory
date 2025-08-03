import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' })

async function viewAnalysis() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    const { data: note, error } = await supabase
      .from('notes')
      .select('analysis, transcription')
      .not('analysis', 'is', null)
      .limit(1)
      .single()
    
    if (error || !note) {
      console.error('Error:', error)
      return
    }
    
    console.log('🎉 COMPLETE VOICE MEMORY ANALYSIS')
    console.log('=' .repeat(50))
    console.log('Transcription preview:', note.transcription.substring(0, 150) + '...\n')
    
    console.log('📊 7-POINT AI ANALYSIS:')
    console.log('-'.repeat(30))
    const analysis = note.analysis
    
    console.log('\n1. 😊 SENTIMENT ANALYSIS:')
    console.log(`   Classification: ${analysis.sentiment?.classification}`)
    console.log(`   Explanation: ${analysis.sentiment?.explanation}`)
    
    console.log('\n2. 🎯 FOCUS TOPICS:')
    console.log(`   Primary: ${analysis.focusTopics?.primary}`)
    console.log(`   Minor: ${analysis.focusTopics?.minor?.join(', ')}`)
    
    console.log('\n3. ✅ TASKS:')
    console.log(`   My Tasks (${analysis.tasks?.myTasks?.length || 0}):`)
    analysis.tasks?.myTasks?.forEach((task: string, i: number) => {
      console.log(`     ${i + 1}. ${task}`)
    })
    console.log(`   Delegated Tasks: ${analysis.tasks?.delegatedTasks?.length || 0}`)
    
    console.log('\n4. 💡 KEY IDEAS:')
    analysis.keyIdeas?.forEach((idea: string, i: number) => {
      console.log(`   ${i + 1}. ${idea}`)
    })
    
    console.log('\n5. 📝 MESSAGES TO DRAFT:')
    analysis.messagesToDraft?.forEach((msg: any, i: number) => {
      console.log(`   ${i + 1}. To: ${msg.recipient}`)
      console.log(`      Subject: ${msg.subject}`)
    })
    
    console.log('\n6. 🔗 CROSS-REFERENCES:')
    console.log(`   Project Knowledge Updates: ${analysis.crossReferences?.projectKnowledgeUpdates?.length || 0}`)
    
    console.log('\n7. 🤝 OUTREACH IDEAS:')
    console.log(`   Networking Opportunities: ${analysis.outreachIdeas?.length || 0}`)
    
    console.log('\n✨ VOICE MEMORY PIPELINE: COMPLETE SUCCESS! ✨')

  } catch (error) {
    console.error('💥 Error viewing analysis:', error)
  }
}

viewAnalysis()