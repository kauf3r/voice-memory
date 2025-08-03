#!/usr/bin/env npx tsx

import { 
  MigrationExecutor, 
  executeMigrationWithFallbacks, 
  executeMigrationFileWithFallbacks 
} from '../lib/migration-utils'

/**
 * Demonstration script showing how to use the new migration utility
 * with comprehensive fallback mechanisms
 */

async function demonstrateMigrationFallbacks() {
  console.log('🚀 Migration Fallback Demonstration')
  console.log('===================================\n')

  // Method 1: Using the convenience function with a SQL string
  console.log('📝 Method 1: Direct SQL execution with fallbacks')
  console.log('-'.repeat(50))
  
  const testSQL = `
    -- Test migration SQL
    CREATE TABLE IF NOT EXISTS demo_table (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_demo_table_name ON demo_table(name);
    
    CREATE OR REPLACE FUNCTION get_demo_count()
    RETURNS BIGINT AS $$
    BEGIN
      RETURN (SELECT COUNT(*) FROM demo_table);
    END;
    $$ LANGUAGE plpgsql;
  `
  
  const result1 = await executeMigrationWithFallbacks(testSQL)
  
  if (result1.success) {
    console.log('✅ Direct SQL migration completed successfully')
  } else if (result1.method === 'manual') {
    console.log('📋 Direct SQL migration requires manual execution')
  }

  console.log('\n' + '='.repeat(60) + '\n')

  // Method 2: Using the convenience function with a file
  console.log('📄 Method 2: File-based migration with fallbacks')
  console.log('-'.repeat(50))
  
  const result2 = await executeMigrationFileWithFallbacks(
    'supabase/migrations/20240119_add_error_tracking.sql'
  )
  
  if (result2.success) {
    console.log('✅ File-based migration completed successfully')
  } else if (result2.method === 'manual') {
    console.log('📋 File-based migration requires manual execution')
  }

  console.log('\n' + '='.repeat(60) + '\n')

  // Method 3: Using the MigrationExecutor class directly for advanced control
  console.log('🔧 Method 3: Advanced usage with MigrationExecutor class')
  console.log('-'.repeat(50))
  
  const executor = new MigrationExecutor(true) // verbose = true
  
  // Check if exec_sql is available
  const hasExecSql = await executor.isExecSqlAvailable()
  console.log(`exec_sql availability: ${hasExecSql ? '✅ Available' : '❌ Not available'}`)
  
  // Parse SQL to understand what we're executing
  const statements = executor.parseSQL(testSQL)
  console.log(`\nParsed ${statements.length} SQL statements:`)
  statements.forEach((stmt, index) => {
    console.log(`  ${index + 1}. ${stmt.description} (${stmt.type})`)
  })

  // Execute with detailed control
  const result3 = await executor.executeMigration(testSQL)
  executor.printResult(result3)

  console.log('\n' + '='.repeat(60) + '\n')

  // Method 4: Batch migration of all files
  console.log('📁 Method 4: Batch migration with error handling')
  console.log('-'.repeat(50))
  
  await demonstrateBatchMigration()

  console.log('\n🎯 Summary of Fallback Mechanisms:')
  console.log('=================================')
  console.log('1. ✅ Primary: exec_sql RPC function (if available)')
  console.log('2. 🔄 Fallback 1: Direct REST API calls to Supabase')
  console.log('3. 📋 Fallback 2: Generate manual execution instructions')
  console.log('4. 📄 Fallback 3: Export formatted SQL file for manual use')
  console.log('5. 🧠 Smart error handling with ignorable error detection')
  console.log('6. 📊 Comprehensive result reporting with next steps')
}

async function demonstrateBatchMigration() {
  const executor = new MigrationExecutor(true)
  
  // This would typically be done with real migration files
  const mockMigrations = [
    'supabase/migrations/20240118_initial_schema.sql',
    'supabase/migrations/20240118_processing_queue.sql',
    'supabase/migrations/20240118_row_level_security.sql',
    'supabase/migrations/20240119_add_error_tracking.sql',
    'supabase/migrations/20240120_add_processing_lock.sql',
    'supabase/migrations/20240121_add_system_processing_stats.sql'
  ]

  console.log(`Processing ${mockMigrations.length} migration files...`)
  
  let successCount = 0
  let manualCount = 0
  let failedCount = 0

  for (const migration of mockMigrations) {
    console.log(`\n📄 ${migration.split('/').pop()}`)
    
    try {
      const result = await executor.executeMigrationFile(migration)
      
      if (result.success) {
        console.log(`   ✅ Success (${result.method})`)
        successCount++
      } else if (result.method === 'manual') {
        console.log('   📋 Manual execution required')
        manualCount++
      } else {
        console.log('   ❌ Failed')
        failedCount++
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error}`)
      failedCount++
    }
  }

  console.log(`\n📊 Batch Migration Results:`)
  console.log(`   ✅ Successful: ${successCount}`)
  console.log(`   📋 Manual required: ${manualCount}`)
  console.log(`   ❌ Failed: ${failedCount}`)
}

// Run the demonstration
if (require.main === module) {
  demonstrateMigrationFallbacks().catch(error => {
    console.error('❌ Demonstration failed:', error)
    process.exit(1)
  })
}

export default demonstrateMigrationFallbacks 