import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { readFileSync } from 'fs'

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

async function setupProcessingQueue() {
  try {
    console.log('🚀 Setting up processing queue...\n')

    // Read the processing queue migration
    const migrationSQL = readFileSync('./supabase/migrations/20240118_processing_queue.sql', 'utf8')
    
    console.log('📄 Executing processing queue migration...')
    
    // Execute the migration SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL })
    
    if (error) {
      console.error('❌ Migration failed:', error)
      
      // Try alternative approach - execute SQL directly via admin API
      console.log('🔄 Trying alternative approach...')
      
      // Split the SQL into individual statements and execute them
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))
      
      console.log(`📋 Executing ${statements.length} SQL statements...`)
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i] + ';'
        console.log(`   ${i + 1}. ${statement.substring(0, 60)}...`)
        
        try {
          const { error: stmtError } = await supabase.rpc('exec', { query: statement })
          if (stmtError) {
            console.error(`   ❌ Failed: ${stmtError.message}`)
          } else {
            console.log(`   ✅ Success`)
          }
        } catch (err) {
          console.error(`   ❌ Error:`, err)
        }
      }
    } else {
      console.log('✅ Migration executed successfully')
    }
    
    // Now manually add existing notes to the processing queue
    console.log('\n📝 Adding existing notes to processing queue...')
    
    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('id, user_id')
      .is('processed_at', null)
    
    if (notesError) {
      console.error('❌ Failed to fetch unprocessed notes:', notesError)
      return
    }
    
    if (notes && notes.length > 0) {
      console.log(`📋 Found ${notes.length} unprocessed notes to add to queue`)
      
      for (const note of notes) {
        const { error: insertError } = await supabase
          .from('processing_queue')
          .insert({
            note_id: note.id,
            user_id: note.user_id,
            priority: 1,
            status: 'pending'
          })
        
        if (insertError) {
          console.error(`❌ Failed to add note ${note.id} to queue:`, insertError)
        } else {
          console.log(`✅ Added note ${note.id} to processing queue`)
        }
      }
    } else {
      console.log('📝 No unprocessed notes found')
    }
    
    console.log('\n🎉 Processing queue setup complete!')

  } catch (error) {
    console.error('💥 Setup error:', error)
  }
}

setupProcessingQueue()