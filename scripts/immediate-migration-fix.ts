#!/usr/bin/env npx tsx

/**
 * IMMEDIATE MIGRATION FIX SCRIPT
 * 
 * This script applies the critical 20240119_add_error_tracking.sql migration
 * that is required for processing functionality to work in production.
 * 
 * The migration adds essential error tracking columns and database functions
 * that the processing service expects to exist.
 */

import { MigrationExecutor, executeMigrationFileWithFallbacks } from '../lib/migration-utils'
import { createServiceClient } from '../lib/supabase-server'
import path from 'path'
import fs from 'fs'

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
}

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function logStep(step: number, message: string) {
  log(`${colors.bold}${colors.blue}Step ${step}:${colors.reset} ${message}`)
}

function logSuccess(message: string) {
  log(`${colors.green}✓ ${message}${colors.reset}`)
}

function logError(message: string) {
  log(`${colors.red}✗ ${message}${colors.reset}`)
}

function logWarning(message: string) {
  log(`${colors.yellow}⚠ ${message}${colors.reset}`)
}

interface MigrationResult {
  success: boolean
  executed: string[]
  skipped: string[]
  error?: string
}

class ImmediateMigrationFix {
  private supabase: any
  private migrationExecutor: MigrationExecutor

  constructor() {
    this.supabase = createServiceClient()
    this.migrationExecutor = new MigrationExecutor(true)
  }

  async checkCurrentSchema(): Promise<{hasColumns: boolean, hasTables: boolean, hasFunctions: boolean}> {
    logStep(1, 'Checking current database schema...')
    
    try {
      // Check if error tracking columns exist
      const { data: columns, error: columnsError } = await this.supabase.rpc('exec_sql', {
        sql: `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'notes' 
          AND column_name IN ('error_message', 'processing_attempts', 'last_error_at')
        `
      })

      if (columnsError) {
        // Try alternative method
        const { data: notesSchema } = await this.supabase
          .from('notes')
          .select('*')
          .limit(1)
        
        const hasColumns = notesSchema && notesSchema[0] && 
          ('error_message' in notesSchema[0] || 'processing_attempts' in notesSchema[0])
        
        log(`Columns check (fallback method): ${hasColumns ? 'EXISTS' : 'MISSING'}`)
      } else {
        const hasColumns = columns && columns.length >= 3
        log(`Error tracking columns: ${hasColumns ? 'EXISTS' : 'MISSING'}`)
      }

      // Check if processing_errors table exists
      const { data: tables, error: tablesError } = await this.supabase.rpc('exec_sql', {
        sql: `
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_name IN ('processing_errors', 'rate_limits')
        `
      })

      const hasTables = !tablesError && tables && tables.length >= 2
      log(`Required tables: ${hasTables ? 'EXISTS' : 'MISSING'}`)

      // Check if functions exist
      const { data: functions, error: functionsError } = await this.supabase.rpc('exec_sql', {
        sql: `
          SELECT routine_name 
          FROM information_schema.routines 
          WHERE routine_name IN ('log_processing_error', 'clear_processing_error', 'get_processing_stats')
        `
      })

      const hasFunctions = !functionsError && functions && functions.length >= 3
      log(`Required functions: ${hasFunctions ? 'EXISTS' : 'MISSING'}`)

      return {
        hasColumns: !columnsError && columns && columns.length >= 3,
        hasTables,
        hasFunctions
      }
    } catch (error) {
      logError(`Schema check failed: ${error}`)
      return { hasColumns: false, hasTables: false, hasFunctions: false }
    }
  }

  async executeMigrationChunks(): Promise<MigrationResult> {
    logStep(2, 'Executing migration in chunks with fallback support...')
    
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20240119_add_error_tracking.sql')
    
    try {
      const result = await this.migrationExecutor.executeMigrationFile(migrationPath)
      
      if (result.success) {
        logSuccess(`Migration executed successfully using ${result.method}`)
        return {
          success: true,
          executed: result.executed,
          skipped: result.skipped
        }
      } else if (result.method === 'manual') {
        logWarning('Migration requires manual execution - instructions provided')
        return {
          success: false,
          executed: result.executed,
          skipped: result.skipped,
          error: 'Manual execution required - see instructions above'
        }
      } else {
        logError('Migration execution failed completely')
        return {
          success: false,
          executed: result.executed,
          skipped: result.skipped,
          error: result.error || 'Unknown migration error'
        }
      }
    } catch (error: any) {
      logError(`Migration execution error: ${error.message}`)
      return {
        success: false,
        executed: [],
        skipped: [],
        error: error.message
      }
    }
  }

