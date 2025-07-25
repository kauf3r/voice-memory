#!/usr/bin/env ts-node

/**
 * MANUAL MIGRATION GUIDE SCRIPT
 * 
 * Interactive manual migration guide script that provides step-by-step 
 * instructions for applying the migration manually if automated methods fail.
 */

import { createClient } from '@supabase/supabase-js'
import * as readline from 'readline'
import * as fs from 'fs'
import * as path from 'path'

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

function logStep(step: string, message: string) {
  log(`${colors.bold}${colors.blue}${step}:${colors.reset} ${message}`)
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

function logInfo(message: string) {
  log(`${colors.cyan}ℹ ${message}${colors.reset}`)
}

interface DiagnosisResult {
  hasColumns: boolean
  hasTables: boolean
  hasFunctions: boolean
  missingComponents: string[]
  recommendations: string[]
}

class ManualMigrationGuide {
  private supabase: any
  private rl: readline.Interface

  constructor() {
    // Validate environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY')
    }

    // Create Supabase client with service role permissions
    this.supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Create readline interface for user interaction
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
  }

  private async askQuestion(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(`${colors.cyan}${question}${colors.reset} `, resolve)
    })
  }

  private async askYesNo(question: string): Promise<boolean> {
    const answer = await this.askQuestion(`${question} (y/n):`)
    return answer.toLowerCase().startsWith('y')
  }

  async runInteractiveDiagnosis(): Promise<DiagnosisResult> {
    log(`${colors.bold}${colors.magenta}INTERACTIVE MIGRATION DIAGNOSIS${colors.reset}`)
    log(`${colors.magenta}===============================${colors.reset}\n`)

    const result: DiagnosisResult = {
      hasColumns: false,
      hasTables: false,
      hasFunctions: false,
      missingComponents: [],
      recommendations: []
    }

    logStep('Step 1', 'Checking error tracking columns in notes table...')

    try {
      // Check error tracking columns
      const { data: notesSample, error: notesError } = await this.supabase
        .from('notes')
        .select('*')
        .limit(1)

      if (notesError) {
        logError('Cannot access notes table')
        result.missingComponents.push('notes table access')
      } else if (notesSample && notesSample[0]) {
        const sampleNote = notesSample[0]
        const hasErrorMessage = 'error_message' in sampleNote
        const hasProcessingAttempts = 'processing_attempts' in sampleNote
        const hasLastErrorAt = 'last_error_at' in sampleNote

        result.hasColumns = hasErrorMessage && hasProcessingAttempts && hasLastErrorAt

        if (result.hasColumns) {
          logSuccess('All error tracking columns are present')
        } else {
          logWarning(`Missing columns: ${[
            !hasErrorMessage && 'error_message',
            !hasProcessingAttempts && 'processing_attempts',
            !hasLastErrorAt && 'last_error_at'
          ].filter(Boolean).join(', ')}`)
          result.missingComponents.push('error tracking columns')
        }
      } else {
        logWarning('Notes table is empty - cannot verify columns from sample')
        
        // Try alternative method using information_schema
        try {
          const { data: columns, error: columnsError } = await this.supabase.rpc('exec_sql', {
            sql: `
              SELECT column_name 
              FROM information_schema.columns 
              WHERE table_name = 'notes' 
              AND column_name IN ('error_message', 'processing_attempts', 'last_error_at')
            `
          })

          if (!columnsError && columns && columns.length >= 3) {
            result.hasColumns = true
            logSuccess('Error tracking columns verified via schema inspection')
          } else {
            logWarning('Could not verify columns - may need manual inspection')
            result.missingComponents.push('error tracking columns (unverified)')
          }
        } catch (schemaError) {
          logWarning('Could not verify columns via schema inspection')
          result.missingComponents.push('error tracking columns (unverified)')
        }
      }
    } catch (error) {
      logError(`Column check failed: ${error}`)
      result.missingComponents.push('error tracking columns')
    }

    logStep('Step 2', 'Checking processing_errors table...')

    try {
      const { data: errorsSample, error: errorsError } = await this.supabase
        .from('processing_errors')
        .select('*')
        .limit(1)

      if (errorsError) {
        if (errorsError.message?.includes('relation "processing_errors" does not exist')) {
          logWarning('processing_errors table does not exist')
          result.missingComponents.push('processing_errors table')
        } else {
          logError(`processing_errors table check failed: ${errorsError.message}`)
          result.missingComponents.push('processing_errors table (access issue)')
        }
      } else {
        result.hasTables = true
        logSuccess('processing_errors table exists and is accessible')
      }
    } catch (error) {
      logError(`Table check failed: ${error}`)
      result.missingComponents.push('processing_errors table')
    }

    logStep('Step 3', 'Checking rate_limits table...')

    try {
      const { data: rateLimitsSample, error: rateLimitsError } = await this.supabase
        .from('rate_limits')
        .select('*')
        .limit(1)

      if (rateLimitsError) {
        if (rateLimitsError.message?.includes('relation "rate_limits" does not exist')) {
          logWarning('rate_limits table does not exist')
          result.missingComponents.push('rate_limits table')
        } else {
          logError(`rate_limits table check failed: ${rateLimitsError.message}`)
          result.missingComponents.push('rate_limits table (access issue)')
        }
      } else {
        logSuccess('rate_limits table exists and is accessible')
      }
    } catch (error) {
      logError(`Rate limits table check failed: ${error}`)
      result.missingComponents.push('rate_limits table')
    }

    logStep('Step 4', 'Checking database functions...')

    const functions = [
      'log_processing_error',
      'clear_processing_error',
      'get_processing_stats'
    ]

    let functionsExist = 0

    for (const functionName of functions) {
      try {
        if (functionName === 'get_processing_stats') {
          const { error } = await this.supabase.rpc('get_processing_stats', {
            p_user_id: '00000000-0000-0000-0000-000000000000'
          })
          
          if (!error) {
            functionsExist++
            logSuccess(`Function ${functionName} exists`)
          } else if (error.message?.includes('function') && error.message?.includes('does not exist')) {
            logWarning(`Function ${functionName} does not exist`)
            result.missingComponents.push(`function: ${functionName}`)
          } else {
            logSuccess(`Function ${functionName} exists (expected error with test data)`)
            functionsExist++
          }
        } else {
          // For other functions, we expect them to fail with test data but exist
          const { error } = await this.supabase.rpc(functionName, 
            functionName === 'log_processing_error' 
              ? {
                  p_note_id: '00000000-0000-0000-0000-000000000000',
                  p_error_message: 'test',
                  p_error_type: 'test'
                }
              : { p_note_id: '00000000-0000-0000-0000-000000000000' }
          )

          if (error?.message?.includes('function') && error.message?.includes('does not exist')) {
            logWarning(`Function ${functionName} does not exist`)
            result.missingComponents.push(`function: ${functionName}`)
          } else {
            logSuccess(`Function ${functionName} exists`)
            functionsExist++
          }
        }
      } catch (error) {
        logWarning(`Could not test function ${functionName}: ${error}`)
        result.missingComponents.push(`function: ${functionName} (test failed)`)
      }
    }

    result.hasFunctions = functionsExist >= 3

    // Generate recommendations
    if (result.missingComponents.length === 0) {
      result.recommendations.push('✅ All migration components appear to be present!')
      result.recommendations.push('You may want to run the verification script to confirm everything is working correctly.')
    } else {
      result.recommendations.push('❌ Migration is incomplete. You need to apply the missing components manually.')
      
      if (result.missingComponents.some(c => c.includes('columns'))) {
        result.recommendations.push('• Add error tracking columns to the notes table')
      }
      if (result.missingComponents.some(c => c.includes('processing_errors table'))) {
        result.recommendations.push('• Create the processing_errors table')
      }
      if (result.missingComponents.some(c => c.includes('rate_limits table'))) {
        result.recommendations.push('• Create the rate_limits table')  
      }
      if (result.missingComponents.some(c => c.includes('function'))) {
        result.recommendations.push('• Create the required database functions')
      }
    }

    return result
  }

  generateCustomizedSQL(diagnosis: DiagnosisResult): string[] {
    const sqlBlocks: string[] = []

    if (diagnosis.missingComponents.some(c => c.includes('columns'))) {
      sqlBlocks.push(`-- Add error tracking columns to notes table
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS processing_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMP WITH TIME ZONE;`)
    }

    if (diagnosis.missingComponents.some(c => c.includes('processing_errors table'))) {
      sqlBlocks.push(`-- Create processing_errors table
CREATE TABLE IF NOT EXISTS processing_errors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    error_message TEXT NOT NULL,
    error_type VARCHAR(100),
    stack_trace TEXT,
    processing_attempt INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for processing_errors
CREATE INDEX IF NOT EXISTS idx_processing_errors_note_id ON processing_errors(note_id);
CREATE INDEX IF NOT EXISTS idx_processing_errors_created_at ON processing_errors(created_at);
CREATE INDEX IF NOT EXISTS idx_processing_errors_error_type ON processing_errors(error_type);`)
    }

    if (diagnosis.missingComponents.some(c => c.includes('rate_limits table'))) {
      sqlBlocks.push(`-- Create rate_limits table
CREATE TABLE IF NOT EXISTS rate_limits (
    service VARCHAR(50) PRIMARY KEY,
    requests BIGINT[] NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`)
    }

    if (diagnosis.missingComponents.some(c => c.includes('columns'))) {
      sqlBlocks.push(`-- Create indexes for error tracking columns
CREATE INDEX IF NOT EXISTS idx_notes_error_status ON notes(error_message) WHERE error_message IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notes_processing_attempts ON notes(processing_attempts);
CREATE INDEX IF NOT EXISTS idx_notes_last_error_at ON notes(last_error_at);`)
    }

    if (diagnosis.missingComponents.some(c => c.includes('processing_errors table') || c.includes('rate_limits table'))) {
      sqlBlocks.push(`-- Enable Row Level Security
ALTER TABLE processing_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;`)
    }

    if (diagnosis.missingComponents.some(c => c.includes('function'))) {
      sqlBlocks.push(`-- Create log_processing_error function
CREATE OR REPLACE FUNCTION log_processing_error(
    p_note_id UUID,
    p_error_message TEXT,
    p_error_type VARCHAR(100) DEFAULT NULL,
    p_stack_trace TEXT DEFAULT NULL,
    p_processing_attempt INTEGER DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    -- Insert into processing_errors table
    INSERT INTO processing_errors (
        note_id,
        error_message,
        error_type,
        stack_trace,
        processing_attempt
    ) VALUES (
        p_note_id,
        p_error_message,
        p_error_type,
        p_stack_trace,
        COALESCE(p_processing_attempt, 
            (SELECT processing_attempts FROM notes WHERE id = p_note_id)
        )
    );
    
    -- Update the note with error information
    UPDATE notes 
    SET 
        error_message = p_error_message,
        last_error_at = NOW(),
        processing_attempts = COALESCE(processing_attempts, 0) + 1
    WHERE id = p_note_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`)

      sqlBlocks.push(`-- Create clear_processing_error function
CREATE OR REPLACE FUNCTION clear_processing_error(p_note_id UUID) RETURNS VOID AS $$
BEGIN
    UPDATE notes 
    SET 
        error_message = NULL,
        last_error_at = NULL
    WHERE id = p_note_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`)

      sqlBlocks.push(`-- Create get_processing_stats function
CREATE OR REPLACE FUNCTION get_processing_stats(p_user_id UUID)
RETURNS TABLE(
    total BIGINT,
    pending BIGINT,
    processing BIGINT,
    completed BIGINT,
    failed BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total,
        COUNT(*) FILTER (WHERE processed_at IS NULL AND error_message IS NULL)::BIGINT as pending,
        COUNT(*) FILTER (WHERE processed_at IS NULL AND transcription IS NOT NULL AND analysis IS NULL)::BIGINT as processing,
        COUNT(*) FILTER (WHERE processed_at IS NOT NULL)::BIGINT as completed,
        COUNT(*) FILTER (WHERE error_message IS NOT NULL)::BIGINT as failed
    FROM notes 
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`)
    }

    return sqlBlocks
  }

  async provideSupabaseDashboardInstructions(sqlBlocks: string[]): Promise<void> {
    log(`\n${colors.bold}${colors.cyan}SUPABASE DASHBOARD INSTRUCTIONS${colors.reset}`)
    log(`${colors.cyan}===============================${colors.reset}\n`)

    const projectId = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\./)?.[1]
    const dashboardUrl = projectId ? `https://supabase.com/dashboard/project/${projectId}/sql` : 'https://supabase.com/dashboard'

    logInfo(`1. Open your Supabase dashboard: ${dashboardUrl}`)
    logInfo('2. Navigate to the SQL Editor (if not already there)')
    logInfo('3. Execute each SQL block below IN ORDER:')

    for (let i = 0; i < sqlBlocks.length; i++) {
      log(`\n${colors.bold}${colors.yellow}SQL Block ${i + 1}:${colors.reset}`)
      log(`${colors.gray}${'-'.repeat(50)}${colors.reset}`)
      log(sqlBlocks[i])
      log(`${colors.gray}${'-'.repeat(50)}${colors.reset}`)

      if (i < sqlBlocks.length - 1) {
        const shouldContinue = await this.askYesNo(`\nHave you executed SQL Block ${i + 1} successfully?`)
        if (!shouldContinue) {
          logWarning('Please execute the SQL block and try again.')
          return
        }
      }
    }

    log(`\n${colors.bold}${colors.green}All SQL blocks provided!${colors.reset}`)
    logInfo('After executing all blocks, run the verification script to confirm everything is working.')
  }

  generateVerificationCommands(): string[] {
    return [
      `-- Verify error tracking columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'notes' 
AND column_name IN ('error_message', 'processing_attempts', 'last_error_at');`,

      `-- Verify processing_errors table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'processing_errors';`,

      `-- Verify rate_limits table exists  
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'rate_limits';`,

      `-- Test get_processing_stats function
SELECT * FROM get_processing_stats('00000000-0000-0000-0000-000000000000');`,

      `-- Verify all functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name IN ('log_processing_error', 'clear_processing_error', 'get_processing_stats');`
    ]
  }

  async provideTroubleshootingGuide(): Promise<void> {
    log(`\n${colors.bold}${colors.magenta}TROUBLESHOOTING GUIDE${colors.reset}`)
    log(`${colors.magenta}====================${colors.reset}\n`)

    logStep('Common Issues', '')
    
    log(`${colors.yellow}Issue 1: Permission Denied${colors.reset}`)
    log('Solution: Make sure you\'re using a service role key, not an anon key')
    log('Check that your SUPABASE_SERVICE_ROLE_KEY is correct\n')

    log(`${colors.yellow}Issue 2: Relation Does Not Exist${colors.reset}`)
    log('Solution: The table hasn\'t been created yet')
    log('Run the CREATE TABLE statements first\n')

    log(`${colors.yellow}Issue 3: Column Already Exists${colors.reset}`)
    log('Solution: This is normal - the IF NOT EXISTS clause handles this')
    log('You can safely ignore these errors\n')

    log(`${colors.yellow}Issue 4: Function Already Exists${colors.reset}`)
    log('Solution: Using CREATE OR REPLACE will update the function')
    log('This is expected behavior\n')

    log(`${colors.yellow}Issue 5: Foreign Key Constraint Violation${colors.reset}`)
    log('Solution: This means the notes table structure is different than expected')
    log('Check that the notes table has an \'id\' column of type UUID\n')

    const needsHelp = await this.askYesNo('Do you need help with a specific error?')
    
    if (needsHelp) {
      const errorDescription = await this.askQuestion('Please describe the error you\'re seeing:')
      log(`\n${colors.cyan}For the error: "${errorDescription}"${colors.reset}`)
      log(`${colors.cyan}Recommended actions:${colors.reset}`)
      log('1. Check the exact error message in the Supabase dashboard')
      log('2. Verify you have the correct permissions')
      log('3. Try executing the SQL blocks one at a time')
      log('4. Contact support if the issue persists')
    }
  }

  async provideRecoveryProcedures(): Promise<void> {
    log(`\n${colors.bold}${colors.red}RECOVERY PROCEDURES${colors.reset}`)
    log(`${colors.red}==================${colors.reset}\n`)

    logStep('If Migration Partially Fails', '')
    
    log('1. Don\'t panic - partial migrations can be completed')
    log('2. Run the diagnosis again to see what\'s missing')
    log('3. Only execute the SQL blocks for missing components')
    log('4. Use the verification commands to confirm each step\n')

    logStep('If You Need to Rollback', '')
    log(`${colors.yellow}WARNING: Only use these if absolutely necessary${colors.reset}`)
    
    const rollbackCommands = [
      '-- Remove error tracking columns (DESTRUCTIVE)',
      'ALTER TABLE notes DROP COLUMN IF EXISTS error_message;',
      'ALTER TABLE notes DROP COLUMN IF EXISTS processing_attempts;', 
      'ALTER TABLE notes DROP COLUMN IF EXISTS last_error_at;',
      '',
      '-- Drop tables (DESTRUCTIVE)',
      'DROP TABLE IF EXISTS processing_errors;',
      'DROP TABLE IF EXISTS rate_limits;',
      '',
      '-- Drop functions',
      'DROP FUNCTION IF EXISTS log_processing_error(UUID, TEXT, VARCHAR, TEXT, INTEGER);',
      'DROP FUNCTION IF EXISTS clear_processing_error(UUID);',
      'DROP FUNCTION IF EXISTS get_processing_stats(UUID);'
    ]

    log('Rollback SQL:')
    log(`${colors.gray}${'-'.repeat(40)}${colors.reset}`)
    rollbackCommands.forEach(cmd => log(cmd))
    log(`${colors.gray}${'-'.repeat(40)}${colors.reset}`)

    logWarning('Only use rollback if you need to start completely over!')
  }

  async close(): Promise<void> {
    this.rl.close()
  }
}

