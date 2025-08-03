#!/usr/bin/env ts-node

import { MigrationExecutor } from '../lib/migration-utils'
import path from 'path'

async function applyTaskPinsMigration() {
  console.log('🔄 Applying task pins migration...\n')
  
  const executor = new MigrationExecutor(true) // verbose = true
  
  try {
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20250802_fix_task_pins_table.sql')
    
    console.log(`📄 Applying migration: ${migrationPath}`)
    
    const result = await executor.executeMigrationFile(migrationPath)
    
    if (result.success) {
      console.log('\n✅ Task pins migration completed successfully!')
      console.log('📋 Details:', result.details)
    } else {
      console.log('\n⚠️  Migration requires manual execution')
      console.log('📋 Instructions:', result.details)
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

// Run the migration
applyTaskPinsMigration().catch(console.error) 