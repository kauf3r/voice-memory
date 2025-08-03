#!/usr/bin/env tsx
import OpenAI from 'openai'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function test() {
  console.log('🧪 Testing OpenAI connection...')
  
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    console.log('✅ OpenAI client created')
    
    // Test with a simple prompt
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Just respond with 'Hello'" }],
      max_tokens: 10
    })

    console.log('🤖 OpenAI response:', completion.choices[0].message.content)
    
  } catch (error) {
    console.error('❌ OpenAI test failed:', error)
  }
}

test().catch(console.error)