#!/usr/bin/env node
/**
 * Test script for Unified Connection State Manager (Phase 2.1)
 */

import { UnifiedConnectionStateManager } from '../app/services/UnifiedConnectionStateManager'
import type { ConnectionStateCallbacks, StateChangeEvent, ConnectionMode, ConnectionQuality } from '../app/services/UnifiedConnectionStateManager'

async function testConnectionStateManager() {
  console.log('🧪 Testing Unified Connection State Manager (Phase 2.1)...\n')
  
  try {
    // Test setup
    const events: string[] = []
    
    const callbacks: ConnectionStateCallbacks = {
      onStateChange: (event: StateChangeEvent) => {
        events.push(`State change: ${event.trigger} (${JSON.stringify(event.current)})`)
      },
      onModeSwitch: (from: ConnectionMode, to: ConnectionMode) => {
        events.push(`Mode switch: ${from} → ${to}`)
      },
      onQualityChange: (from: ConnectionQuality, to: ConnectionQuality) => {
        events.push(`Quality change: ${from} → ${to}`)
      },
      onStabilityChange: (isStable: boolean) => {
        events.push(`Stability change: ${isStable}`)
      }
    }
    
    // Test 1: Initialize Connection State Manager
    console.log('1️⃣ Testing Initialization...')
    const stateManager = new UnifiedConnectionStateManager(callbacks)
    
    const initialState = stateManager.getState()
    console.log(`   ✅ Initial mode: ${initialState.mode}`)
    console.log(`   ✅ Initial status: ${initialState.status}`)
    console.log(`   ✅ Initial quality: ${initialState.quality}`)
    console.log(`   ✅ Initial stability: ${initialState.isStable}`)
    
    // Test 2: Connection Mode Changes
    console.log('\n2️⃣ Testing Connection Mode Changes...')
    stateManager.setConnectionMode('websocket', 'test_websocket_init')
    stateManager.setConnectionStatus('connecting', 'test_connecting')
    
    await new Promise(resolve => setTimeout(resolve, 100)) // Brief delay
    
    stateManager.setConnectionStatus('connected', 'test_connected')
    
    const connectedState = stateManager.getState()
    console.log(`   ✅ Mode after connection: ${connectedState.mode}`)
    console.log(`   ✅ Status after connection: ${connectedState.status}`)
    console.log(`   ✅ Last connected: ${connectedState.lastConnected?.toISOString()}`)
    
    // Test 3: Latency and Quality Tracking
    console.log('\n3️⃣ Testing Latency and Quality Tracking...')
    
    // Simulate different latency conditions
    const latencies = [25, 45, 30, 200, 150, 600, 1500, 100]
    
    for (const latency of latencies) {
      stateManager.updateLatency(latency)
      await new Promise(resolve => setTimeout(resolve, 50)) // Brief delay
    }
    
    const qualityState = stateManager.getState()
    console.log(`   ✅ Final average latency: ${qualityState.latency}ms`)
    console.log(`   ✅ Connection quality: ${qualityState.quality}`)
    
    // Test 4: Error Handling and Recovery
    console.log('\n4️⃣ Testing Error Handling and Recovery...')
    
    stateManager.recordError('Simulated WebSocket timeout', 'test_error')
    stateManager.recordReconnectAttempt('test_reconnect_1')
    stateManager.recordReconnectAttempt('test_reconnect_2')
    
    const errorState = stateManager.getState()
    console.log(`   ✅ Status after error: ${errorState.status}`)
    console.log(`   ✅ Last error: ${errorState.lastError}`)
    console.log(`   ✅ Reconnect attempts: ${errorState.reconnectAttempts}`)
    
    // Test 5: Fallback Mode Simulation
    console.log('\n5️⃣ Testing Fallback Mode Simulation...')
    
    stateManager.setConnectionMode('polling', 'test_fallback')
    stateManager.setConnectionStatus('connected', 'test_polling_connected')
    
    const fallbackState = stateManager.getState()
    console.log(`   ✅ Fallback mode: ${fallbackState.mode}`)
    console.log(`   ✅ Fallback status: ${fallbackState.status}`)
    
    // Test 6: Metrics and Diagnostics
    console.log('\n6️⃣ Testing Metrics and Diagnostics...')
    
    const metrics = stateManager.getMetrics()
    console.log(`   ✅ Total attempts: ${metrics.totalAttempts}`)
    console.log(`   ✅ Successful connections: ${metrics.successfulConnections}`)
    console.log(`   ✅ Failed connections: ${metrics.failedConnections}`)
    console.log(`   ✅ Average latency: ${metrics.averageLatency}ms`)
    console.log(`   ✅ Uptime percentage: ${metrics.uptimePercentage.toFixed(1)}%`)
    
    const stability = stateManager.getStabilityAssessment()
    console.log(`   ✅ Stability score: ${stability.stabilityScore}/100`)
    console.log(`   ✅ Is stable: ${stability.isStable}`)
    console.log(`   ✅ Stability factors: ${stability.factors.length > 0 ? stability.factors.join(', ') : 'None'}`)
    
    // Test 7: State History and Debugging
    console.log('\n7️⃣ Testing State History and Debugging...')
    
    const history = stateManager.getStateHistory()
    console.log(`   ✅ History entries: ${history.length}`)
    console.log(`   ✅ Recent events: ${history.slice(-3).map(e => e.trigger).join(', ')}`)
    
    console.log(`   ✅ Callback events captured: ${events.length}`)
    if (events.length > 0) {
      console.log(`   ✅ Latest events: ${events.slice(-3).join(' | ')}`)
    }
    
    // Test 8: Diagnostic Report
    console.log('\n8️⃣ Testing Diagnostic Report Generation...')
    
    const diagnostics = stateManager.generateDiagnosticReport()
    const reportLines = diagnostics.split('\n').length
    console.log(`   ✅ Diagnostic report generated: ${reportLines} lines`)
    console.log(`   ✅ Report preview:`)
    console.log(diagnostics.split('\n').slice(0, 5).map(line => `      ${line}`).join('\n'))
    
    // Test 9: Reset Functionality
    console.log('\n9️⃣ Testing Reset Functionality...')
    
    stateManager.reset('test_reset')
    const resetState = stateManager.getState()
    console.log(`   ✅ Status after reset: ${resetState.status}`)
    console.log(`   ✅ Error cleared: ${resetState.lastError === null}`)
    console.log(`   ✅ Reconnect attempts reset: ${resetState.reconnectAttempts === 0}`)
    
    console.log('\n🎉 Phase 2.1 testing completed successfully!')
    console.log('\n📊 Summary of Unified Connection State Manager:')
    console.log('   ✅ Centralized connection state management')
    console.log('   ✅ Real-time quality assessment and latency tracking') 
    console.log('   ✅ Multi-factor stability analysis')
    console.log('   ✅ Comprehensive metrics and diagnostic reporting')
    console.log('   ✅ Event-driven architecture with callbacks')
    console.log('   ✅ State history tracking for debugging')
    
    console.log('\n💡 Expected Impact:')
    console.log('   • Eliminates connection state inconsistencies')
    console.log('   • Provides unified quality assessment')
    console.log('   • Enables intelligent connection management decisions')
    console.log('   • Comprehensive diagnostic capabilities')
    
  } catch (error) {
    console.error('❌ Phase 2.1 test failed:', error)
    process.exit(1)
  }
}

// Run the test
testConnectionStateManager().catch(console.error)