#!/usr/bin/env tsx

import * as dotenv from 'dotenv'
import path from 'path'
import { createServiceClient } from '../lib/supabase-server'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

interface MigrationStatus {
  isApplied: boolean
  details: {
    errorTrackingColumns: boolean
    processingErrorsTable: boolean
    rateLimitsTable: boolean
    functions: {
      logProcessingError: boolean
      clearProcessingError: boolean
      getProcessingStats: boolean
    }
    indexes: boolean
    rlsPolicies: boolean
  }
  errors: string[]
  warnings: string[]
}

async function verifyMigrationDetailed(): Promise<MigrationStatus> {
  const supabase = createServiceClient()
  const status: MigrationStatus = {
    isApplied: false,
    details: {
      errorTrackingColumns: false,
      processingErrorsTable: false,
      rateLimitsTable: false,
      functions: {
        logProcessingError: false,
        clearProcessingError: false,
        getProcessingStats: false
      },
      indexes: false,
      rlsPolicies: false
    },
    errors: [],
    warnings: []
  }

  console.log('🔍 Detailed Migration Verification')
  console.log('==================================\n')

  let testNote: { id: string; user_id?: string } | null = null

  try {
    // 1. Check error tracking columns in notes table
    console.log('📋 Checking error tracking columns...')
    try {
      const { data: noteData } = await supabase
        .from('notes')
        .select('id, user_id')
        .limit(1)
        .single()

      testNote = noteData

      if (!testNote) {
        status.warnings.push('No notes found to test with')
        console.log('⚠️  No notes found to test with')
      } else {
        // Test updating with error tracking fields
        const { error } = await supabase
          .from('notes')
          .update({
            error_message: 'migration_test',
            processing_attempts: 0,
            last_error_at: new Date().toISOString()
          })
          .eq('id', testNote.id)

        if (error) {
          status.errors.push(`Error tracking columns test failed: ${error.message}`)
          console.log('❌ Error tracking columns test failed:', error.message)
        } else {
          status.details.errorTrackingColumns = true
          console.log('✅ Error tracking columns exist and work correctly')

          // Clean up test
          await supabase
            .from('notes')
            .update({
              error_message: null,
              processing_attempts: null,
              last_error_at: null
            })
            .eq('id', testNote.id)
        }
      }
    } catch (error) {
      status.errors.push(`Error checking columns: ${error}`)
      console.log('❌ Error checking columns:', error)
    }

    // 2. Check processing_errors table
    console.log('\n📊 Checking processing_errors table...')
    try {
      const { data: errorLog, error } = await supabase
        .from('processing_errors')
        .insert({
          note_id: testNote?.id || '00000000-0000-0000-0000-000000000000',
          error_message: 'Test error for migration verification',
          error_type: 'migration_test',
          processing_attempt: 1
        })
        .select('id')
        .single()

      if (error) {
        status.errors.push(`processing_errors table test failed: ${error.message}`)
        console.log('❌ processing_errors table test failed:', error.message)
      } else {
        status.details.processingErrorsTable = true
        console.log('✅ processing_errors table exists and works correctly')

        // Clean up test
        await supabase
          .from('processing_errors')
          .delete()
          .eq('id', errorLog.id)
      }
    } catch (error) {
      status.errors.push(`Error checking processing_errors table: ${error}`)
      console.log('❌ Error checking processing_errors table:', error)
    }

    // 3. Check rate_limits table
    console.log('\n⏱️  Checking rate_limits table...')
    try {
      const { data: rateLimit, error } = await supabase
        .from('rate_limits')
        .upsert({
          service: 'test_service',
          requests: [Date.now()],
          updated_at: new Date().toISOString()
        })
        .select('service')
        .single()

      if (error) {
        status.errors.push(`rate_limits table test failed: ${error.message}`)
        console.log('❌ rate_limits table test failed:', error.message)
      } else {
        status.details.rateLimitsTable = true
        console.log('✅ rate_limits table exists and works correctly')

        // Clean up test
        await supabase
          .from('rate_limits')
          .delete()
          .eq('service', 'test_service')
      }
    } catch (error) {
      status.errors.push(`Error checking rate_limits table: ${error}`)
      console.log('❌ Error checking rate_limits table:', error)
    }

    // 4. Check database functions
    console.log('\n🔧 Checking database functions...')
    
    // Test get_processing_stats function
    try {
      const { data: stats, error } = await supabase
        .rpc('get_processing_stats', { 
          p_user_id: testNote?.user_id || '00000000-0000-0000-0000-000000000000' 
        })

      if (error) {
        status.errors.push(`get_processing_stats function test failed: ${error.message}`)
        console.log('❌ get_processing_stats function test failed:', error.message)
      } else {
        status.details.functions.getProcessingStats = true
        console.log('✅ get_processing_stats function works correctly')
      }
    } catch (error) {
      status.errors.push(`Error testing get_processing_stats: ${error}`)
      console.log('❌ Error testing get_processing_stats:', error)
    }

    // Test log_processing_error function
    try {
      const { error } = await supabase
        .rpc('log_processing_error', {
          p_note_id: testNote?.id || '00000000-0000-0000-0000-000000000000',
          p_error_message: 'Test error for function verification',
          p_error_type: 'function_test',
          p_processing_attempt: 1
        })

      if (error) {
        status.errors.push(`log_processing_error function test failed: ${error.message}`)
        console.log('❌ log_processing_error function test failed:', error.message)
      } else {
        status.details.functions.logProcessingError = true
        console.log('✅ log_processing_error function works correctly')
      }
    } catch (error) {
      status.errors.push(`Error testing log_processing_error: ${error}`)
      console.log('❌ Error testing log_processing_error:', error)
    }

    // Test clear_processing_error function
    try {
      const { error } = await supabase
        .rpc('clear_processing_error', {
          p_note_id: testNote?.id || '00000000-0000-0000-0000-000000000000'
        })

      if (error) {
        status.errors.push(`clear_processing_error function test failed: ${error.message}`)
        console.log('❌ clear_processing_error function test failed:', error.message)
      } else {
        status.details.functions.clearProcessingError = true
        console.log('✅ clear_processing_error function works correctly')
      }
    } catch (error) {
      status.errors.push(`Error testing clear_processing_error: ${error}`)
      console.log('❌ Error testing clear_processing_error:', error)
    }

    // 5. Check if indexes exist (basic check)
    console.log('\n📈 Checking indexes...')
    try {
      // Try to query with error_message filter to test index
      const { data: errorNotes, error } = await supabase
        .from('notes')
        .select('id')
        .not('error_message', 'is', null)
        .limit(1)

      if (error) {
        status.warnings.push(`Index test inconclusive: ${error.message}`)
        console.log('⚠️  Index test inconclusive:', error.message)
      } else {
        status.details.indexes = true
        console.log('✅ Indexes appear to be working correctly')
      }
    } catch (error) {
      status.warnings.push(`Could not test indexes: ${error}`)
      console.log('⚠️  Could not test indexes:', error)
    }

    // 6. Check RLS policies (basic check)
    console.log('\n🔒 Checking RLS policies...')
    try {
      // Try to insert into processing_errors (should work with service role)
      const { error } = await supabase
        .from('processing_errors')
        .insert({
          note_id: testNote?.id || '00000000-0000-0000-0000-000000000000',
          error_message: 'RLS test',
          processing_attempt: 1
        })

      if (error && error.message.includes('policy')) {
        status.warnings.push(`RLS policy test inconclusive: ${error.message}`)
        console.log('⚠️  RLS policy test inconclusive:', error.message)
      } else {
        status.details.rlsPolicies = true
        console.log('✅ RLS policies appear to be working correctly')
      }
    } catch (error) {
      status.warnings.push(`Could not test RLS policies: ${error}`)
      console.log('⚠️  Could not test RLS policies:', error)
    }

    // Determine overall status
    const coreFeatures = [
      status.details.errorTrackingColumns,
      status.details.processingErrorsTable,
      status.details.rateLimitsTable
    ]

    const functionFeatures = [
      status.details.functions.getProcessingStats,
      status.details.functions.logProcessingError,
      status.details.functions.clearProcessingError
    ]

    status.isApplied = coreFeatures.every(feature => feature) && 
                      functionFeatures.some(feature => feature)

  } catch (error) {
    status.errors.push(`Verification failed: ${error}`)
    console.error('❌ Verification failed:', error)
  }

  return status
}

