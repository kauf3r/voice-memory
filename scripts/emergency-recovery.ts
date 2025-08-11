#!/usr/bin/env node
/**
 * Emergency recovery script to fix stuck processing jobs and connection issues
 */

import { config } from 'dotenv'
import { createServiceClient } from '../lib/supabase-server'
import { ProcessingQueueRecoveryService } from '../lib/processing/ProcessingQueueRecoveryService'

// Load environment variables
config({ path: '.env.local' })

async function emergencyRecovery() {
  console.log('🚨 Running Emergency Recovery...\n')
  
  try {
    const client = createServiceClient()
    const recoveryService = new ProcessingQueueRecoveryService(client)
    
    // Step 1: Get current system status
    console.log('1️⃣ Checking system status...')
    const stats = await recoveryService.getRecoveryStats()
    console.log(`   📊 Stuck jobs: ${stats.totalStuckJobs}`)
    console.log(`   📊 Failed jobs: ${stats.totalFailedJobs}`)
    console.log(`   📊 Recoverable jobs: ${stats.recoverableJobs}`)
    console.log(`   📊 Average attempts: ${stats.averageAttempts.toFixed(1)}`)
    
    if (stats.totalFailedJobs === 0) {
      console.log('✅ No failed jobs found - checking for processing locks...')
      
      // Try to find stuck processing locks manually
      const { data: stuckNotes, error } = await client
        .from('voice_notes')
        .select('id, status, processing_lock_timestamp, audio_file_url, error_message')
        .eq('status', 'processing')
      
      if (error) {
        console.log(`⚠️ Could not check for stuck notes: ${error.message}`)
      } else if (stuckNotes && stuckNotes.length > 0) {
        console.log(`📋 Found ${stuckNotes.length} notes in processing state`)
        
        // Check if any are truly stuck (older than 30 minutes)
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
        const stuckCount = stuckNotes.filter(note => 
          note.processing_lock_timestamp && note.processing_lock_timestamp < thirtyMinutesAgo
        ).length
        
        if (stuckCount > 0) {
          console.log(`🔧 Found ${stuckCount} truly stuck jobs, running recovery...`)
          const result = await recoveryService.recoverProcessingQueue()
          console.log(`   ✅ Recovery result: ${result.recoveredJobs} recovered, ${result.failedJobs} failed`)
        }
      } else {
        console.log('✅ No stuck processing jobs found')
      }
    } else {
      // Run full recovery
      console.log('\n2️⃣ Running recovery process...')
      const result = await recoveryService.recoverProcessingQueue()
      
      console.log(`📋 Recovery completed:`)
      console.log(`   ✅ Recovered: ${result.recoveredJobs}`)
      console.log(`   ❌ Failed: ${result.failedJobs}`)
      console.log(`   ⏭️ Skipped: ${result.skippedJobs}`)
      
      if (result.errors.length > 0) {
        console.log('\n⚠️ Recovery errors:')
        result.errors.forEach(error => console.log(`   • ${error}`))
      }
    }
    
    // Step 3: Check for specific M4A/MP4 issues
    console.log('\n3️⃣ Checking for M4A/MP4 specific issues...')
    
    const { data: m4aFailed, error: m4aError } = await client
      .from('voice_notes')
      .select('id, error_message, audio_file_url')
      .in('status', ['transcription_failed', 'failed'])
      .ilike('error_message', '%M4A%')
      .limit(10)
    
    if (m4aError) {
      console.log(`⚠️ Could not check M4A errors: ${m4aError.message}`)
    } else if (m4aFailed && m4aFailed.length > 0) {
      console.log(`🎵 Found ${m4aFailed.length} M4A/MP4 related failures`)
      
      // Try to reset these for retry with our improved processing
      for (const note of m4aFailed) {
        console.log(`   🔄 Resetting note ${note.id} for retry with enhanced format support`)
        
        const { error: resetError } = await client
          .from('voice_notes')
          .update({
            status: 'pending',
            processing_attempts: 0,
            processing_lock_timestamp: null,
            error_message: 'Retrying with enhanced M4A/MP4 format support'
          })
          .eq('id', note.id)
        
        if (resetError) {
          console.log(`   ❌ Failed to reset ${note.id}: ${resetError.message}`)
        } else {
          console.log(`   ✅ Reset ${note.id} for retry`)
        }
      }
    } else {
      console.log('✅ No M4A/MP4 specific issues found')
    }
    
    // Step 4: Summary
    console.log('\n🎉 Emergency recovery completed!')
    console.log('\n💡 Next steps:')
    console.log('   • Monitor the application for new processing attempts')
    console.log('   • Check if WebSocket connection issues persist')
    console.log('   • M4A/MP4 files should now use enhanced format support')
    
  } catch (error) {
    console.error('❌ Emergency recovery failed:', error)
    process.exit(1)
  }
}

// Run the recovery
emergencyRecovery().catch(console.error)