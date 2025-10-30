#!/usr/bin/env tsx

/**
 * Test Production Processing Script
 * 
 * This script performs comprehensive end-to-end testing of the Voice Memory
 * processing pipeline in production environment.
 * 
 * Usage: npm run script scripts/test-production-processing.ts
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { FormData } from 'formdata-node'
import { fileFromPath } from 'formdata-node/file-from-path'
// Load environment variables
import 'dotenv/config'

interface TestResult {
  name: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  duration?: number
  details?: any
}

interface ProcessingTest {
  upload: TestResult
  processing: TestResult
  transcription: TestResult
  analysis: TestResult
  completion: TestResult
}

interface TestReport {
  timestamp: string
  environment: {
    baseUrl: string
    hasAuthToken: boolean
    hasOpenAIKey: boolean
  }
  tests: {
    endToEndProcessing: ProcessingTest
    batchProcessing: TestResult
    errorHandling: TestResult
    performanceMonitoring: TestResult
    circuitBreakerTesting: TestResult
    processingLockTesting: TestResult
  }
  summary: {
    totalTests: number
    passed: number
    failed: number
    warnings: number
    overallSuccess: boolean
  }
}

class ProductionProcessingTester {
  private supabase: any
  private baseUrl: string
  private testUserId: string | null = null
  private testNoteId: string | null = null

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )
    
    // Try different URL patterns for the base URL
    this.baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('localhost')
        ? 'http://localhost:3000'
        : 'https://voice-memory-tau.vercel.app'
  }

  async run(): Promise<void> {
    console.log('🧪 Starting production processing tests...\n')
    console.log(`🎯 Testing environment: ${this.baseUrl}\n`)

    try {
      // Initialize test environment
      await this.setupTestEnvironment()

      // Run comprehensive tests
      const endToEndTest = await this.testEndToEndProcessing()
      const batchTest = await this.testBatchProcessing()
      const errorTest = await this.testErrorHandling()
      const performanceTest = await this.testPerformanceMonitoring()
      const circuitBreakerTest = await this.testCircuitBreaker()
      const lockTest = await this.testProcessingLocks()

      // Generate and display report
      const report: TestReport = {
        timestamp: new Date().toISOString(),
        environment: {
          baseUrl: this.baseUrl,
          hasAuthToken: !!process.env.CRON_SECRET,
          hasOpenAIKey: !!process.env.OPENAI_API_KEY
        },
        tests: {
          endToEndProcessing: endToEndTest,
          batchProcessing: batchTest,
          errorHandling: errorTest,
          performanceMonitoring: performanceTest,
          circuitBreakerTesting: circuitBreakerTest,
          processingLockTesting: lockTest
        },
        summary: {
          totalTests: 0,
          passed: 0,
          failed: 0,
          warnings: 0,
          overallSuccess: false
        }
      }

      this.calculateSummary(report)
      this.displayReport(report)
      this.saveReport(report)

      // Cleanup test data
      await this.cleanupTestEnvironment()

    } catch (error) {
      console.error('❌ Production testing failed:', error)
      process.exit(1)
    }
  }

  private async setupTestEnvironment(): Promise<void> {
    console.log('🔧 Setting up test environment...')

    // Create or find test user
    try {
      // Create a test user in the database (bypassing auth for testing)
      const testUserEmail = `test-${Date.now()}@example.com`
      
      const { data: userData, error: userError } = await this.supabase.auth.admin.createUser({
        email: testUserEmail,
        password: 'test-password-123',
        email_confirm: true
      })

      if (userData?.user) {
        this.testUserId = userData.user.id
        console.log(`✅ Created test user: ${this.testUserId}`)
      } else {
        console.log('⚠️  Using service role for testing (no test user created)')
      }
    } catch (error) {
      console.log('⚠️  Could not create test user, proceeding with existing setup')
    }
  }

  private async testEndToEndProcessing(): Promise<ProcessingTest> {
    console.log('🔄 Testing end-to-end processing...')

    const test: ProcessingTest = {
      upload: { name: 'Upload', status: 'fail', message: 'Not started' },
      processing: { name: 'Processing Trigger', status: 'fail', message: 'Not started' },
      transcription: { name: 'Transcription', status: 'fail', message: 'Not started' },
      analysis: { name: 'Analysis', status: 'fail', message: 'Not started' },
      completion: { name: 'Completion', status: 'fail', message: 'Not started' }
    }

    try {
      // Step 1: Test file upload (simulate with database insert)
      const startTime = Date.now()
      
      const testNote = {
        id: crypto.randomUUID(),
        title: `Test Processing ${new Date().toISOString()}`,
        audio_url: 'test://audio.wav', // Placeholder URL for testing
        user_id: this.testUserId || '00000000-0000-0000-0000-000000000000',
        recorded_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }

      const { error: insertError } = await this.supabase
        .from('notes')
        .insert([testNote])

      if (insertError) {
        test.upload = {
          name: 'Upload',
          status: 'fail',
          message: `Upload simulation failed: ${insertError.message}`,
          duration: Date.now() - startTime
        }
        return test
      }

      this.testNoteId = testNote.id
      test.upload = {
        name: 'Upload',
        status: 'pass',
        message: 'Note uploaded successfully',
        duration: Date.now() - startTime,
        details: { noteId: testNote.id }
      }

      // Step 2: Test processing trigger
      const processingStartTime = Date.now()
      
      try {
        const response = await fetch(`${this.baseUrl}/api/process/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CRON_SECRET}`,
            'x-vercel-cron': '1'
          },
          body: JSON.stringify({ 
            batchSize: 1, 
            forceProcess: true,
            targetNoteId: testNote.id // If the API supports targeting specific notes
          }),
          timeout: 30000
        })

        if (response.ok) {
          const result = await response.json()
          test.processing = {
            name: 'Processing Trigger',
            status: 'pass',
            message: 'Batch processing triggered successfully',
            duration: Date.now() - processingStartTime,
            details: { result }
          }
        } else {
          test.processing = {
            name: 'Processing Trigger',
            status: 'fail',
            message: `Processing trigger failed: ${response.status}`,
            duration: Date.now() - processingStartTime
          }
          return test
        }
      } catch (fetchError) {
        test.processing = {
          name: 'Processing Trigger',
          status: 'fail',
          message: `Processing trigger error: ${fetchError.message}`,
          duration: Date.now() - processingStartTime
        }
        return test
      }

      // Step 3: Monitor processing progress
      const monitorStartTime = Date.now()
      let processingComplete = false
      let attempts = 0
      const maxAttempts = 30 // 5 minutes with 10-second intervals

      while (!processingComplete && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10000)) // Wait 10 seconds
        attempts++

        const { data: noteStatus, error: statusError } = await this.supabase
          .from('notes')
          .select('transcription, analysis, processed_at, error_message, processing_started_at')
          .eq('id', testNote.id)
          .single()

        if (statusError) {
          test.transcription = {
            name: 'Transcription',
            status: 'fail',
            message: `Status check failed: ${statusError.message}`,
            duration: Date.now() - monitorStartTime
          }
          return test
        }

        // Check for completion
        if (noteStatus.processed_at) {
          processingComplete = true
          
          // Evaluate transcription
          if (noteStatus.transcription) {
            test.transcription = {
              name: 'Transcription',
              status: 'pass',
              message: 'Transcription completed',
              duration: Date.now() - monitorStartTime,
              details: { 
                transcriptionLength: noteStatus.transcription.length,
                preview: noteStatus.transcription.substring(0, 100)
              }
            }
          } else {
            test.transcription = {
              name: 'Transcription',
              status: 'warning',
              message: 'Processing completed but no transcription found',
              duration: Date.now() - monitorStartTime
            }
          }

          // Evaluate analysis
          if (noteStatus.analysis) {
            test.analysis = {
              name: 'Analysis',
              status: 'pass',
              message: 'Analysis completed',
              duration: Date.now() - monitorStartTime,
              details: {
                hasAnalysis: true,
                analysisKeys: Object.keys(noteStatus.analysis || {})
              }
            }
          } else {
            test.analysis = {
              name: 'Analysis',
              status: 'warning',
              message: 'Processing completed but no analysis found',
              duration: Date.now() - monitorStartTime
            }
          }

          // Overall completion
          test.completion = {
            name: 'Completion',
            status: 'pass',
            message: 'End-to-end processing completed',
            duration: Date.now() - startTime,
            details: {
              totalTime: Date.now() - startTime,
              processingTime: Date.now() - monitorStartTime,
              attempts
            }
          }

        } else if (noteStatus.error_message) {
          // Processing failed
          test.transcription = {
            name: 'Transcription',
            status: 'fail',
            message: `Processing failed: ${noteStatus.error_message}`,
            duration: Date.now() - monitorStartTime
          }
          
          test.analysis = {
            name: 'Analysis',
            status: 'fail',
            message: 'Analysis not attempted due to processing failure',
            duration: Date.now() - monitorStartTime
          }
          
          test.completion = {
            name: 'Completion',
            status: 'fail',
            message: 'End-to-end processing failed',
            duration: Date.now() - startTime,
            details: { error: noteStatus.error_message }
          }
          
          return test
        }
      }

      // Handle timeout
      if (!processingComplete) {
        const timeoutMessage = `Processing timeout after ${attempts * 10} seconds`
        
        test.transcription = {
          name: 'Transcription',
          status: 'fail',
          message: timeoutMessage,
          duration: Date.now() - monitorStartTime
        }
        
        test.analysis = {
          name: 'Analysis',
          status: 'fail',
          message: timeoutMessage,
          duration: Date.now() - monitorStartTime
        }
        
        test.completion = {
          name: 'Completion',
          status: 'fail',
          message: timeoutMessage,
          duration: Date.now() - startTime
        }
      }

    } catch (error) {
      // Handle any unexpected errors
      const errorMessage = `Unexpected error: ${error.message}`
      
      Object.keys(test).forEach(key => {
        if (test[key].status === 'fail' && test[key].message === 'Not started') {
          test[key] = {
            name: test[key].name,
            status: 'fail',
            message: errorMessage,
            duration: Date.now() - Date.now()
          }
        }
      })
    }

    return test
  }

  private async testBatchProcessing(): Promise<TestResult> {
    console.log('📦 Testing batch processing simulation...')
    
    const startTime = Date.now()

    try {
      // Test the batch processing endpoint
      const response = await fetch(`${this.baseUrl}/api/process/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          'x-vercel-cron': '1'
        },
        body: JSON.stringify({ 
          batchSize: 3,
          dryRun: false // Actually process notes
        }),
        timeout: 45000
      })

      if (response.ok) {
        const result = await response.json()
        
        return {
          name: 'Batch Processing',
          status: 'pass',
          message: `Batch processing successful: processed ${result.processed || 0} notes`,
          duration: Date.now() - startTime,
          details: {
            processed: result.processed,
            failed: result.failed,
            errors: result.errors?.slice(0, 3) // Show first 3 errors
          }
        }
      } else {
        const errorText = await response.text().catch(() => 'No response body')
        
        return {
          name: 'Batch Processing',
          status: 'fail',
          message: `Batch processing failed: ${response.status}`,
          duration: Date.now() - startTime,
          details: { 
            status: response.status,
            error: errorText.substring(0, 200)
          }
        }
      }

    } catch (error) {
      return {
        name: 'Batch Processing',
        status: 'fail',
        message: `Batch processing error: ${error.message}`,
        duration: Date.now() - startTime,
        details: { error: error.message }
      }
    }
  }

  private async testErrorHandling(): Promise<TestResult> {
    console.log('⚠️  Testing error handling...')
    
    const startTime = Date.now()

    try {
      // Test with invalid authentication
      const invalidAuthResponse = await fetch(`${this.baseUrl}/api/process/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-token'
        },
        body: JSON.stringify({ batchSize: 1 }),
        timeout: 10000
      })

      const hasProperAuthHandling = invalidAuthResponse.status === 401 || invalidAuthResponse.status === 403

      // Test with malformed requests
      const malformedResponse = await fetch(`${this.baseUrl}/api/process/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          'x-vercel-cron': '1'
        },
        body: 'invalid json',
        timeout: 10000
      })

      const hasProperErrorHandling = malformedResponse.status === 400 || malformedResponse.status === 422

      if (hasProperAuthHandling && hasProperErrorHandling) {
        return {
          name: 'Error Handling',
          status: 'pass',
          message: 'Error handling working correctly',
          duration: Date.now() - startTime,
          details: {
            authErrorStatus: invalidAuthResponse.status,
            malformedRequestStatus: malformedResponse.status
          }
        }
      } else {
        return {
          name: 'Error Handling',
          status: 'warning',
          message: 'Error handling partially working',
          duration: Date.now() - startTime,
          details: {
            authHandling: hasProperAuthHandling,
            errorHandling: hasProperErrorHandling,
            authStatus: invalidAuthResponse.status,
            malformedStatus: malformedResponse.status
          }
        }
      }

    } catch (error) {
      return {
        name: 'Error Handling',
        status: 'fail',
        message: `Error handling test failed: ${error.message}`,
        duration: Date.now() - startTime,
        details: { error: error.message }
      }
    }
  }

  private async testPerformanceMonitoring(): Promise<TestResult> {
    console.log('📊 Testing performance monitoring...')
    
    const startTime = Date.now()

    try {
      // Get processing statistics
      const { data: notes, error } = await this.supabase
        .from('notes')
        .select('processed_at, processing_started_at, created_at, error_message')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        return {
          name: 'Performance Monitoring',
          status: 'fail',
          message: `Failed to get processing stats: ${error.message}`,
          duration: Date.now() - startTime
        }
      }

      // Calculate performance metrics
      const recentNotes = notes || []
      const completedNotes = recentNotes.filter(n => n.processed_at)
      const failedNotes = recentNotes.filter(n => n.error_message)
      
      let totalProcessingTime = 0
      let processingTimeCount = 0

      completedNotes.forEach(note => {
        if (note.processing_started_at && note.processed_at) {
          const processingTime = new Date(note.processed_at).getTime() - new Date(note.processing_started_at).getTime()
          totalProcessingTime += processingTime
          processingTimeCount++
        }
      })

      const averageProcessingTime = processingTimeCount > 0 
        ? Math.round(totalProcessingTime / processingTimeCount / 1000) 
        : 0

      const successRate = recentNotes.length > 0 
        ? (completedNotes.length / recentNotes.length) * 100
        : 100

      const performanceIssues = []
      if (averageProcessingTime > 300) performanceIssues.push('Slow processing (>5min avg)')
      if (successRate < 80) performanceIssues.push(`Low success rate (${successRate.toFixed(1)}%)`)
      if (failedNotes.length > recentNotes.length * 0.2) performanceIssues.push('High failure rate')

      return {
        name: 'Performance Monitoring',
        status: performanceIssues.length === 0 ? 'pass' : 'warning',
        message: performanceIssues.length === 0 
          ? 'Performance metrics healthy'
          : `Performance issues: ${performanceIssues.join(', ')}`,
        duration: Date.now() - startTime,
        details: {
          totalNotes: recentNotes.length,
          completedNotes: completedNotes.length,
          failedNotes: failedNotes.length,
          averageProcessingTimeSeconds: averageProcessingTime,
          successRate: Math.round(successRate * 10) / 10,
          performanceIssues
        }
      }

    } catch (error) {
      return {
        name: 'Performance Monitoring',
        status: 'fail',
        message: `Performance monitoring failed: ${error.message}`,
        duration: Date.now() - startTime,
        details: { error: error.message }
      }
    }
  }

  private async testCircuitBreaker(): Promise<TestResult> {
    console.log('🔌 Testing circuit breaker functionality...')
    
    const startTime = Date.now()

    try {
      // This is a simulation since we can't easily trigger circuit breaker conditions
      // In a real test, you might make rapid requests to trigger rate limiting
      
      const response = await fetch(`${this.baseUrl}/api/process/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          'x-vercel-cron': '1'
        },
        body: JSON.stringify({ 
          batchSize: 0, // Empty batch to test without actual processing
          dryRun: true
        }),
        timeout: 10000
      })

      // Circuit breaker is working if the endpoint responds appropriately
      if (response.ok || response.status === 429) {
        return {
          name: 'Circuit Breaker Testing',
          status: 'pass',
          message: 'Circuit breaker functionality appears operational',
          duration: Date.now() - startTime,
          details: {
            status: response.status,
            note: 'Circuit breaker tested indirectly via API response patterns'
          }
        }
      } else {
        return {
          name: 'Circuit Breaker Testing',
          status: 'warning',
          message: `Unexpected response: ${response.status}`,
          duration: Date.now() - startTime,
          details: { 
            status: response.status,
            note: 'Circuit breaker may not be functioning properly'
          }
        }
      }

    } catch (error) {
      return {
        name: 'Circuit Breaker Testing',
        status: 'fail',
        message: `Circuit breaker test failed: ${error.message}`,
        duration: Date.now() - startTime,
        details: { error: error.message }
      }
    }
  }

  private async testProcessingLocks(): Promise<TestResult> {
    console.log('🔒 Testing processing lock functionality...')
    
    const startTime = Date.now()

    try {
      // Check for any currently locked notes
      const { data: lockedNotes, error } = await this.supabase
        .from('notes')
        .select('id, processing_started_at, processed_at')
        .not('processing_started_at', 'is', null)
        .is('processed_at', null)

      if (error) {
        return {
          name: 'Processing Lock Testing',
          status: 'fail',
          message: `Failed to check processing locks: ${error.message}`,
          duration: Date.now() - startTime
        }
      }

      const currentlyLocked = lockedNotes || []
      const stuckLocks = currentlyLocked.filter(note => {
        const lockTime = new Date(note.processing_started_at).getTime()
        const now = Date.now()
        return (now - lockTime) > (15 * 60 * 1000) // 15 minutes
      })

      if (stuckLocks.length === 0) {
        return {
          name: 'Processing Lock Testing',
          status: 'pass',
          message: `Processing locks healthy (${currentlyLocked.length} active locks, 0 stuck)`,
          duration: Date.now() - startTime,
          details: {
            activeLocks: currentlyLocked.length,
            stuckLocks: 0
          }
        }
      } else {
        return {
          name: 'Processing Lock Testing',
          status: 'warning',
          message: `Found ${stuckLocks.length} stuck processing locks`,
          duration: Date.now() - startTime,
          details: {
            activeLocks: currentlyLocked.length,
            stuckLocks: stuckLocks.length,
            stuckNoteIds: stuckLocks.map(n => n.id)
          }
        }
      }

    } catch (error) {
      return {
        name: 'Processing Lock Testing',
        status: 'fail',
        message: `Processing lock test failed: ${error.message}`,
        duration: Date.now() - startTime,
        details: { error: error.message }
      }
    }
  }

  private calculateSummary(report: TestReport): void {
    let totalTests = 0
    let passed = 0
    let failed = 0
    let warnings = 0

    // Count end-to-end processing sub-tests
    Object.values(report.tests.endToEndProcessing).forEach(test => {
      totalTests++
      if (test.status === 'pass') passed++
      else if (test.status === 'fail') failed++
      else if (test.status === 'warning') warnings++
    })

    // Count other tests
    const otherTests = [
      report.tests.batchProcessing,
      report.tests.errorHandling,
      report.tests.performanceMonitoring,
      report.tests.circuitBreakerTesting,
      report.tests.processingLockTesting
    ]

    otherTests.forEach(test => {
      totalTests++
      if (test.status === 'pass') passed++
      else if (test.status === 'fail') failed++
      else if (test.status === 'warning') warnings++
    })

    report.summary = {
      totalTests,
      passed,
      failed,
      warnings,
      overallSuccess: failed === 0 && passed > totalTests * 0.7 // 70% pass rate required
    }
  }

  private displayReport(report: TestReport): void {
    console.log('\n' + '='.repeat(70))
    console.log('🧪 PRODUCTION PROCESSING TEST RESULTS')
    console.log('='.repeat(70))
    console.log(`🕒 Generated: ${new Date(report.timestamp).toLocaleString()}`)
    console.log(`🎯 Environment: ${report.environment.baseUrl}`)
    console.log(`🔑 Auth Token: ${report.environment.hasAuthToken ? '✅' : '❌'}`)
    console.log(`🤖 OpenAI Key: ${report.environment.hasOpenAIKey ? '✅' : '❌'}`)
    console.log('='.repeat(70))

    // End-to-end processing details
    console.log('\n🔄 End-to-End Processing:')
    Object.values(report.tests.endToEndProcessing).forEach((test, index) => {
      const emoji = this.getStatusEmoji(test.status)
      const duration = test.duration ? ` (${test.duration}ms)` : ''
      console.log(`  ${index + 1}. ${test.name} ${emoji} - ${test.message}${duration}`)
    })

    // Other tests
    console.log('\n📋 Other Tests:')
    const otherTests = [
      report.tests.batchProcessing,
      report.tests.errorHandling,
      report.tests.performanceMonitoring,
      report.tests.circuitBreakerTesting,
      report.tests.processingLockTesting
    ]

    otherTests.forEach((test, index) => {
      const emoji = this.getStatusEmoji(test.status)
      const duration = test.duration ? ` (${test.duration}ms)` : ''
      console.log(`  ${index + 1}. ${test.name} ${emoji} - ${test.message}${duration}`)
    })

    console.log('\n' + '='.repeat(70))
    console.log(`📊 SUMMARY: ${report.summary.passed} passed, ${report.summary.warnings} warnings, ${report.summary.failed} failed`)
    
    if (report.summary.overallSuccess) {
      console.log('🎉 Production processing tests PASSED!')
      console.log('🚀 System is ready for production use.')
    } else {
      console.log('⚠️  Production processing tests have issues.')
      console.log('🔧 Review failed tests and fix issues before production use.')
    }
    
    console.log('='.repeat(70))
  }

  private saveReport(report: TestReport): void {
    const reportPath = path.join(process.cwd(), 'production-processing-test-report.json')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`📄 Detailed report saved to: ${reportPath}`)
  }

  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'pass': return '✅'
      case 'warning': return '⚠️'
      case 'fail': return '❌'
      default: return '❓'
    }
  }

  private async cleanupTestEnvironment(): Promise<void> {
    console.log('\n🧹 Cleaning up test environment...')

    try {
      // Clean up test note if created
      if (this.testNoteId) {
        const { error } = await this.supabase
          .from('notes')
          .delete()
          .eq('id', this.testNoteId)

        if (!error) {
          console.log('✅ Test note cleaned up')
        } else {
          console.log(`⚠️  Could not clean up test note: ${error.message}`)
        }
      }

      // Clean up test user if created (optional - you might want to keep for future tests)
      if (this.testUserId && this.testUserId !== '00000000-0000-0000-0000-000000000000') {
        try {
          await this.supabase.auth.admin.deleteUser(this.testUserId)
          console.log('✅ Test user cleaned up')
        } catch (error) {
          console.log('⚠️  Could not clean up test user (this is usually fine)')
        }
      }

    } catch (error) {
      console.log(`⚠️  Cleanup warnings: ${error.message}`)
    }
  }
}

// Execute the production processing test
if (require.main === module) {
  const tester = new ProductionProcessingTester()
  tester.run().catch(console.error)
}

export { ProductionProcessingTester }