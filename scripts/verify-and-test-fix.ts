#!/usr/bin/env ts-node

/**
 * VERIFICATION AND TESTING SCRIPT
 * 
 * Comprehensive verification and testing script that validates the migration
 * was applied correctly and tests the entire processing pipeline.
 */

import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
import * as fs from 'fs'
import * as path from 'path'

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
}

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function logStep(step: number, message: string) {
  log(`${colors.bold}${colors.blue}Step ${step}:${colors.reset} ${message}`)
}

function logSuccess(message: string) {
  log(`${colors.green}✓ ${message}${colors.reset}`)
}

function logError(message: string) {
  log(`${colors.red}✗ ${message}${colors.reset}`)
}

function logWarning(message: string) {
  log(`${colors.yellow}⚠ ${message}${colors.reset}`)
}

interface VerificationResult {
  success: boolean
  component: string
  details: string
  error?: string
}

interface TestResults {
  migration: VerificationResult[]
  processing: VerificationResult[]
  errorHandling: VerificationResult[]
  cronJobs: VerificationResult[]
  performance: VerificationResult[]
  endToEnd: VerificationResult[]
}

class VerificationAndTestSuite {
  private supabase: any
  private baseUrl: string
  private results: TestResults

  constructor() {
    // Validate environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY')
    }

    // Create Supabase client with service role permissions
    this.supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Determine base URL for API testing
    this.baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                  'http://localhost:3000'

