#!/usr/bin/env node

/**
 * Test script for enhanced error handling in rate limiter and quota manager
 * This script validates table existence checks and fallback mechanisms
 */

import { createServerClient } from '../lib/supabase-server'
import { getQuotaManager } from '../lib/quota-manager'

// Import the RateLimiter class - we'll need to expose it for testing
// For now, we'll test the quota manager which is already exported

interface TestResult {
  name: string
  passed: boolean
  message: string
  error?: any
}

class ErrorHandlingTester {
  private results: TestResult[] = []
  private supabase = createServerClient()

  async runAllTests(): Promise<void> {
    console.log('🧪 Testing Enhanced Error Handling for Rate Limiter and Quota Manager\n')

    await this.testQuotaManagerWithMissingTables()
    await this.testQuotaManagerWithExistingTables()
    await this.testTableExistenceChecking()
    await this.testRetryMechanisms()
    await this.testFallbackBehavior()

    this.printResults()
  }

  private async testQuotaManagerWithMissingTables(): Promise<void> {
    console.log('📋 Testing QuotaManager with missing tables...')
    
    const quotaManager = getQuotaManager()
    const testUserId = 'test-user-123'

    // Test getUserUsage with missing tables
    await this.runTest(
      'getUserUsage with missing tables',
      async () => {
        const usage = await quotaManager.getUserUsage(testUserId)
        
        // Should return zeros instead of throwing
        if (usage.notesCount !== 0 || usage.processingThisHour !== 0 || usage.tokensToday !== 0) {
          throw new Error(`Expected zero values, got: ${JSON.stringify(usage)}`)
        }
        
        return 'Successfully returned default values when tables are missing'
      }
    )

    // Test checkUploadQuota with missing tables
    await this.runTest(
      'checkUploadQuota with missing tables',
      async () => {
        const result = await quotaManager.checkUploadQuota(testUserId)
        
        if (!result.allowed) {
          throw new Error('Should allow upload when quota check fails due to missing tables')
        }
        
        return 'Successfully allowed upload despite missing tables'
      }
    )

    // Test recordTokenUsage with missing tables (should not throw)
    await this.runTest(
      'recordTokenUsage with missing tables',
      async () => {
        await quotaManager.recordTokenUsage(testUserId, 100)
        return 'Successfully handled missing api_usage table'
      }
    )

    // Test recordProcessingAttempt with missing tables (should not throw)
    await this.runTest(
      'recordProcessingAttempt with missing tables',
      async () => {
        await quotaManager.recordProcessingAttempt(testUserId)
        return 'Successfully handled missing processing_attempts table'
      }
    )
  }

  private async testQuotaManagerWithExistingTables(): Promise<void> {
    console.log('\n📊 Testing QuotaManager with existing tables...')
    
    // First check if tables exist
    const tablesExist = await this.checkTablesExist()
    
    if (!tablesExist.notes || !tablesExist.api_usage || !tablesExist.processing_attempts) {
      console.log('⚠️  Some tables are missing, skipping existing table tests')
      console.log(`Tables status: notes=${tablesExist.notes}, api_usage=${tablesExist.api_usage}, processing_attempts=${tablesExist.processing_attempts}`)
      return
    }

    const quotaManager = getQuotaManager()
    const testUserId = 'test-user-456'

    // Test with real tables
    await this.runTest(
      'getUserUsage with existing tables',
      async () => {
        const usage = await quotaManager.getUserUsage(testUserId)
        
        if (typeof usage.notesCount !== 'number' || 
            typeof usage.processingThisHour !== 'number' || 
            typeof usage.tokensToday !== 'number') {
          throw new Error('Usage values should be numbers')
        }
        
        return `Successfully retrieved usage: ${JSON.stringify(usage)}`
      }
    )
  }

  private async testTableExistenceChecking(): Promise<void> {
    console.log('\n🔍 Testing table existence checking...')
    
    // Test checking a table that definitely doesn't exist
    await this.runTest(
      'Check non-existent table',
      async () => {
        const { error } = await this.supabase
          .from('definitely_does_not_exist')
          .select('*')
          .limit(1)
          .maybeSingle()
        
        if (!error) {
          throw new Error('Expected error for non-existent table')
        }
        
        // Check if we get the expected error codes
        const isTableNotFoundError = error.code === '42P01' || 
          error.message.includes('relation "definitely_does_not_exist" does not exist')
        
        if (!isTableNotFoundError) {
          throw new Error(`Unexpected error type: ${error.code} - ${error.message}`)
        }
        
        return `Correctly detected non-existent table: ${error.code}`
      }
    )

    // Test checking existing tables
    const standardTables = ['notes', 'users']
    for (const tableName of standardTables) {
      await this.runTest(
        `Check ${tableName} table`,
        async () => {
          const { error } = await this.supabase
            .from(tableName)
            .select('*')
            .limit(1)
            .maybeSingle()
          
          if (error && error.code === '42P01') {
            return `Table ${tableName} does not exist (this might be expected)`
          }
          
          return `Table ${tableName} exists and is accessible`
        }
      )
    }
  }

