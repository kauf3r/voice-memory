#!/usr/bin/env node
/**
 * Test script for Processing Queue Recovery Service
 */

import { config } from 'dotenv'
import { createServiceClient } from '../lib/supabase-server'
import { ProcessingQueueRecoveryService } from '../lib/processing/ProcessingQueueRecoveryService'

// Load environment variables
config({ path: '.env.local' })

async function testQueueRecovery() {
  console.log('🧪 Testing Processing Queue Recovery Service...\n')
  
  try {
    // Create service client
    const client = createServiceClient()
    const recoveryService = new ProcessingQueueRecoveryService(client)
    
    // Test 1: Get recovery statistics
    console.log('1️⃣ Getting recovery statistics...')
    const stats = await recoveryService.getRecoveryStats()
    console.log('📊 Recovery Stats:')
    console.log(`   Total stuck jobs: ${stats.totalStuckJobs}`)
    console.log(`   Total failed jobs: ${stats.totalFailedJobs}`)
    console.log(`   Recoverable jobs: ${stats.recoverableJobs}`)
    console.log(`   Average attempts: ${stats.averageAttempts.toFixed(1)}`)
    
    if (stats.totalFailedJobs === 0) {
      console.log('✅ No jobs require recovery - system is healthy!')
      return
    }
    
    // Test 2: Perform recovery
    console.log('\n2️⃣ Performing queue recovery...')
    const recoveryResult = await recoveryService.recoverProcessingQueue()
    
    console.log('\n📋 Recovery Results:')
    console.log(`   Success: ${recoveryResult.success}`)
    console.log(`   Recovered: ${recoveryResult.recoveredJobs}`)
    console.log(`   Failed: ${recoveryResult.failedJobs}`)
    console.log(`   Skipped: ${recoveryResult.skippedJobs}`)
    
    if (recoveryResult.errors.length > 0) {
      console.log('\n❌ Recovery Errors:')
      recoveryResult.errors.forEach(error => console.log(`   • ${error}`))
    }
    
    if (recoveryResult.details.length > 0) {
      console.log('\n📝 Job Details:')
      recoveryResult.details.forEach(detail => {
        const icon = detail.action === 'recovered' ? '✅' : 
                    detail.action === 'failed' ? '❌' : '⏭️'
        console.log(`   ${icon} ${detail.noteId}: ${detail.action} - ${detail.reason}`)
      })
    }
    
    // Test 3: Verify recovery effectiveness
    if (recoveryResult.recoveredJobs > 0) {
      console.log('\n3️⃣ Verifying recovery effectiveness...')
      await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds
      
      const newStats = await recoveryService.getRecoveryStats()
      const improvement = stats.totalFailedJobs - newStats.totalFailedJobs
      
      console.log('📈 Post-Recovery Stats:')
      console.log(`   Jobs resolved: ${improvement}`)
      console.log(`   Remaining failed jobs: ${newStats.totalFailedJobs}`)
      console.log(`   Recovery effectiveness: ${improvement > 0 ? 'Positive' : 'No change'}`)
    }
    
    console.log('\n🎉 Queue recovery test completed!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Run the test
testQueueRecovery().catch(console.error)