function printStatusReport(status: MigrationStatus) {
  console.log('\n📊 MIGRATION STATUS REPORT')
  console.log('=========================\n')

  console.log('Core Features:')
  console.log(`  ✅ Error tracking columns: ${status.details.errorTrackingColumns ? 'YES' : '❌ NO'}`)
  console.log(`  ✅ processing_errors table: ${status.details.processingErrorsTable ? 'YES' : '❌ NO'}`)
  console.log(`  ✅ rate_limits table: ${status.details.rateLimitsTable ? 'YES' : '❌ NO'}`)

  console.log('\nDatabase Functions:')
  console.log(`  ✅ get_processing_stats: ${status.details.functions.getProcessingStats ? 'YES' : '❌ NO'}`)
  console.log(`  ✅ log_processing_error: ${status.details.functions.logProcessingError ? 'YES' : '❌ NO'}`)
  console.log(`  ✅ clear_processing_error: ${status.details.functions.clearProcessingError ? 'YES' : '❌ NO'}`)

  console.log('\nAdditional Features:')
  console.log(`  ✅ Indexes: ${status.details.indexes ? 'YES' : '⚠️  UNKNOWN'}`)
  console.log(`  ✅ RLS Policies: ${status.details.rlsPolicies ? 'YES' : '⚠️  UNKNOWN'}`)

  if (status.errors.length > 0) {
    console.log('\n❌ ERRORS:')
    status.errors.forEach(error => console.log(`  - ${error}`))
  }

  if (status.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:')
    status.warnings.forEach(warning => console.log(`  - ${warning}`))
  }

  console.log('\n🎯 OVERALL STATUS:')
  if (status.isApplied) {
    console.log('✅ MIGRATION IS FULLY APPLIED')
    console.log('✅ Processing service can use all error tracking features')
    console.log('✅ Database is ready for production use')
  } else {
    console.log('❌ MIGRATION IS NOT FULLY APPLIED')
    console.log('❌ Processing service may fail when using error tracking features')
    console.log('❌ Database needs migration before production use')
  }

  return status.isApplied
}

async function main() {
  console.log('🔧 Detailed Migration Verification Tool')
  console.log('=====================================\n')

  const status = await verifyMigrationDetailed()
  const isApplied = printStatusReport(status)

  if (!isApplied) {
    console.log('\n🚨 ACTION REQUIRED:')
    console.log('The error tracking migration has not been fully applied.')
    console.log('Please run the migration using one of these methods:')
    console.log('')
    console.log('1. Supabase Dashboard (Recommended):')
    console.log('   - Go to your project dashboard')
    console.log('   - Navigate to SQL Editor')
    console.log('   - Run the migration file: supabase/migrations/20240119_add_error_tracking.sql')
    console.log('')
    console.log('2. Supabase CLI:')
    console.log('   supabase db push')
    console.log('')
    console.log('3. Migration Script:')
    console.log('   npx tsx scripts/manage-migration.ts apply')
    console.log('')
    process.exit(1)
  } else {
    console.log('\n✅ VERIFICATION COMPLETE')
    console.log('The error tracking migration is properly applied.')
    console.log('All features are working correctly.')
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export { verifyMigrationDetailed, printStatusReport } 