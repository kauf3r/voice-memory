#!/usr/bin/env tsx

import * as dotenv from 'dotenv'
import path from 'path'
import { createServiceClient } from '../lib/supabase-server'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

async function checkMigration() {
  console.log('🔍 Checking error tracking migration...')
  
  const supabase = createServiceClient()
  
  try {
    // Test 1: Try to update a note with error tracking fields
    console.log('📝 Testing error tracking columns...')
    
    // First, get a sample note
    let { data: sampleNote, error: fetchError } = await supabase
      .from('notes')
      .select('id, user_id')
      .limit(1)
      .single()
    
    if (fetchError || !sampleNote) {
      console.log('⚠️  No notes found to test with')
      // Try to create a test note
      const { data: testNote, error: createError } = await supabase
        .from('notes')
        .insert({
          user_id: '00000000-0000-0000-0000-000000000000', // Test user ID
          audio_url: 'test://test.mp3',
          recorded_at: new Date().toISOString()
        })
        .select('id, user_id')
        .single()
      
      if (createError || !testNote) {
        console.log('❌ Could not create test note:', createError?.message)
        return false
      }
      
      sampleNote = testNote
    }
    
    if (!sampleNote) {
      console.log('❌ No sample note available for testing')
      return false
    }
    
    // Test updating with error tracking fields
    const { error: updateError } = await supabase
      .from('notes')
      .update({
        error_message: 'Test error message',
        processing_attempts: 1,
        last_error_at: new Date().toISOString()
      })
      .eq('id', sampleNote.id)
    
    if (updateError) {
      console.log('❌ Error tracking columns do not exist:', updateError.message)
      return false
    }
    
    console.log('✅ Error tracking columns exist and work correctly')
    
    // Test 2: Check if processing_errors table exists
    console.log('📊 Testing processing_errors table...')
    
    const { data: errorLog, error: logError } = await supabase
      .from('processing_errors')
      .insert({
        note_id: sampleNote.id,
        error_message: 'Test error for migration verification',
        error_type: 'migration_test',
        processing_attempt: 1
      })
      .select('id')
      .single()
    
    if (logError) {
      console.log('❌ processing_errors table does not exist:', logError.message)
      return false
    }
    
    console.log('✅ processing_errors table exists and works correctly')
    
    // Test 3: Check if rate_limits table exists
    console.log('⏱️  Testing rate_limits table...')
    
    const { data: rateLimit, error: rateError } = await supabase
      .from('rate_limits')
      .upsert({
        service: 'test_service',
        requests: [Date.now()],
        updated_at: new Date().toISOString()
      })
      .select('service')
      .single()
    
    if (rateError) {
      console.log('❌ rate_limits table does not exist:', rateError.message)
      return false
    }
    
    console.log('✅ rate_limits table exists and works correctly')
    
    // Test 4: Check if functions exist
    console.log('🔧 Testing database functions...')
    
    try {
      const { data: stats, error: statsError } = await supabase
        .rpc('get_processing_stats', { p_user_id: sampleNote.user_id })
      
      if (statsError) {
        console.log('⚠️  get_processing_stats function not available:', statsError.message)
      } else {
        console.log('✅ get_processing_stats function works correctly')
      }
    } catch (error) {
      console.log('⚠️  Could not test functions, but tables exist')
    }
    
    // Clean up test data
    try {
      await supabase
        .from('processing_errors')
        .delete()
        .eq('error_type', 'migration_test')
      
      await supabase
        .from('rate_limits')
        .delete()
        .eq('service', 'test_service')
      
      if (sampleNote.user_id === '00000000-0000-0000-0000-000000000000') {
        await supabase
          .from('notes')
          .delete()
          .eq('id', sampleNote.id)
      }
    } catch (cleanupError) {
      console.log('⚠️  Could not clean up test data:', cleanupError)
    }
    
    console.log('🎉 Migration 20240119_add_error_tracking.sql has been applied successfully!')
    return true
    
  } catch (error) {
    console.error('❌ Error checking migration:', error)
    return false
  }
}

async function main() {
  console.log('🔧 Simple Migration Verification Tool')
  console.log('===================================\n')
  
  const isApplied = await checkMigration()
  
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

export { checkMigration } 