async function main() {
  log(`${colors.bold}${colors.magenta}VOICE MEMORY - MANUAL MIGRATION GUIDE${colors.reset}`)
  log(`${colors.magenta}=====================================${colors.reset}\n`)
  
  const guide = new ManualMigrationGuide()

  try {
    // Interactive diagnosis
    const diagnosis = await guide.runInteractiveDiagnosis()

    // Show results
    log(`\n${colors.bold}DIAGNOSIS RESULTS:${colors.reset}`)
    log(`Missing components: ${diagnosis.missingComponents.length}`)
    diagnosis.missingComponents.forEach(component => {
      log(`  • ${component}`)
    })

    log(`\n${colors.bold}RECOMMENDATIONS:${colors.reset}`)
    diagnosis.recommendations.forEach(rec => {
      log(`  ${rec}`)
    })

    if (diagnosis.missingComponents.length === 0) {
      logSuccess('Migration appears complete! Consider running the verification script.')
      await guide.close()
      return
    }

    // Generate customized SQL
    const needsSQL = await guide.askYesNo('\nWould you like me to generate the exact SQL commands you need?')
    
    if (needsSQL) {
      const sqlBlocks = guide.generateCustomizedSQL(diagnosis)
      
      if (sqlBlocks.length > 0) {
        await guide.provideSupabaseDashboardInstructions(sqlBlocks)
        
        // Provide verification commands
        const wantsVerification = await guide.askYesNo('\nWould you like verification commands to test each step?')
        if (wantsVerification) {
          log(`\n${colors.bold}${colors.green}VERIFICATION COMMANDS${colors.reset}`)
          log(`${colors.green}====================${colors.reset}\n`)
          
          const verificationCommands = guide.generateVerificationCommands()
          verificationCommands.forEach((cmd, i) => {
            log(`${colors.bold}Verification ${i + 1}:${colors.reset}`)
            log(cmd)
            log('')
          })
        }
      } else {
        logSuccess('No SQL commands needed - all components appear to be present!')
      }
    }

    // Offer troubleshooting help
    const needsTroubleshooting = await guide.askYesNo('\nDo you need troubleshooting help?')
    if (needsTroubleshooting) {
      await guide.provideTroubleshootingGuide()
    }

    // Offer recovery procedures
    const needsRecovery = await guide.askYesNo('\nDo you need recovery/rollback procedures?')
    if (needsRecovery) {
      await guide.provideRecoveryProcedures()
    }

    log(`\n${colors.bold}${colors.green}Manual migration guide complete!${colors.reset}`)
    log(`${colors.green}After applying the changes, run the verification script to confirm everything is working.${colors.reset}`)

  } catch (error) {
    logError(`Critical error: ${error}`)
    log('\nPlease check your environment variables and try again.')
  } finally {
    await guide.close()
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}

export { ManualMigrationGuide }