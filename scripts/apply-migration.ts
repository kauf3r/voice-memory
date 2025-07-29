#!/usr/bin/env npx tsx

import { executeMigrationFileWithFallbacks } from '../lib/migration-utils'
import path from 'path'

async function applyMigration() {
  console.log('🚀 Applying error tracking migration...')
  
  try {
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20240119_add_error_tracking.sql')
    
    const result = await executeMigrationFileWithFallbacks(migrationPath)
    
    if (result.success) {
      console.log('\n🎉 Migration applied successfully!')
      
      if (result.method === 'manual') {
        console.log('\n⚠️  Manual execution required. Follow the instructions above.')
        process.exit(1)
      }
      
      return true
    } else {
      if (result.method === 'manual') {
        console.log('\n📋 Automated migration failed. Manual execution instructions provided above.')
        console.log('Please follow the manual steps and then run verification scripts.')
      } else {
        console.log('\n❌ Migration failed completely.')
      }
      
      process.exit(1)
    }
    
  } catch (error) {
    console.error('❌ Error applying migration:', error)
    process.exit(1)
  }
}

// Run the migration
if (require.main === module) {
  applyMigration()
}

export default applyMigration 