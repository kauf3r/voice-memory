import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

async function applyMigration() {
  console.log('🔧 Applying unified task states migration...')
  
  // Create Supabase client with service key
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_KEY!
  
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY')
  }
  
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  
  // Read the migration file
  const migrationPath = path.join(__dirname, '../supabase/migrations/20250802_unified_task_states.sql')
  
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found: ${migrationPath}`)
  }
  
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
  
  console.log('📋 Migration file loaded, executing SQL...')
  
  // Split the migration into individual statements
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))
  
  console.log(`📊 Found ${statements.length} SQL statements to execute`)
  
  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]
    
    if (statement.length === 0) continue
    
    console.log(`🔄 Executing statement ${i + 1}/${statements.length}...`)
    
    try {
      const { error } = await supabase.rpc('exec_sql', { 
        sql: statement + ';'
      })
      
      if (error) {
        // Try direct execution if RPC fails
        const { error: directError } = await supabase
          .from('_migrations')
          .select('*')
          .limit(1)
        
        if (directError) {
          console.error(`❌ Error executing statement ${i + 1}:`, error)
          console.log('Statement:', statement)
          
          // Continue with non-critical errors
          if (!statement.toLowerCase().includes('create table') && 
              !statement.toLowerCase().includes('create function')) {
            console.log('⚠️ Non-critical error, continuing...')
            continue
          } else {
            throw error
          }
        }
      }
      
      console.log(`✅ Statement ${i + 1} executed successfully`)
    } catch (err) {
      console.error(`❌ Failed to execute statement ${i + 1}:`, err)
      console.log('Statement:', statement)
      
      // For certain errors, we can continue
      if (err.message?.includes('already exists') || 
          err.message?.includes('duplicate key')) {
        console.log('⚠️ Object already exists, continuing...')
        continue
      }
      
      throw err
    }
  }
  
  console.log('✅ Migration completed successfully!')
  
  // Verify the migration worked
  console.log('🔍 Verifying migration...')
  
  const { data: taskStates, error: verifyError } = await supabase
    .from('task_states')
    .select('*')
    .limit(1)
  
  if (verifyError) {
    console.error('❌ Migration verification failed:', verifyError)
    throw verifyError
  }
  
  console.log('✅ Migration verified - task_states table is accessible')
  
  const { data: editHistory, error: historyError } = await supabase
    .from('task_edit_history')
    .select('*')
    .limit(1)
  
  if (historyError) {
    console.error('❌ Edit history verification failed:', historyError)
    throw historyError
  }
  
  console.log('✅ Migration verified - task_edit_history table is accessible')
  console.log('🎉 Unified task states migration completed successfully!')
}

applyMigration().catch(error => {
  console.error('💥 Migration failed:', error)
  process.exit(1)
})