    // Initialize results
    this.results = {
      migration: [],
      processing: [],
      errorHandling: [],
      cronJobs: [],
      performance: [],
      endToEnd: []
    }
  }

  async verifyMigrationComponents(): Promise<void> {
    logStep(1, 'Verifying migration components...')

    // Verify error tracking columns
    try {
      const { data: columns, error } = await this.supabase.rpc('exec_sql', {
        sql: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = 'notes' 
          AND column_name IN ('error_message', 'processing_attempts', 'last_error_at')
          ORDER BY column_name
        `
      })

      if (error) {
        this.results.migration.push({
          success: false,
          component: 'Error Tracking Columns',
          details: 'Failed to query column information',
          error: error.message
        })
      } else if (!columns || columns.length < 3) {
        this.results.migration.push({
          success: false,
          component: 'Error Tracking Columns',
          details: `Only found ${columns?.length || 0} out of 3 required columns`,
          error: 'Missing columns'
        })
      } else {
        this.results.migration.push({
          success: true,
          component: 'Error Tracking Columns',
          details: `All 3 error tracking columns present: ${columns.map(c => c.column_name).join(', ')}`
        })
        logSuccess('Error tracking columns verified')
      }
    } catch (error) {
      this.results.migration.push({
        success: false,
        component: 'Error Tracking Columns',
        details: 'Exception during column verification',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Verify processing_errors table
    try {
      const { data: tableInfo, error } = await this.supabase
        .from('processing_errors')
        .select('*')
        .limit(1)

      if (error) {
        this.results.migration.push({
          success: false,
          component: 'Processing Errors Table',
          details: 'Table not accessible',
          error: error.message
        })
      } else {
        this.results.migration.push({
          success: true,
          component: 'Processing Errors Table',
          details: 'Table exists and is accessible'
        })
        logSuccess('processing_errors table verified')
      }
    } catch (error) {
      this.results.migration.push({
        success: false,
        component: 'Processing Errors Table',
        details: 'Exception during table verification',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Verify rate_limits table
    try {
      const { data: rateLimitInfo, error } = await this.supabase
        .from('rate_limits')
        .select('*')
        .limit(1)

      if (error) {
        this.results.migration.push({
          success: false,
          component: 'Rate Limits Table',
          details: 'Table not accessible',
          error: error.message
        })
      } else {
        this.results.migration.push({
          success: true,
          component: 'Rate Limits Table',
          details: 'Table exists and is accessible'
        })
        logSuccess('rate_limits table verified')
      }
    } catch (error) {
      this.results.migration.push({
        success: false,
        component: 'Rate Limits Table',
        details: 'Exception during table verification',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Verify database functions
    const functions = [
      'log_processing_error',
      'clear_processing_error', 
      'get_processing_stats'
    ]

    for (const functionName of functions) {
      try {
        let testResult
        let testDetails

        if (functionName === 'get_processing_stats') {
          // Test get_processing_stats function
          const { data, error } = await this.supabase.rpc('get_processing_stats', {
            p_user_id: '00000000-0000-0000-0000-000000000000'
          })
          testResult = !error
          testDetails = error ? error.message : 'Function executed successfully'
        } else if (functionName === 'log_processing_error') {
          // Test log_processing_error function (won't actually log due to invalid note ID)
          const { error } = await this.supabase.rpc('log_processing_error', {
            p_note_id: '00000000-0000-0000-0000-000000000000',
            p_error_message: 'test_error',
            p_error_type: 'test',
            p_processing_attempt: 1
          })
          // This should fail due to foreign key constraint, but function should exist
          testResult = error?.message?.includes('violates foreign key constraint') || 
                      error?.message?.includes('is not present in table') ||
                      !error
          testDetails = 'Function exists and is callable'
        } else if (functionName === 'clear_processing_error') {
          // Test clear_processing_error function
          const { error } = await this.supabase.rpc('clear_processing_error', {
            p_note_id: '00000000-0000-0000-0000-000000000000'
          })
          // This should succeed even with non-existent ID
          testResult = !error
          testDetails = error ? error.message : 'Function executed successfully'
        }

        if (testResult) {
          this.results.migration.push({
            success: true,
            component: `Function: ${functionName}`,
            details: testDetails || 'Function is working correctly'
          })
          logSuccess(`Function ${functionName} verified`)
        } else {
          this.results.migration.push({
            success: false,
            component: `Function: ${functionName}`,
            details: testDetails || 'Function test failed',
            error: testDetails
          })
        }
      } catch (error) {
        this.results.migration.push({
          success: false,
          component: `Function: ${functionName}`,
          details: 'Exception during function verification',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  }

  async testProcessingPipeline(): Promise<void> {
    logStep(2, 'Testing processing pipeline...')

    // Test batch processing endpoint accessibility
    try {
      const response = await fetch(`${this.baseUrl}/api/process/batch`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY}`,
          'X-Service-Auth': 'true'
        }
      })

      const data = await response.json()

      if (response.ok) {
        this.results.processing.push({
          success: true,
          component: 'Batch Processing Endpoint',
          details: `Endpoint accessible, status: ${data.status || 'unknown'}`
        })
        logSuccess('Batch processing endpoint is accessible')
      } else {
        this.results.processing.push({
          success: false,
          component: 'Batch Processing Endpoint',
          details: `HTTP ${response.status}: ${data.error || 'Unknown error'}`,
          error: data.error
        })
      }
    } catch (error) {
      this.results.processing.push({
        success: false,
        component: 'Batch Processing Endpoint',
        details: 'Failed to reach endpoint',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Test processing service health
    try {
      const response = await fetch(`${this.baseUrl}/api/process/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY}`,
          'X-Service-Auth': 'true'
        },
        body: JSON.stringify({ batchSize: 1 })
      })

      const data = await response.json()

      if (response.ok) {
        this.results.processing.push({
          success: true,
          component: 'Processing Service Health',
          details: `Processing completed: ${data.processed || 0} processed, ${data.failed || 0} failed`
        })
        logSuccess('Processing service is healthy')
      } else {
        this.results.processing.push({
          success: false,
          component: 'Processing Service Health',
          details: `Processing failed: ${data.error || 'Unknown error'}`,
          error: data.error
        })
      }
    } catch (error) {
      this.results.processing.push({
        success: false,
        component: 'Processing Service Health',
        details: 'Processing service test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  async testErrorHandling(): Promise<void> {
    logStep(3, 'Testing error handling system...')

    // Test error tracking functionality
    try {
      // Create a test note to work with
      const { data: testNote, error: createError } = await this.supabase
        .from('notes')
        .insert({
          user_id: '00000000-0000-0000-0000-000000000000',
          title: 'Test Error Handling Note',
          file_path: '/tmp/test.mp3',
          file_size: 1000,
          content_type: 'audio/mpeg'
        })
        .select()
        .single()

      if (createError) {
        this.results.errorHandling.push({
          success: false,
          component: 'Error Tracking Test Setup',
          details: 'Could not create test note',
          error: createError.message
        })
        return
      }

      const noteId = testNote.id

      // Test error logging function
      const { error: logError } = await this.supabase.rpc('log_processing_error', {
        p_note_id: noteId,
        p_error_message: 'Test error message',
        p_error_type: 'test_error',
        p_processing_attempt: 1
      })

      if (logError) {
        this.results.errorHandling.push({
          success: false,
          component: 'Error Logging Function',
          details: 'Failed to log error',
          error: logError.message
        })
      } else {
        // Verify error was logged
        const { data: errorLog, error: fetchError } = await this.supabase
          .from('processing_errors')
          .select('*')
          .eq('note_id', noteId)
          .single()

        if (fetchError || !errorLog) {
          this.results.errorHandling.push({
            success: false,
            component: 'Error Logging Verification',
            details: 'Error was not properly logged',
            error: fetchError?.message
          })
        } else {
          this.results.errorHandling.push({
            success: true,
            component: 'Error Logging Function',
            details: `Error logged successfully: ${errorLog.error_message}`
          })
          logSuccess('Error logging function verified')
        }
      }

      // Test error clearing function
      const { error: clearError } = await this.supabase.rpc('clear_processing_error', {
        p_note_id: noteId
      })

      if (clearError) {
        this.results.errorHandling.push({
          success: false,
          component: 'Error Clearing Function',
          details: 'Failed to clear error',
          error: clearError.message
        })
      } else {
        // Verify error was cleared
        const { data: clearedNote, error: verifyError } = await this.supabase
          .from('notes')
          .select('error_message, last_error_at')
          .eq('id', noteId)
          .single()

        if (verifyError) {
          this.results.errorHandling.push({
            success: false,
            component: 'Error Clearing Verification',
            details: 'Could not verify error was cleared',
            error: verifyError.message
          })
        } else if (clearedNote.error_message !== null) {
          this.results.errorHandling.push({
            success: false,
            component: 'Error Clearing Verification',
            details: 'Error was not properly cleared',
            error: 'error_message still present'
          })
        } else {
          this.results.errorHandling.push({
            success: true,
            component: 'Error Clearing Function',
            details: 'Error cleared successfully'
          })
          logSuccess('Error clearing function verified')
        }
      }

      // Clean up test note
      await this.supabase
        .from('notes')
        .delete()
        .eq('id', noteId)

    } catch (error) {
      this.results.errorHandling.push({
        success: false,
        component: 'Error Handling Test',
        details: 'Exception during error handling test',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  async testCronJobs(): Promise<void> {
    logStep(4, 'Testing cron job functionality...')

    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      this.results.cronJobs.push({
        success: false,
        component: 'Cron Configuration',
        details: 'CRON_SECRET environment variable is not set',
        error: 'Missing CRON_SECRET'
      })
      logWarning('CRON_SECRET not configured - skipping cron tests')
      return
    }

    // Test cron authentication
    try {
      const response = await fetch(`${this.baseUrl}/api/process/batch`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cronSecret}`,
          'User-Agent': 'vercel-cron/1.0'
        }
      })

      const data = await response.json()

      if (response.ok) {
        this.results.cronJobs.push({
          success: true,
          component: 'Cron Authentication',
          details: `Cron authentication successful, health status: ${data.status}`
        })
        logSuccess('Cron authentication verified')
      } else {
        this.results.cronJobs.push({
          success: false,
          component: 'Cron Authentication',
          details: `Cron authentication failed: HTTP ${response.status}`,
          error: data.error
        })
      }
    } catch (error) {
      this.results.cronJobs.push({
        success: false,
        component: 'Cron Authentication',
        details: 'Failed to test cron authentication',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Test cron batch processing
    try {
      const response = await fetch(`${this.baseUrl}/api/process/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cronSecret}`,
          'User-Agent': 'vercel-cron/1.0'
        },
        body: JSON.stringify({ batchSize: 1 })
      })

      const data = await response.json()

      if (response.ok) {
        this.results.cronJobs.push({
          success: true,
          component: 'Cron Batch Processing',
          details: `Cron batch processing successful: ${data.processed || 0} processed`
        })
        logSuccess('Cron batch processing verified')
      } else {
        this.results.cronJobs.push({
          success: false,
          component: 'Cron Batch Processing',
          details: `Cron batch processing failed: ${data.error || 'Unknown error'}`,
          error: data.error
        })
      }
    } catch (error) {
      this.results.cronJobs.push({
        success: false,
        component: 'Cron Batch Processing',
        details: 'Failed to test cron batch processing',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  async performanceValidation(): Promise<void> {
    logStep(5, 'Validating system performance...')

    const startTime = Date.now()

    // Test database query performance
    try {
      const queryStart = Date.now()
      const { data: stats, error } = await this.supabase.rpc('get_processing_stats', {
        p_user_id: '00000000-0000-0000-0000-000000000000'
      })
      const queryTime = Date.now() - queryStart

      if (error) {
        this.results.performance.push({
          success: false,
          component: 'Database Query Performance',
          details: 'Stats query failed',
          error: error.message
        })
      } else {
        const isAcceptable = queryTime < 5000 // 5 seconds max
        this.results.performance.push({
          success: isAcceptable,
          component: 'Database Query Performance',
          details: `Stats query completed in ${queryTime}ms${isAcceptable ? ' (acceptable)' : ' (too slow)'}`
        })
        
        if (isAcceptable) {
          logSuccess(`Database queries performing well (${queryTime}ms)`)
        } else {
          logWarning(`Database queries are slow (${queryTime}ms)`)
        }
      }
    } catch (error) {
      this.results.performance.push({
        success: false,
        component: 'Database Query Performance',
        details: 'Performance test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Test API response times
    try {
      const apiStart = Date.now()
      const response = await fetch(`${this.baseUrl}/api/process/batch`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY}`,
          'X-Service-Auth': 'true'
        }
      })
      const apiTime = Date.now() - apiStart

      const isAcceptable = apiTime < 10000 // 10 seconds max
      if (response.ok) {
        this.results.performance.push({
          success: isAcceptable,
          component: 'API Response Time',
          details: `API responded in ${apiTime}ms${isAcceptable ? ' (acceptable)' : ' (too slow)'}`
        })
        
        if (isAcceptable) {
          logSuccess(`API response times acceptable (${apiTime}ms)`)
        } else {
          logWarning(`API response times slow (${apiTime}ms)`)
        }
      } else {
        this.results.performance.push({
          success: false,
          component: 'API Response Time',
          details: `API error in ${apiTime}ms`,
          error: `HTTP ${response.status}`
        })
      }
    } catch (error) {
      this.results.performance.push({
        success: false,
        component: 'API Response Time',
        details: 'API performance test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    const totalTime = Date.now() - startTime
    log(`Performance validation completed in ${totalTime}ms`)
  }

  async endToEndVerification(): Promise<void> {
    logStep(6, 'Running end-to-end verification...')

    // Test complete system health
    try {
      const response = await fetch(`${this.baseUrl}/api/process/batch`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY}`,
          'X-Service-Auth': 'true'
        }
      })

      const data = await response.json()

      if (response.ok && data.success) {
        const healthScore = this.calculateHealthScore(data)
        
        this.results.endToEnd.push({
          success: healthScore >= 80,
          component: 'System Health Score',
          details: `Overall health score: ${healthScore}% (${healthScore >= 80 ? 'healthy' : 'needs attention'})`
        })

        if (healthScore >= 80) {
          logSuccess(`System health score: ${healthScore}% - System is healthy`)
        } else {
          logWarning(`System health score: ${healthScore}% - System needs attention`)
        }
      } else {
        this.results.endToEnd.push({
          success: false,
          component: 'System Health Check',
          details: 'System health check failed',
          error: data.error || `HTTP ${response.status}`
        })
      }
    } catch (error) {
      this.results.endToEnd.push({
        success: false,
        component: 'End-to-End Verification',
        details: 'System health verification failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  private calculateHealthScore(healthData: any): number {
    let score = 100
    const checks = healthData.healthChecks || {}

    // Deduct points for failed health checks
    Object.entries(checks).forEach(([check, status]) => {
      if (!status) {
        score -= 20 // 20 points per failed check
      }
    })

    // Additional deductions based on system state
    if (healthData.processing?.circuitBreaker?.isOpen) score -= 30
    if (healthData.status === 'unhealthy') score -= 40
    if (healthData.status === 'degraded') score -= 20

    return Math.max(0, score)
  }

  generateReport(): void {
    log(`\n${colors.bold}${colors.magenta}VERIFICATION AND TEST REPORT${colors.reset}`)
    log(`${colors.magenta}==============================${colors.reset}\n`)

    const categories = [
      { name: 'Migration Components', results: this.results.migration },
      { name: 'Processing Pipeline', results: this.results.processing },
      { name: 'Error Handling', results: this.results.errorHandling },
      { name: 'Cron Jobs', results: this.results.cronJobs },
      { name: 'Performance', results: this.results.performance },
      { name: 'End-to-End', results: this.results.endToEnd }
    ]

    let overallSuccess = true
    let totalTests = 0
    let passedTests = 0

    categories.forEach(category => {
      const categoryPassed = category.results.filter(r => r.success).length
      const categoryTotal = category.results.length
      totalTests += categoryTotal
      passedTests += categoryPassed

      if (categoryTotal === 0) {
        log(`${colors.yellow}${category.name}: No tests run${colors.reset}`)
        return
      }

      const categorySuccess = categoryPassed === categoryTotal
      const categoryColor = categorySuccess ? colors.green : colors.red
      
      if (!categorySuccess) overallSuccess = false

      log(`${categoryColor}${category.name}: ${categoryPassed}/${categoryTotal} passed${colors.reset}`)

      category.results.forEach(result => {
        const resultColor = result.success ? colors.green : colors.red
        const icon = result.success ? '✓' : '✗'
        log(`  ${resultColor}${icon} ${result.component}: ${result.details}${colors.reset}`)
        
        if (result.error) {
          log(`    ${colors.red}Error: ${result.error}${colors.reset}`)
        }
      })
      log('')
    })

    // Overall summary
    const successRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0
    const summaryColor = overallSuccess ? colors.green : (successRate >= 70 ? colors.yellow : colors.red)
    
    log(`${colors.bold}${summaryColor}OVERALL RESULT: ${passedTests}/${totalTests} tests passed (${successRate}%)${colors.reset}`)
    
    if (overallSuccess) {
      log(`${colors.bold}${colors.green}🎉 All systems operational! Voice Memory is ready for production use.${colors.reset}`)
    } else if (successRate >= 70) {
      log(`${colors.bold}${colors.yellow}⚠️  Most systems operational, but some issues need attention.${colors.reset}`)
    } else {
      log(`${colors.bold}${colors.red}❌ Critical issues detected. System requires immediate attention.${colors.reset}`)
    }

    // Recommendations
    log(`\n${colors.bold}RECOMMENDATIONS:${colors.reset}`)
    if (overallSuccess) {
      log(`${colors.green}• System is healthy and ready for production use${colors.reset}`)
      log(`${colors.green}• Monitor system performance and error rates${colors.reset}`)
      log(`${colors.green}• Consider setting up automated monitoring alerts${colors.reset}`)
    } else {
      log(`${colors.yellow}• Fix failing tests before deploying to production${colors.reset}`)
      log(`${colors.yellow}• Run the immediate-migration-fix.ts script if migration tests failed${colors.reset}`)
      log(`${colors.yellow}• Check environment variables and configuration${colors.reset}`)
      log(`${colors.yellow}• Re-run this verification script after fixes are applied${colors.reset}`)
    }
  }
}

async function main() {
  log(`${colors.bold}${colors.magenta}VOICE MEMORY - VERIFICATION AND TESTING SUITE${colors.reset}`)
  log(`${colors.magenta}=============================================${colors.reset}\n`)
  
  try {
    const testSuite = new VerificationAndTestSuite()
    
    await testSuite.verifyMigrationComponents()
    await testSuite.testProcessingPipeline()
    await testSuite.testErrorHandling()
    await testSuite.testCronJobs()
    await testSuite.performanceValidation()
    await testSuite.endToEndVerification()
    
    testSuite.generateReport()
    
  } catch (error) {
    logError(`Critical error during verification: ${error}`)
    log('\nPlease check your environment variables and try again.')
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}

export { VerificationAndTestSuite }