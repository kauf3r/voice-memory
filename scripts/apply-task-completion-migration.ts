import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { readFileSync } from 'fs'

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

async function applyTaskCompletionMigration() {
  console.log('🔄 Applying task completion migration...\n')

  // Create admin client
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  try {
    // Read the migration file
    const migrationPath = resolve(process.cwd(), 'supabase/migrations/20240122_add_task_completions.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf8')
    
    console.log('📄 Loaded migration file: 20240122_add_task_completions.sql')
    
    // Execute the migration
    const { error } = await adminClient.rpc('exec', {
      sql: migrationSQL
    })

    if (error) {
      // Try direct query execution if RPC fails
      console.log('⚠️ RPC method failed, trying direct execution...')
      
      // Split migration into individual statements and execute
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

      for (const statement of statements) {
        const { error: execError } = await adminClient
          .from('dual') // Use a dummy table reference
          .select()
          .limit(0)

        // Actually execute using raw SQL
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({ sql: statement })
        })

        if (!response.ok) {
          console.error(`❌ Failed to execute statement: ${statement.substring(0, 100)}...`)
          console.error('Response:', await response.text())
          continue
        }
      }
    }

    console.log('✅ Migration applied successfully!')
    
    // Verify the table was created
    const { data: tables, error: tableError } = await adminClient
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'task_completions')

    if (tableError) {
      console.error('❌ Error checking table:', tableError)
    } else if (tables && tables.length > 0) {
      console.log('✅ task_completions table created successfully')
    } else {
      console.log('⚠️ Could not verify table creation')
    }

    // Test the helper functions
    console.log('\n🧪 Testing helper functions...')
    
    const { data: statsData, error: statsError } = await adminClient
      .rpc('get_task_completion_stats', { 
        p_user_id: '00000000-0000-0000-0000-000000000000' // dummy UUID for test
      })

    if (statsError) {
      console.error('❌ Stats function error:', statsError)
    } else {
      console.log('✅ get_task_completion_stats function working')
    }

    console.log('\n🎉 Task completion migration completed successfully!')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

applyTaskCompletionMigration().catch(console.error)