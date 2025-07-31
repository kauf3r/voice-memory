import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' })

// Test with a simple transcription to isolate the GPT-4 issue
const sampleTranscription = `All right, Friday morning, 9.40, I just fed the cats and I'm on my way in to the airstrip. The bummer that I have to have my phone open and my voice apps open because I'm worried about it cutting off during the middle of a thought. But anyway, I'm thinking about the project we discussed yesterday and I need to follow up with Sarah about the presentation slides. Also, I should probably draft an email to the client about next week's meeting. The weather looks good for flying today.`

async function testAnalysis() {
  try {
    // Import the function here to avoid env issues during module loading
    const { analyzeTranscription } = await import('../lib/openai')
    
    console.log('🧪 Testing GPT-4 analysis with sample transcription...')
    console.log('Transcription:', sampleTranscription.substring(0, 100) + '...\n')
    
    // Test the analysis function
    console.log('🤖 Calling GPT-4...')
    const result = await analyzeTranscription(sampleTranscription, '')
    
    if (result.error) {
      console.error('❌ Analysis failed:', result.error.message)
      console.error('Error details:', result.error)
    } else if (result.analysis) {
      console.log('✅ Analysis successful!')
      console.log('Analysis structure:')
      console.log('- Sentiment:', result.analysis.sentiment?.classification)
      console.log('- Primary topic:', result.analysis.focusTopics?.primary)
      console.log('- Tasks count:', result.analysis.tasks?.myTasks?.length || 0)
      console.log('- Ideas count:', result.analysis.keyIdeas?.length || 0)
      
      if (result.warning) {
        console.log('⚠️  Warning:', result.warning)
      }
      
      console.log('\n📋 Full analysis:')
      console.log(JSON.stringify(result.analysis, null, 2))
    } else {
      console.log('❌ No analysis returned')
    }

  } catch (error) {
    console.error('💥 Test failed:', error)
  }
}

testAnalysis()