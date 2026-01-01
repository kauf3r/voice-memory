#!/usr/bin/env tsx

import * as dotenv from 'dotenv'
import path from 'path'
import { createServiceClient } from '../lib/supabase-server'
import { hasErrorTracking } from '../lib/migration-checker'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

async function healthCheck() {
  console.log('🏥 Voice Memory Health Check')
  console.log('===========================\n')

  const supabase = createServiceClient()
  let allSystemsHealthy = true

  try {
    // 1. Check database connection
    console.log('🔌 Checking database connection...')
    const { data: testData, error: connectionError } = await supabase
      .from('notes')
      .select('id, user_id')
      .limit(1)

    if (connectionError) {
      console.log('❌ Database connection failed:', connectionError.message)
      allSystemsHealthy = false
    } else {
      console.log('✅ Database connection successful')
    }

    // 2. Check error tracking migration
    console.log('\n📋 Checking error tracking migration...')
    const errorTrackingAvailable = await hasErrorTracking()
    
    if (errorTrackingAvailable) {
      console.log('✅ Error tracking migration is applied')
    } else {
      console.log('❌ Error tracking migration is not applied')
      allSystemsHealthy = false
    }

    // 3. Check processing service compatibility
    console.log('\n⚙️  Checking processing service compatibility...')
    
    if (testData && testData.length > 0) {
      const testNote = testData[0]
      
      // Test error tracking columns
      const { error: updateError } = await supabase
        .from('notes')
        .update({
          error_message: 'health_check_test',
          processing_attempts: 0,
          last_error_at: new Date().toISOString()
        })
        .eq('id', testNote.id)

      if (updateError) {
        console.log('❌ Error tracking columns not working:', updateError.message)
        allSystemsHealthy = false
      } else {
        console.log('✅ Error tracking columns working')
        
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

      // Test database functions
      const { error: functionError } = await supabase
        .rpc('get_processing_stats', { 
          p_user_id: testNote.user_id || '00000000-0000-0000-0000-000000000000' 
        })

      if (functionError) {
        console.log('❌ Database functions not working:', functionError.message)
        allSystemsHealthy = false
      } else {
        console.log('✅ Database functions working')
      }
    } else {
      console.log('⚠️  No test data available - skipping some checks')
    }

    // 4. Check required tables
    console.log('\n📊 Checking required tables...')
    
    const requiredTables = ['notes', 'processing_errors', 'rate_limits']
    for (const table of requiredTables) {
      try {
        const { error } = await supabase
          .from(table)
          .select('id')
          .limit(1)
        
        if (error) {
          console.log(`❌ Table '${table}' not accessible:`, error.message)
          allSystemsHealthy = false
        } else {
          console.log(`✅ Table '${table}' accessible`)
        }
      } catch (error) {
        console.log(`❌ Table '${table}' check failed:`, error)
        allSystemsHealthy = false
      }
    }

  } catch (error) {
    console.error('❌ Health check failed:', error)
    allSystemsHealthy = false
  }

  // Summary
  console.log('\n📊 HEALTH CHECK SUMMARY')
  console.log('=======================')
  
  if (allSystemsHealthy) {
    console.log('✅ ALL SYSTEMS HEALTHY')
    console.log('✅ Database is ready for production use')
    console.log('✅ Error tracking features are working')
    console.log('✅ Processing service can operate normally')
  } else {
    console.log('❌ HEALTH ISSUES DETECTED')
    console.log('❌ Some systems may not work correctly')
    console.log('❌ Review the errors above and take action')
  }

  return allSystemsHealthy
}

async function main() {
  const isHealthy = await healthCheck()
  
  if (!isHealthy) {
    console.log('\n🚨 RECOMMENDED ACTIONS:')
    console.log('1. Check database connection and credentials')
    console.log('2. Verify error tracking migration is applied')
    console.log('3. Run detailed verification: npx tsx scripts/verify-migration-detailed.ts')
    console.log('4. Check environment variables and configuration')
    process.exit(1)
  } else {
    console.log('\n🎉 System is healthy and ready for use!')
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error during health check:', error)
    process.exit(1)
  })
} 