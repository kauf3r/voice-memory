import { transcribeAudio, analyzeTranscription } from '../lib/openai'
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { readFileSync } from 'fs'

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') })

async function testOpenAIAPIs() {
  console.log('🔍 Testing OpenAI APIs...\n')

  // Check environment variables
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    console.error('❌ Missing OPENAI_API_KEY environment variable')
    console.error('   Please add your OpenAI API key to .env.local')
    process.exit(1)
  }

  console.log('✅ OpenAI API key found')
  console.log(`   Key: ${apiKey.substring(0, 20)}...\n`)

  // Test 1: GPT-4 Analysis (can test without audio file)
  console.log('🤖 Testing GPT-4 Analysis...')
  
  const sampleTranscription = `
    Hey, I just had a really productive meeting with Sarah from the marketing team. 
    We discussed the Q4 campaign strategy and I think we have some great ideas. 
    I need to follow up with her about the budget allocation by Friday, and also 
    reach out to John in design to get some mockups. The campaign should focus on 
    our new sustainability features - that's what customers are really asking for. 
    I should also draft an email to the CEO summarizing our key findings.
  `

  const sampleProjectKnowledge = `
    {
      "recentInsights": [
        "Customer feedback shows strong interest in sustainability",
        "Q3 campaign exceeded expectations by 15%"
      ],
      "keyContacts": ["Sarah (Marketing)", "John (Design)", "CEO"]
    }
  `

  try {
    const { analysis, error: analysisError } = await analyzeTranscription(
      sampleTranscription,
      sampleProjectKnowledge
    )

    if (analysisError) {
      console.error('   ❌ GPT-4 Analysis failed:', analysisError.message)
    } else {
      console.log('   ✅ GPT-4 Analysis successful!')
      console.log('   📊 Analysis results:')
      console.log(`      Sentiment: ${analysis?.sentiment?.classification}`)
      console.log(`      Primary Topic: ${analysis?.focusTopics?.primary}`)
      console.log(`      My Tasks: ${analysis?.tasks?.myTasks?.length || 0}`)
      console.log(`      Messages to Draft: ${analysis?.messagesToDraft?.length || 0}`)
      console.log(`      Key Ideas: ${analysis?.keyIdeas?.length || 0}`)
      
      if (analysis?.tasks?.myTasks?.length > 0) {
        console.log('   📝 Sample task:', analysis.tasks.myTasks[0])
      }
    }
  } catch (error) {
    console.error('   ❌ GPT-4 test failed with exception:', error)
  }

  console.log()

  // Test 2: Whisper API (requires audio file)
  console.log('🎤 Testing Whisper API...')
  console.log('   ℹ️  To test Whisper, you would need to provide an audio file.')
  console.log('   ℹ️  The transcribeAudio function expects a File object.')
  console.log('   ℹ️  In a real scenario, this would be called from the API route.')
  
  // Example of how to test with a real audio file:
  /*
  try {
    // This is just an example - you'd need to provide a real audio file
    const audioBuffer = readFileSync('/path/to/your/audio/file.mp3')
    const audioFile = new File([audioBuffer], 'test.mp3', { type: 'audio/mpeg' })
    
    const { text, error: transcriptionError } = await transcribeAudio(audioFile)
    
    if (transcriptionError) {
      console.error('   ❌ Whisper transcription failed:', transcriptionError.message)
    } else {
      console.log('   ✅ Whisper transcription successful!')
      console.log('   📝 Transcription:', text?.substring(0, 100) + '...')
    }
  } catch (error) {
    console.error('   ❌ Whisper test failed with exception:', error)
  }
  */

  console.log('   📁 To test with a real audio file:')
  console.log('      1. Add an audio file to your project')
  console.log('      2. Uncomment and modify the test code above')
  console.log('      3. Run the test again')

  console.log('\n✨ OpenAI API tests complete!')
  console.log('\n📋 Next steps:')
  console.log('   1. Upload an audio file through the UI')
  console.log('   2. Trigger processing via the /api/process endpoint')
  console.log('   3. Check the note record for transcription and analysis results')
}

// Run the test
testOpenAIAPIs().catch(console.error)