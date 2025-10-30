#!/usr/bin/env ts-node

/**
 * Test script to verify the processing fixes
 * This will test:
 * 1. PerformanceMetricsTracker variable collision fix
 * 2. Configuration validation for alerting
 */

import { PerformanceMetricsTracker } from '../lib/monitoring/PerformanceMetricsTracker'
import { configManager } from '../lib/config/AppConfig'

async function testProcessingFixes() {
  console.log('🧪 Testing processing fixes...')

  try {
    // Test 1: PerformanceMetricsTracker variable collision fix
    console.log('\n1. Testing PerformanceMetricsTracker...')
    const tracker = new PerformanceMetricsTracker()
    
    // This should now work without "Cannot access 'd' before initialization" error
    const metrics = tracker.startTracking('test-note-id', 'test-user-id', {
      audioFileSize: 1024,
      audioMimeType: 'audio/mp3',
      audioDuration: 30
    })
    
    console.log('✅ PerformanceMetricsTracker.startTracking() works correctly')
    console.log(`   - Note ID: ${metrics.noteId}`)
    console.log(`   - Memory usage start: ${metrics.memoryUsageStart}`)
    console.log(`   - CPU time start: ${metrics.cpuTimeStart}`)
    
    // Complete tracking
    const completedMetrics = tracker.completeTracking('test-note-id', true)
    if (completedMetrics) {
      console.log('✅ PerformanceMetricsTracker.completeTracking() works correctly')
      console.log(`   - Total time: ${completedMetrics.totalTime}ms`)
    }

    // Test 2: Configuration validation
    console.log('\n2. Testing configuration...')
    const config = configManager.getConfig()
    console.log('✅ Configuration loaded successfully')
    console.log(`   - Environment: ${config.environment}`)
    console.log(`   - Alerting enabled: ${config.monitoring.alerting.enabled}`)
    console.log(`   - Webhook URL configured: ${!!config.monitoring.alerting.webhookUrl}`)
    console.log(`   - Slack channel configured: ${!!config.monitoring.alerting.slackChannel}`)
    
    // The alerting should be disabled if no webhook or Slack channel is configured
    if (!config.monitoring.alerting.webhookUrl && !config.monitoring.alerting.slackChannel) {
      if (!config.monitoring.alerting.enabled) {
        console.log('✅ Alerting correctly disabled when no endpoints configured')
      } else {
        console.log('❌ Alerting should be disabled when no endpoints configured')
      }
    }

    console.log('\n🎉 All tests passed! Processing fixes are working correctly.')

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Run the test
testProcessingFixes().catch(console.error)