  async applyAllMigrations(): Promise<void> {
    console.log('🚀 Immediate Migration Fix with Comprehensive Fallbacks')
    console.log('=====================================================')
    
    // Check exec_sql availability
    const hasExecSql = await this.migrationExecutor.isExecSqlAvailable()
    if (hasExecSql) {
      console.log('✅ exec_sql RPC function is available')
    } else {
      console.log('⚠️  exec_sql RPC function not available - using fallback methods')
    }

    // Get all migration files
    const migrationDir = path.join(process.cwd(), 'supabase/migrations')
    let migrationFiles: string[] = []
    
    try {
      migrationFiles = fs.readdirSync(migrationDir)
        .filter(file => file.endsWith('.sql'))
        .sort()
        .map(file => path.join(migrationDir, file))
    } catch (error) {
      console.error('❌ Error reading migration directory:', error)
      return
    }

    if (migrationFiles.length === 0) {
      console.log('📝 No migration files found')
      return
    }

    console.log(`\n📋 Found ${migrationFiles.length} migration files`)
    
    let successCount = 0
    let manualCount = 0
    let failedCount = 0
    const failedMigrations: string[] = []
    const manualMigrations: string[] = []

    for (const filePath of migrationFiles) {
      console.log(`\n📄 Processing: ${path.basename(filePath)}`)
      
      try {
        const result = await this.migrationExecutor.executeMigrationFile(filePath)
        
        if (result.success) {
          console.log(`✅ Applied successfully using ${result.method}`)
          successCount++
        } else if (result.method === 'manual') {
          console.log('📋 Requires manual execution')
          manualCount++
          manualMigrations.push(path.basename(filePath))
        } else {
          console.log('❌ Failed completely')
          failedCount++
          failedMigrations.push(path.basename(filePath))
        }
      } catch (error) {
        console.error(`❌ Unexpected error: ${error}`)
        failedCount++
        failedMigrations.push(path.basename(filePath))
      }
    }

    // Summary
    console.log('\n📊 Migration Summary:')
    console.log('====================')
    console.log(`✅ Successfully applied: ${successCount}`)
    console.log(`📋 Require manual execution: ${manualCount}`)
    console.log(`❌ Failed: ${failedCount}`)

    if (manualMigrations.length > 0) {
      console.log('\n📋 Manual execution required for:')
      manualMigrations.forEach(file => console.log(`   • ${file}`))
      console.log('\nCheck the manual instructions provided above.')
    }

    if (failedMigrations.length > 0) {
      console.log('\n❌ Completely failed migrations:')
      failedMigrations.forEach(file => console.log(`   • ${file}`))
    }

    if (successCount === migrationFiles.length) {
      console.log('\n🎉 All migrations applied successfully!')
    } else if (manualCount > 0 && failedCount === 0) {
      console.log('\n⚠️  Some migrations require manual execution.')
      console.log('Complete the manual steps to finish the migration process.')
    } else {
      console.log('\n❌ Migration process had issues.')
      console.log('Review the errors and manual instructions above.')
    }
  }

  async verifyMigration(): Promise<boolean> {
    logStep(3, 'Verifying migration was applied correctly...')
    
    try {
      // Test error tracking columns
      const { error: columnTest } = await this.supabase
        .from('notes')
        .update({ 
          error_message: 'test_error',
          processing_attempts: 1,
          last_error_at: new Date().toISOString()
        })
        .eq('id', '00000000-0000-0000-0000-000000000000') // Non-existent ID
      
      if (columnTest && !columnTest.message.includes('No rows found')) {
        logError('Error tracking columns test failed')
        return false
      }
      logSuccess('Error tracking columns are accessible')

      // Test processing_errors table
      const { error: tableTest } = await this.supabase
        .from('processing_errors')
        .select('*')
        .limit(1)
      
      if (tableTest) {
        logError(`processing_errors table test failed: ${tableTest.message}`)
        return false
      }
      logSuccess('processing_errors table is accessible')

      // Test rate_limits table
      const { error: rateLimitTest } = await this.supabase
        .from('rate_limits')
        .select('*')
        .limit(1)
      
      if (rateLimitTest) {
        logError(`rate_limits table test failed: ${rateLimitTest.message}`)
        return false
      }
      logSuccess('rate_limits table is accessible')

      // Test database functions
      const { error: functionTest } = await this.supabase.rpc('get_processing_stats', {
        p_user_id: '00000000-0000-0000-0000-000000000000'
      })
      
      if (functionTest) {
        logError(`Database functions test failed: ${functionTest.message}`)
        return false
      }
      logSuccess('Database functions are working')

      return true
    } catch (error) {
      logError(`Verification failed: ${error}`)
      return false
    }
  }

