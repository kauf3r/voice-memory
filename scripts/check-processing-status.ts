import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' })

// Initialize Supabase client with service key for admin access
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌')
  console.error('   SUPABASE_SERVICE_KEY:', supabaseServiceKey ? '✅' : '❌')
  console.error('\n💡 Make sure .env.local exists with proper values')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkProcessingStatus() {
  try {
    console.log('🔍 Checking processing status...\n')

    // Get all notes for all users to see current state
    const { data: notes, error } = await supabase
      .from('notes')
      .select('id, audio_url, transcription, analysis, processed_at, created_at, user_id')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error fetching notes:', error)
      return
    }

    if (!notes || notes.length === 0) {
      console.log('📝 No notes found in database')
      return
    }

    console.log(`📊 Found ${notes.length} total notes:\n`)

    notes.forEach((note, index) => {
      const hasTranscription = !!note.transcription
      const hasAnalysis = !!note.analysis
      const isProcessed = !!note.processed_at
      
      console.log(`${index + 1}. Note ID: ${note.id}`)
      console.log(`   Created: ${new Date(note.created_at).toLocaleString()}`)
      console.log(`   Audio URL: ${note.audio_url ? '✅ Present' : '❌ Missing'}`)
      console.log(`   Transcription: ${hasTranscription ? '✅ Complete' : '⏳ Pending'}`)
      console.log(`   Analysis: ${hasAnalysis ? '✅ Complete' : '⏳ Pending'}`)
      console.log(`   Processed: ${isProcessed ? `✅ ${new Date(note.processed_at).toLocaleString()}` : '⏳ Pending'}`)
      console.log(`   User ID: ${note.user_id}`)
      console.log('')
    })

    // Count processing status
    const processed = notes.filter(n => n.processed_at).length
    const pending = notes.length - processed

    console.log(`📈 Processing Summary:`)
    console.log(`   ✅ Processed: ${processed}`)
    console.log(`   ⏳ Pending: ${pending}`)

    // Check processing queue
    console.log(`\n🔄 Checking processing queue...`)
    const { data: queueItems, error: queueError } = await supabase
      .from('processing_queue')
      .select('id, note_id, status, priority, attempts, error_message, created_at')
      .order('created_at', { ascending: false })

    if (queueError) {
      console.error('❌ Error fetching processing queue:', queueError)
    } else if (!queueItems || queueItems.length === 0) {
      console.log('📝 Processing queue is empty')
      console.log('💡 Notes might need to be manually added to queue')
    } else {
      console.log(`📊 Found ${queueItems.length} items in processing queue:`)
      queueItems.forEach((item, index) => {
        console.log(`${index + 1}. Queue ID: ${item.id}`)
        console.log(`   Note ID: ${item.note_id}`)
        console.log(`   Status: ${item.status}`)
        console.log(`   Priority: ${item.priority}`)
        console.log(`   Attempts: ${item.attempts}`)
        if (item.error_message) {
          console.log(`   Error: ${item.error_message}`)
        }
        console.log('')
      })
    }

    if (pending > 0) {
      console.log(`\n💡 To process pending files, run: npm run process-batch`)
    }

  } catch (error) {
    console.error('💥 Script error:', error)
  }
}

// Run the check
checkProcessingStatus()