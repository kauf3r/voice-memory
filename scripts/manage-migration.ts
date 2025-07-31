#!/usr/bin/env tsx

import * as dotenv from 'dotenv'
import path from 'path'
import { createServiceClient } from '../lib/supabase-server'
import fs from 'fs'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

async function verifyMigration(): Promise<boolean> {
  console.log('🔍 Verifying error tracking migration...')
  
  const supabase = createServiceClient()
  
  try {
    // Test if error tracking columns exist
    const { data: testNote } = await supabase
      .from('notes')
      .select('id')
      .limit(1)
      .single()
    
    if (!testNote) {
      console.log('⚠️  No notes found to test with')
      return false
    }
    
    const { error } = await supabase
      .from('notes')
      .update({
        error_message: 'migration_test',
        processing_attempts: 0,
        last_error_at: new Date().toISOString()
      })
      .eq('id', testNote.id)
    
    if (error) {
      console.log('❌ Error tracking columns do not exist:', error.message)
      return false
    }
    
    // Clean up test
    await supabase
      .from('notes')
      .update({
        error_message: null,
        processing_attempts: null,
        last_error_at: null
      })
      .eq('id', testNote.id)
    
    console.log('✅ Error tracking columns exist')
    
    // Test processing_errors table
    const { error: tableError } = await supabase
      .from('processing_errors')
      .select('id')
      .limit(1)
    
    if (tableError) {
      console.log('❌ processing_errors table does not exist:', tableError.message)
      return false
    }
    
    console.log('✅ processing_errors table exists')
    
    // Test rate_limits table
    const { error: rateError } = await supabase
      .from('rate_limits')
      .select('service')
      .limit(1)
    
    if (rateError) {
      console.log('❌ rate_limits table does not exist:', rateError.message)
      return false
    }
    
    console.log('✅ rate_limits table exists')
    
    return true
    
  } catch (error) {
    console.error('❌ Error verifying migration:', error)
    return false
  }
}

async function applyMigration(): Promise<boolean> {
  console.log('🚀 Applying error tracking migration...')
  
  const supabase = createServiceClient()
  
  try {
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20240119_add_error_tracking.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('📄 Migration file loaded successfully')
    
    // Execute the migration using raw SQL
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL })
    
    if (error) {
      console.log('❌ Migration failed:', error.message)
      return false
    }
    
    console.log('✅ Migration applied successfully')
    return true
    
  } catch (error) {
    console.error('❌ Error applying migration:', error)
    return false
  }
}

async function showMigrationStatus() {
  console.log('📊 Migration Status')
  console.log('==================')
  
  const isApplied = await verifyMigration()
  
  if (isApplied) {
    console.log('✅ Migration 20240119_add_error_tracking.sql is APPLIED')
    console.log('✅ Error tracking features are available')
    console.log('✅ Processing service can use error tracking columns')
  } else {
    console.log('❌ Migration 20240119_add_error_tracking.sql is NOT APPLIED')
    console.log('❌ Error tracking features are NOT available')
    console.log('❌ Processing service may fail when using error tracking')
  }
  
  return isApplied
}

async function main() {
  console.log('🔧 Error Tracking Migration Manager')
  console.log('==================================\n')
  
  const args = process.argv.slice(2)
  const command = args[0] || 'status'
  
  switch (command) {
    case 'verify':
    case 'check':
      const isApplied = await verifyMigration()
      if (isApplied) {
        console.log('\n✅ VERIFICATION PASSED')
        console.log('The error tracking migration is properly applied.')
      } else {
        console.log('\n❌ VERIFICATION FAILED')
        console.log('The error tracking migration has not been applied.')
        process.exit(1)
      }
      break
      
    case 'apply':
      console.log('⚠️  WARNING: This will modify your database schema.')
      console.log('Make sure you have a backup before proceeding.\n')
      
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
        console.log('\n✅ MIGRATION APPLIED SUCCESSFULLY')
        console.log('You can now run verification to confirm:')
        console.log('npx tsx scripts/manage-migration.ts verify')
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
      break
      
    case 'status':
    default:
      await showMigrationStatus()
      break
  }
}

if (require.main === module) {
  main().catch(console.error)
}

export { verifyMigration, applyMigration, showMigrationStatus } 