  async resetProcessingState(): Promise<void> {
    logStep(4, 'Resetting stuck processing state...')
    
    try {
      // Clear stuck processing locks (older than 15 minutes)
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      
      const { data: stuckNotes, error: findError } = await this.supabase
        .from('notes')
        .select('id, title')
        .is('processed_at', null)
        .not('processing_started_at', 'is', null)
        .lt('processing_started_at', fifteenMinutesAgo)
      
      if (findError) {
        logWarning(`Could not find stuck notes: ${findError.message}`)
        return
      }

      if (stuckNotes && stuckNotes.length > 0) {
        log(`Found ${stuckNotes.length} stuck notes to reset`)
        
        const { error: resetError } = await this.supabase
          .from('notes')
          .update({ 
            processing_started_at: null,
            error_message: null 
          })
          .in('id', stuckNotes.map((n: any) => n.id))
        
        if (resetError) {
          logError(`Failed to reset stuck notes: ${resetError.message}`)
        } else {
          logSuccess(`Reset ${stuckNotes.length} stuck notes`)
        }
      } else {
        logSuccess('No stuck notes found')
      }
      
    } catch (error) {
      logWarning(`Processing state reset failed: ${error}`)
    }
  }

  async generateManualInstructions(): Promise<string> {
    const instructions = `
MANUAL MIGRATION INSTRUCTIONS
=============================

If the automated migration failed, you can apply it manually using the Supabase dashboard:

1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql
2. Paste and execute each SQL block below in order:

-- Step 1: Add error tracking columns
ALTER TABLE notes ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS processing_attempts INTEGER DEFAULT 0;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMP WITH TIME ZONE;

-- Step 2: Create processing_errors table
CREATE TABLE IF NOT EXISTS processing_errors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  error_message TEXT NOT NULL,
  error_type VARCHAR(100),
  stack_trace TEXT,
  processing_attempt INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create rate_limits table
CREATE TABLE IF NOT EXISTS rate_limits (
  service VARCHAR(50) PRIMARY KEY,
  requests BIGINT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_notes_error_status ON notes(error_message) WHERE error_message IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_processing_errors_note_id ON processing_errors(note_id);

-- Step 5: Enable RLS
ALTER TABLE processing_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Step 6: Create functions (paste each function separately)
[See full migration file for complete function definitions]

After executing these manually, run this script again to verify the migration.
`
    
    return instructions
  }
}

async function main() {
  log(`${colors.bold}${colors.magenta}VOICE MEMORY - IMMEDIATE MIGRATION FIX${colors.reset}`)
  log(`${colors.magenta}=====================================${colors.reset}\n`)
  
  try {
    const migrationFix = new ImmediateMigrationFix()
    
    // Check current schema state
    const schemaState = await migrationFix.checkCurrentSchema()
    
    if (schemaState.hasColumns && schemaState.hasTables && schemaState.hasFunctions) {
      logSuccess('Migration appears to already be applied!')
      log('\nVerifying everything is working...')
      
      const isVerified = await migrationFix.verifyMigration()
      if (isVerified) {
        logSuccess('✅ Migration is fully applied and working!')
        await migrationFix.resetProcessingState()
        log('\n🎉 System should now be operational!')
        return
      }
    }
    
    // Apply migration in chunks
    const migrationResult = await migrationFix.executeMigrationChunks()
    
    if (migrationResult.success) {
      logSuccess('Migration chunks executed successfully!')
      log(`Executed: ${migrationResult.executed.length} statements`)
      log(`Skipped: ${migrationResult.skipped.length} statements`)
    } else {
      logError(`Migration failed: ${migrationResult.error}`)
      
      // Generate manual instructions
      const manualInstructions = await migrationFix.generateManualInstructions()
      console.log(manualInstructions)
      return
    }
    
    // Verify migration
    const isVerified = await migrationFix.verifyMigration()
    
    if (isVerified) {
      logSuccess('✅ Migration verified successfully!')
      
      // Reset processing state
      await migrationFix.resetProcessingState()
      
      log(`\n${colors.bold}${colors.green}🎉 MIGRATION COMPLETE!${colors.reset}`)
      log(`${colors.green}The Voice Memory system should now be fully operational.${colors.reset}`)
      log(`\nNext steps:`)
      log(`1. Test the system by uploading a voice note`)
      log(`2. Check the admin dashboard for processing status`)
      log(`3. Monitor the system for any remaining issues`)
      
    } else {
      logError('❌ Migration verification failed!')
      log('\nThe migration was applied but verification failed.')
      log('Please check the logs above and try running the manual instructions.')
      
      const manualInstructions = await migrationFix.generateManualInstructions()
      console.log(manualInstructions)
    }
    
  } catch (error) {
    logError(`Critical error: ${error}`)
    log('\nTry running with manual instructions or check your environment variables.')
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}

export { ImmediateMigrationFix }