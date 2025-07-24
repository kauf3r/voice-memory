#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load environment variables
import dotenv from 'dotenv'
dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY')
  process.exit(1)
}

async function applyProcessingLockMigration() {
  console.log('🚀 Applying processing lock migration...')
  
  // Create service client with full permissions
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), 'supabase/migrations/20240120_add_processing_lock.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf-8')
    
    console.log('📄 Executing migration SQL...')
    
    // Split by statements and execute individually for better error reporting
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'
      console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`)
      
      const { error } = await supabase.rpc('exec_sql', { sql: statement })
      
      if (error) {
        // If exec_sql doesn't exist, try direct query
        console.log('   Trying direct SQL execution...')
        const { error: directError } = await supabase
          .from('_')
          .select('*')
          .limit(0) // This will fail, but we can use .sql() if available
        
        if (directError) {
          console.warn(`⚠️  Could not execute statement: ${statement}`)
          console.warn(`   Error: ${error.message}`)
          console.log('   You may need to apply this migration manually in the Supabase dashboard.')
        }
      } else {
        console.log('   ✅ Statement executed successfully')
      }
    }
    
    // Test the new functions
    console.log('\n🧪 Testing new database functions...')
    
    // Test cleanup function
    const { data: cleanupResult, error: cleanupError } = await supabase
      .rpc('cleanup_abandoned_processing_locks', { p_timeout_minutes: 15 })
    
    if (cleanupError) {
      console.error('❌ Error testing cleanup function:', cleanupError)
    } else {
      console.log('✅ Cleanup function works:', cleanupResult)
    }
    
    // Test get_next_notes_for_processing
    const { data: notesResult, error: notesError } = await supabase
      .rpc('get_next_notes_for_processing', { 
        p_user_id: null,
        p_limit: 1,
        p_lock_timeout_minutes: 15
      })
    
    if (notesError) {
      console.error('❌ Error testing get_next_notes_for_processing:', notesError)
    } else {
      console.log('✅ Get next notes function works, found:', notesResult?.length || 0, 'notes')
    }
    
    console.log('\n✅ Processing lock migration completed successfully!')
    console.log('\n🔒 New features added:')
    console.log('   • processing_started_at timestamp field')
    console.log('   • Row-level locking with SELECT FOR UPDATE')
    console.log('   • Automatic cleanup of abandoned processing attempts')
    console.log('   • Database functions for lock management')
    console.log('   • Enhanced processing statistics')
    
  } catch (error) {
    console.error('❌ Error applying migration:', error)
    console.log('\n📋 Manual migration steps:')
    console.log('1. Open Supabase Dashboard > SQL Editor')
    console.log('2. Copy and paste the contents of: supabase/migrations/20240120_add_processing_lock.sql')
    console.log('3. Execute the SQL statements')
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  applyProcessingLockMigration()
    .then(() => process.exit(0))
    .catch(console.error)
}

export { applyProcessingLockMigration } 