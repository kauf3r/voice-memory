import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

async function checkDatabaseSchema() {
  try {
    console.log('🔍 Checking database schema...\n')

    // Check what tables exist
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_tables')
      .select()

    if (tablesError) {
      // Alternative approach - try to query information_schema
      console.log('📋 Checking existing tables...')
      
      // Check if basic tables exist
      const tablesToCheck = ['users', 'notes', 'project_knowledge', 'processing_queue']
      
      for (const tableName of tablesToCheck) {
        try {
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .limit(1)
          
          if (error) {
            console.log(`❌ Table '${tableName}': ${error.message}`)
          } else {
            console.log(`✅ Table '${tableName}': EXISTS`)
          }
        } catch (err) {
          console.log(`❌ Table '${tableName}': Error checking`)
        }
      }
    } else {
      console.log('📋 Available tables:', tables)
    }

    // Check if specific functions exist
    console.log('\n🔧 Checking if required functions exist...')
    
    try {
      const { data, error } = await supabase
        .rpc('get_next_notes_to_process', { batch_size: 1 })
      
      if (error) {
        console.log(`❌ Function 'get_next_notes_to_process': ${error.message}`)
      } else {
        console.log(`✅ Function 'get_next_notes_to_process': EXISTS`)
      }
    } catch (err) {
      console.log(`❌ Function 'get_next_notes_to_process': NOT FOUND`)
    }

  } catch (error) {
    console.error('💥 Schema check error:', error)
  }
}

checkDatabaseSchema()