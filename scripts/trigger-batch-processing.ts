import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' })

async function triggerBatchProcessing() {
  try {
    console.log('🚀 Triggering batch processing...\n')

    // Create Supabase client to get admin session
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )

    // Get the user ID from our known test user
    const userId = '48b4ff95-a3e4-44a8-a4be-553323387d17'
    
    // Create an admin token for this user
    const { data: session, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: 'test@example.com' // This should match the user's email
    })

    if (sessionError) {
      console.error('❌ Failed to generate session:', sessionError)
      return
    }

    // Alternative approach: Call the API without auth since we have service access
    // Let's modify the batch processing to accept service key auth
    
    console.log('🔑 Using service key for authentication...')

    const response = await fetch('http://localhost:3000/api/process/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'X-Service-Auth': 'true' // Flag to indicate service-level auth
      },
      body: JSON.stringify({
        batchSize: 5, // Process up to 5 files
        userId: userId // Specify which user's files to process
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Batch processing failed:', response.status, errorText)
      return
    }

    const result = await response.json()
    console.log('✅ Batch processing response:', JSON.stringify(result, null, 2))

    if (result.processedCount > 0) {
      console.log(`\n🎉 Successfully processed ${result.processedCount} files!`)
      console.log('📝 Run check-processing-status.ts again to see the results')
    } else {
      console.log('\n💭 No files were processed. They may already be processed or there might be an issue.')
    }

  } catch (error) {
    console.error('💥 Error triggering batch processing:', error)
  }
}

// Run the processing
triggerBatchProcessing()