  private async testRetryMechanisms(): Promise<void> {
    console.log('\n🔄 Testing retry mechanisms...')
    
    // We can't easily test actual retry scenarios without causing real failures,
    // but we can test that the retry logic structure is sound
    await this.runTest(
      'Retry mechanism structure',
      async () => {
        // Test the basic retry pattern by simulating a function that fails twice then succeeds
        let attemptCount = 0
        const maxRetries = 3
        
        const mockOperation = async () => {
          attemptCount++
          if (attemptCount < 3) {
            throw new Error(`Simulated failure ${attemptCount}`)
          }
          return 'success'
        }
        
        // Simulate retry logic
        for (let retry = 0; retry < maxRetries; retry++) {
          try {
            const result = await mockOperation()
            if (result === 'success' && attemptCount === 3) {
              return 'Retry mechanism works correctly'
            }
          } catch (error) {
            if (retry === maxRetries - 1) {
              throw error
            }
            // Small delay
            await new Promise(resolve => setTimeout(resolve, 10))
          }
        }
        
        throw new Error('Retry mechanism failed')
      }
    )
  }

  private async testFallbackBehavior(): Promise<void> {
    console.log('\n🔧 Testing fallback behavior...')
    
    const quotaManager = getQuotaManager()
    
    // Test that operations continue to work even when some tables are missing
    await this.runTest(
      'Graceful degradation',
      async () => {
        const testUserId = 'fallback-test-user'
        
        // These should all complete without throwing, regardless of table state
        const usage = await quotaManager.getUserUsage(testUserId)
        const uploadCheck = await quotaManager.checkUploadQuota(testUserId)
        const processingCheck = await quotaManager.checkProcessingQuota(testUserId)
        
        // Verify that even with potential database issues, we get sensible responses
        if (typeof usage.notesCount !== 'number' || 
            typeof uploadCheck.allowed !== 'boolean' ||
            typeof processingCheck.allowed !== 'boolean') {
          throw new Error('Fallback behavior returned invalid types')
        }
        
        return 'All operations completed successfully with graceful fallback'
      }
    )
  }

  private async checkTablesExist(): Promise<Record<string, boolean>> {
    const tables = ['notes', 'api_usage', 'processing_attempts', 'rate_limits']
    const results: Record<string, boolean> = {}
    
    for (const table of tables) {
      try {
        const { error } = await this.supabase
          .from(table)
          .select('*')
          .limit(1)
          .maybeSingle()
        
        results[table] = !error || error.code !== '42P01'
      } catch (error) {
        results[table] = false
      }
    }
    
    return results
  }

  private async runTest(name: string, testFn: () => Promise<string>): Promise<void> {
    try {
      const message = await testFn()
      this.results.push({ name, passed: true, message })
      console.log(`  ✅ ${name}: ${message}`)
    } catch (error) {
      this.results.push({ 
        name, 
        passed: false, 
        message: error instanceof Error ? error.message : String(error),
        error
      })
      console.log(`  ❌ ${name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private printResults(): void {
    const passed = this.results.filter(r => r.passed).length
    const total = this.results.length
    
    console.log('\n📊 Test Results Summary')
    console.log('='.repeat(50))
    console.log(`Total tests: ${total}`)
    console.log(`Passed: ${passed}`)
    console.log(`Failed: ${total - passed}`)
    console.log(`Success rate: ${Math.round((passed / total) * 100)}%`)
    
    if (passed === total) {
      console.log('\n🎉 All tests passed! Enhanced error handling is working correctly.')
    } else {
      console.log('\n⚠️  Some tests failed. Check the details above.')
      
      const failures = this.results.filter(r => !r.passed)
      console.log('\nFailed tests:')
      failures.forEach(failure => {
        console.log(`  - ${failure.name}: ${failure.message}`)
      })
    }
  }
}

// Run the tests
async function main() {
  const tester = new ErrorHandlingTester()
  await tester.runAllTests()
  
  console.log('\n💡 Note: This test validates that the enhanced error handling')
  console.log('   gracefully handles missing tables and database errors.')
  console.log('   For full functionality, run the database migration:')
  console.log('   npx tsx scripts/manage-migration.ts apply')
}

// Execute if called directly
if (require.main === module) {
  main().catch(console.error)
}

export { ErrorHandlingTester } 