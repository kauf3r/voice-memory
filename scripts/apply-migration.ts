#!/usr/bin/env tsx

import * as dotenv from 'dotenv'
import path from 'path'
import { createServiceClient } from '../lib/supabase-server'
import fs from 'fs'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

async function applyMigration() {
  console.log('🚀 Applying error tracking migration...')
  
  const supabase = createServiceClient()
  
  try {
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20240119_add_error_tracking.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('📄 Migration file loaded successfully')
    
    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`)
    
    let successCount = 0
    let errorCount = 0
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (!statement.trim()) continue
      
      try {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`)
        
        const { error } = await supabase.rpc('exec_sql', { sql: statement })
        
        if (error) {
          console.log(`❌ Statement ${i + 1} failed:`, error.message)
          errorCount++
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`)
          successCount++
        }
      } catch (error) {
        console.log(`❌ Statement ${i + 1} failed:`, error)
        errorCount++
      }
    }
    
    console.log(`\n📊 Migration Summary:`)
    console.log(`✅ Successful: ${successCount}`)
    console.log(`❌ Failed: ${errorCount}`)
    
    if (errorCount > 0) {
      console.log('\n⚠️  Some statements failed. You may need to apply the migration manually.')
      return false
    }
    
    console.log('\n🎉 Migration applied successfully!')
    return true
    
  } catch (error) {
    console.error('❌ Error applying migration:', error)
    return false
  }
}

async function main() {
  console.log('🔧 Database Migration Application Tool')
  console.log('====================================\n')
  
  console.log('⚠️  WARNING: This will modify your database schema.')
  console.log('Make sure you have a backup before proceeding.\n')
  
  // Ask for confirmation
  const readline = require('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  
  const answer = await new Promise<string>((resolve) => {
    rl.question('Do you want to proceed with applying the migration? (yes/no): ', resolve)
  })
  
  rl.close()
  
  if (answer.toLowerCase() !== 'yes') {
    console.log('❌ Migration cancelled by user')
    process.exit(0)
  }
  
  const success = await applyMigration()
  
  if (success) {
    console.log('\n✅ MIGRATION COMPLETE')
    console.log('The error tracking migration has been applied successfully.')
    console.log('You can now run the verification script to confirm:')
    console.log('npx tsx scripts/simple-migration-check.ts')
  } else {
    console.log('\n❌ MIGRATION FAILED')
    console.log('Please apply the migration manually using one of these methods:')
    console.log('')
    console.log('1. Supabase Dashboard:')
    console.log('   - Go to your project dashboard')
    console.log('   - Navigate to SQL Editor')
    console.log('   - Run the migration file: supabase/migrations/20240119_add_error_tracking.sql')
    console.log('')
    console.log('2. Supabase CLI:')
    console.log('   supabase db push')
    console.log('')
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch(console.error)
}

export { applyMigration } 