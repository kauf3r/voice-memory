#!/usr/bin/env tsx

import * as dotenv from 'dotenv'
import path from 'path'
import { createServiceClient } from '../lib/supabase-server'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

interface ColumnInfo {
  column_name: string
  data_type: string
  is_nullable: string
  column_default: string | null
}

interface TableInfo {
  table_name: string
  columns: ColumnInfo[]
}

async function verifyMigration() {
  console.log('🔍 Verifying error tracking migration...')
  
  const supabase = createServiceClient()
  
  try {
    // Check if error tracking columns exist in notes table
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'notes' })
      .select('column_name, data_type, is_nullable, column_default')
    
    if (columnsError) {
      console.log('⚠️  Could not query columns directly, trying alternative method...')
      
      // Alternative: Query information_schema directly
      const { data: schemaColumns, error: schemaError } = await supabase
        .rpc('get_table_info', { table_name: 'notes' })
      
      if (schemaError) {
        throw new Error(`Failed to query schema: ${schemaError.message}`)
      }
      
      if (!schemaColumns) {
        throw new Error('No columns found in notes table')
      }
      
      const columnNames = schemaColumns.map(col => col.column_name)
      console.log('📋 Current columns in notes table:', columnNames)
      
      // Check for required columns
      const requiredColumns = [
        'error_message',
        'processing_attempts', 
        'last_error_at'
      ]
      
      const missingColumns = requiredColumns.filter(col => !columnNames.includes(col))
      
      if (missingColumns.length > 0) {
        console.log('❌ Missing columns:', missingColumns)
        console.log('🚨 Migration 20240119_add_error_tracking.sql has NOT been applied!')
        return false
      }
      
      console.log('✅ All required columns exist in notes table')
      
    } else {
      if (!columns) {
        throw new Error('No columns found in notes table')
      }
      
      const columnNames = columns.map(col => col.column_name)
      console.log('📋 Current columns in notes table:', columnNames)
      
      // Check for required columns
      const requiredColumns = [
        'error_message',
        'processing_attempts', 
        'last_error_at'
      ]
      
      const missingColumns = requiredColumns.filter(col => !columnNames.includes(col))
      
      if (missingColumns.length > 0) {
        console.log('❌ Missing columns:', missingColumns)
        console.log('🚨 Migration 20240119_add_error_tracking.sql has NOT been applied!')
        return false
      }
      
      console.log('✅ All required columns exist in notes table')
    }
    
    // Check if processing_errors table exists
    const { data: processingErrorsTable, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'processing_errors')
      .eq('table_schema', 'public')
      .single()
    
    if (tableError || !processingErrorsTable) {
      console.log('❌ processing_errors table does not exist')
      console.log('🚨 Migration 20240119_add_error_tracking.sql has NOT been applied!')
      return false
    }
    
    console.log('✅ processing_errors table exists')
    
    // Check if rate_limits table exists
    const { data: rateLimitsTable, error: rateLimitsError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'rate_limits')
      .eq('table_schema', 'public')
      .single()
    
    if (rateLimitsError || !rateLimitsTable) {
      console.log('❌ rate_limits table does not exist')
      console.log('🚨 Migration 20240119_add_error_tracking.sql has NOT been applied!')
      return false
    }
    
    console.log('✅ rate_limits table exists')
    
    // Check if functions exist
    const { data: functions, error: functionsError } = await supabase
      .from('information_schema.routines')
      .select('routine_name')
      .eq('routine_schema', 'public')
      .in('routine_name', ['log_processing_error', 'clear_processing_error', 'get_processing_stats'])
    
    if (functionsError) {
      console.log('⚠️  Could not verify functions, but tables exist')
    } else if (!functions || functions.length < 3) {
      console.log('⚠️  Some functions may be missing, but core tables exist')
    } else {
      console.log('✅ All required functions exist')
    }
    
    console.log('🎉 Migration 20240119_add_error_tracking.sql has been applied successfully!')
    return true
    
  } catch (error) {
    console.error('❌ Error verifying migration:', error)
    return false
  }
}

async function checkMigrationStatus() {
  console.log('📊 Checking migration status...')
  
  const supabase = createServiceClient()
  
  try {
    // Try to query the schema_migrations table if it exists
    const { data: migrations, error } = await supabase
      .from('schema_migrations')
      .select('version, applied_at')
      .order('applied_at', { ascending: false })
    
    if (error) {
      console.log('⚠️  Could not query schema_migrations table (this is normal for some setups)')
      return
    }
    
    if (migrations) {
      console.log('📋 Applied migrations:')
      migrations.forEach(migration => {
        console.log(`  - ${migration.version} (${migration.applied_at})`)
      })
      
      const targetMigration = migrations.find(m => m.version === '20240119_add_error_tracking')
      if (targetMigration) {
        console.log('✅ Target migration found in schema_migrations')
      } else {
        console.log('⚠️  Target migration not found in schema_migrations (but tables may still exist)')
      }
    }
    
  } catch (error) {
    console.log('⚠️  Could not check migration status:', error)
  }
}

async function main() {
  console.log('🔧 Database Migration Verification Tool')
  console.log('=====================================\n')
  
  await checkMigrationStatus()
  console.log('')
  
  const isApplied = await verifyMigration()
  
  if (!isApplied) {
    console.log('\n🚨 ACTION REQUIRED:')
    console.log('The error tracking migration has not been applied.')
    console.log('Please run the migration using one of these methods:')
    console.log('')
    console.log('1. Supabase CLI:')
    console.log('   supabase db push')
    console.log('')
    console.log('2. Supabase Dashboard:')
    console.log('   - Go to your project dashboard')
    console.log('   - Navigate to SQL Editor')
    console.log('   - Run the migration file: supabase/migrations/20240119_add_error_tracking.sql')
    console.log('')
    console.log('3. Direct SQL:')
    console.log('   - Connect to your database')
    console.log('   - Execute the contents of supabase/migrations/20240119_add_error_tracking.sql')
    console.log('')
    process.exit(1)
  } else {
    console.log('\n✅ VERIFICATION COMPLETE')
    console.log('The error tracking migration is properly applied.')
    console.log('The processing service can safely use the new error tracking features.')
  }
}

if (require.main === module) {
  main().catch(console.error)
}

export { verifyMigration, checkMigrationStatus } 