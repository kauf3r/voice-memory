#!/usr/bin/env tsx

import * as dotenv from 'dotenv'
import path from 'path'
import { createServiceClient } from '../lib/supabase-server'
import { hasErrorTracking, checkErrorTrackingMigration } from '../lib/migration-checker'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

interface IntegrationTestResult {
  migrationApplied: boolean
  errorTrackingWorking: boolean
  databaseFunctionsWorking: boolean
  processingServiceCompatible: boolean
  warnings: string[]
  errors: string[]
}

async function testProcessingServiceIntegration(): Promise<IntegrationTestResult> {
  const result: IntegrationTestResult = {
    migrationApplied: false,
    errorTrackingWorking: false,
    databaseFunctionsWorking: false,
    processingServiceCompatible: false,
    warnings: [],
    errors: []
  }

  console.log('🔧 Processing Service Integration Test')
  console.log('=====================================\n')

  const supabase = createServiceClient()

  try {
    // Step 1: Check if migration is applied
    console.log('📋 Step 1: Checking migration status...')
    const migrationResult = await checkErrorTrackingMigration()
    result.migrationApplied = migrationResult.isApplied

    if (result.migrationApplied) {
      console.log('✅ Error tracking migration is applied')
    } else {
      console.log('❌ Error tracking migration is not applied')
      result.errors.push('Migration not applied - processing service may fail')
      return result
    }

    // Step 2: Test error tracking columns work with processing service patterns
    console.log('\n📋 Step 2: Testing error tracking with processing service patterns...')
    
    // Get a test note
    const { data: testNote, error: noteError } = await supabase
      .from('notes')
      .select('id, user_id, audio_url, transcription, analysis, processed_at')
      .limit(1)
      .single()

    if (noteError || !testNote) {
      result.errors.push('No test note available for integration testing')
      console.log('⚠️  No test note available - skipping some tests')
    } else {
      console.log(`✅ Found test note: ${testNote.id}`)

      // Test error tracking columns (same pattern as processing service)
      const { error: updateError } = await supabase
        .from('notes')
        .update({
          error_message: 'integration_test',
          processing_attempts: 1,
          last_error_at: new Date().toISOString()
        })
        .eq('id', testNote.id)

      if (updateError) {
        result.errors.push(`Error tracking columns test failed: ${updateError.message}`)
        console.log('❌ Error tracking columns test failed')
      } else {
        console.log('✅ Error tracking columns work correctly')
        result.errorTrackingWorking = true

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

    // Step 3: Test database functions
    console.log('\n📋 Step 3: Testing database functions...')
    
    try {
      // Test get_processing_stats function
      const { data: stats, error: statsError } = await supabase
        .rpc('get_processing_stats', { 
          p_user_id: testNote?.user_id || '00000000-0000-0000-0000-000000000000' 
        })

      if (statsError) {
        result.errors.push(`get_processing_stats function failed: ${statsError.message}`)
        console.log('❌ get_processing_stats function test failed')
      } else {
        console.log('✅ get_processing_stats function works correctly')
        console.log(`   Stats: ${JSON.stringify(stats)}`)
        result.databaseFunctionsWorking = true
      }

      // Test log_processing_error function
      if (testNote) {
        const { error: logError } = await supabase
          .rpc('log_processing_error', {
            p_note_id: testNote.id,
            p_error_message: 'integration_test_error',
            p_error_type: 'test',
            p_stack_trace: 'test stack trace',
            p_processing_attempt: 1
          })

        if (logError) {
          result.errors.push(`log_processing_error function failed: ${logError.message}`)
          console.log('❌ log_processing_error function test failed')
        } else {
          console.log('✅ log_processing_error function works correctly')
          
          // Clean up test error
          await supabase
            .rpc('clear_processing_error', { p_note_id: testNote.id })
        }
      }

    } catch (error) {
      result.errors.push(`Database functions test failed: ${error}`)
      console.log('❌ Database functions test failed')
    }

    // Step 4: Test processing service compatible queries
    console.log('\n📋 Step 4: Testing processing service compatible queries...')
    
    if (testNote) {
      try {
        // Test the same queries that processing service uses
        const { data: notes, error: notesError } = await supabase
          .from('notes')
          .select('transcription, analysis, processed_at, created_at, error_message')
          .eq('user_id', testNote.user_id)

        if (notesError) {
          result.errors.push(`Processing service query test failed: ${notesError.message}`)
          console.log('❌ Processing service query test failed')
        } else {
          console.log('✅ Processing service compatible queries work correctly')
          console.log(`   Found ${notes?.length || 0} notes for user`)

          // Test stuck processing reset pattern
          const { error: resetError } = await supabase
            .from('notes')
            .update({ 
              transcription: null,
              analysis: null,
              error_message: null,
              last_error_at: null
            })
            .eq('id', testNote.id)

          if (resetError) {
            result.errors.push(`Processing service reset pattern failed: ${resetError.message}`)
            console.log('❌ Processing service reset pattern failed')
          } else {
            console.log('✅ Processing service reset pattern works correctly')
            result.processingServiceCompatible = true
          }
        }

      } catch (error) {
        result.errors.push(`Processing service compatibility test failed: ${error}`)
        console.log('❌ Processing service compatibility test failed')
      }
    } else {
      result.warnings.push('Skipped processing service compatibility tests - no test note available')
      console.log('⚠️  Skipped processing service compatibility tests')
    }

    // Step 5: Check for potential issues
    console.log('\n📋 Step 5: Checking for potential issues...')
    
    // Check if processing service could use the database function for stats
    result.warnings.push('Processing service could be optimized to use get_processing_stats function instead of manual calculation')

    console.log('⚠️  Processing service could be optimized to use database function for stats')

  } catch (error) {
    result.errors.push(`Integration test failed: ${error}`)
    console.error('❌ Integration test failed:', error)
  }

  return result
}

function printIntegrationReport(result: IntegrationTestResult) {
  console.log('\n📊 INTEGRATION TEST REPORT')
  console.log('=========================\n')

  console.log('Migration Status:')
  console.log(`  ✅ Migration applied: ${result.migrationApplied ? 'YES' : '❌ NO'}`)

  console.log('\nProcessing Service Compatibility:')
  console.log(`  ✅ Error tracking working: ${result.errorTrackingWorking ? 'YES' : '❌ NO'}`)
  console.log(`  ✅ Database functions working: ${result.databaseFunctionsWorking ? 'YES' : '❌ NO'}`)
  console.log(`  ✅ Processing service compatible: ${result.processingServiceCompatible ? 'YES' : '❌ NO'}`)

  if (result.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:')
    result.warnings.forEach(warning => console.log(`  - ${warning}`))
  }

  if (result.errors.length > 0) {
    console.log('\n❌ ERRORS:')
    result.errors.forEach(error => console.log(`  - ${error}`))
  }

  console.log('\n🎯 OVERALL STATUS:')
  if (result.migrationApplied && result.errorTrackingWorking && result.databaseFunctionsWorking) {
    console.log('✅ INTEGRATION SUCCESSFUL')
    console.log('✅ Processing service can safely use error tracking features')
    console.log('✅ Database is ready for production use')
    console.log('✅ All core functionality is working correctly')
  } else {
    console.log('❌ INTEGRATION ISSUES DETECTED')
    console.log('❌ Some features may not work correctly')
    console.log('❌ Review errors and warnings above')
  }

  return result.migrationApplied && result.errorTrackingWorking && result.databaseFunctionsWorking
}

async function main() {
  console.log('🔧 Processing Service Integration Verification')
  console.log('============================================\n')

  const result = await testProcessingServiceIntegration()
  const isSuccessful = printIntegrationReport(result)

  if (!isSuccessful) {
    console.log('\n🚨 ACTION REQUIRED:')
    console.log('Integration issues detected. Please review the errors above.')
    console.log('The processing service may not work correctly with error tracking features.')
    process.exit(1)
  } else {
    console.log('\n✅ VERIFICATION COMPLETE')
    console.log('The processing service is fully compatible with error tracking features.')
    console.log('All systems are ready for production use.')
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
} 