#!/usr/bin/env npx tsx

import { MigrationExecutor, executeMigrationFileWithFallbacks } from '../lib/migration-utils'
import path from 'path'
import fs from 'fs'

class QuickMigrationApply {
  private migrationExecutor: MigrationExecutor

  constructor() {
    this.migrationExecutor = new MigrationExecutor(true)
  }

  private async getMigrationFiles(): Promise<string[]> {
    const migrationDir = path.join(process.cwd(), 'supabase/migrations')
    
    try {
      const files = fs.readdirSync(migrationDir)
        .filter(file => file.endsWith('.sql'))
        .sort()
      
      return files.map(file => path.join(migrationDir, file))
    } catch (error) {
      console.error('❌ Error reading migration directory:', error)
      return []
    }
  }

  private async applyMigrationFile(filePath: string): Promise<boolean> {
    console.log(`\n📄 Applying migration: ${path.basename(filePath)}`)
    console.log('='.repeat(50))
    
    const result = await this.migrationExecutor.executeMigrationFile(filePath)
    
    if (result.success) {
      console.log(`✅ Migration ${path.basename(filePath)} applied successfully using ${result.method}`)
      return true
    } else if (result.method === 'manual') {
      console.log(`⚠️  Migration ${path.basename(filePath)} requires manual execution`)
      console.log('Instructions have been provided above.')
      return false
    } else {
      console.log(`❌ Migration ${path.basename(filePath)} failed completely`)
      return false
    }
  }

  public async applyMigration(): Promise<void> {
    console.log('🚀 Quick Migration Apply Tool')
    console.log('============================')
    console.log('This tool applies all pending migrations with comprehensive fallback support.\n')

    // Check if exec_sql is available
    const hasExecSql = await this.migrationExecutor.isExecSqlAvailable()
    if (hasExecSql) {
      console.log('✅ exec_sql RPC function is available')
    } else {
      console.log('⚠️  exec_sql RPC function not available - will use fallback methods')
    }

    const migrationFiles = await this.getMigrationFiles()
    
    if (migrationFiles.length === 0) {
      console.log('📝 No migration files found in supabase/migrations/')
      return
    }

    console.log(`\n📋 Found ${migrationFiles.length} migration files:`)
    migrationFiles.forEach((file, index) => {
      console.log(`   ${index + 1}. ${path.basename(file)}`)
    })

    let successCount = 0
    let manualCount = 0
    let failedCount = 0
    const manualMigrations: string[] = []

    for (const filePath of migrationFiles) {
      try {
        const success = await this.applyMigrationFile(filePath)
        
        if (success) {
          successCount++
        } else {
          manualCount++
          manualMigrations.push(path.basename(filePath))
        }
      } catch (error) {
        console.error(`❌ Unexpected error applying ${path.basename(filePath)}:`, error)
        failedCount++
      }
    }

    // Summary
    console.log('\n📊 Migration Summary:')
    console.log('====================')
    console.log(`✅ Successfully applied: ${successCount}`)
    console.log(`📋 Require manual execution: ${manualCount}`)
    console.log(`❌ Failed: ${failedCount}`)

    if (manualMigrations.length > 0) {
      console.log('\n📋 Migrations requiring manual execution:')
      manualMigrations.forEach(migration => {
        console.log(`   • ${migration}`)
      })
      
      console.log('\n💡 Manual Execution Instructions:')
      console.log('1. Open your Supabase project dashboard')
      console.log('2. Go to SQL Editor')
      console.log('3. Execute each migration file listed above')
      console.log('4. Run verification scripts to confirm success')
      console.log('5. Use the generated manual-migration-*.sql files if available')
    }

    if (successCount === migrationFiles.length) {
      console.log('\n🎉 All migrations applied successfully!')
    } else if (manualCount > 0 && failedCount === 0) {
      console.log('\n⚠️  Some migrations require manual execution but no failures occurred.')
      console.log('Complete the manual steps above to finish the migration process.')
    } else if (failedCount > 0) {
      console.log('\n❌ Some migrations failed completely.')
      console.log('Review the errors above and address them before proceeding.')
      process.exit(1)
    }

    console.log('\n🔧 Next Steps:')
    console.log('1. Run migration verification scripts')
    console.log('2. Test your application functionality')
    console.log('3. Monitor for any issues')
  }
}

// Run the migration
if (require.main === module) {
  const migrationApply = new QuickMigrationApply()
  migrationApply.applyMigration().catch(error => {
    console.error('❌ Quick migration apply failed:', error)
    process.exit(1)
  })
}

export default QuickMigrationApply 