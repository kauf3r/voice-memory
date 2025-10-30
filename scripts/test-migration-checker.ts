#!/usr/bin/env tsx

import * as dotenv from 'dotenv'
import path from 'path'
import { hasErrorTracking, logMigrationStatus, checkErrorTrackingMigration } from '../lib/migration-checker'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

async function testMigrationChecker() {
  console.log('🧪 Testing Migration Checker')
  console.log('============================\n')

  try {
    // Test simple boolean check
    console.log('1. Testing hasErrorTracking()...')
    const hasTracking = await hasErrorTracking()
    console.log(`   Result: ${hasTracking ? '✅ YES' : '❌ NO'}`)

    // Test detailed check
    console.log('\n2. Testing checkErrorTrackingMigration()...')
    const detailedResult = await checkErrorTrackingMigration()
    console.log('   Detailed result:', {
      isApplied: detailedResult.isApplied,
      hasErrorTracking: detailedResult.hasErrorTracking,
      hasProcessingErrors: detailedResult.hasProcessingErrors,
      hasRateLimits: detailedResult.hasRateLimits,
      hasFunctions: detailedResult.hasFunctions,
      errorCount: detailedResult.errors.length
    })

    if (detailedResult.errors.length > 0) {
      console.log('   Errors:', detailedResult.errors)
    }

    // Test logging function
    console.log('\n3. Testing logMigrationStatus()...')
    await logMigrationStatus()

    console.log('\n✅ Migration checker test completed successfully!')

  } catch (error) {
    console.error('❌ Migration checker test failed:', error)
    process.exit(1)
  }
}

testMigrationChecker() 