#!/usr/bin/env tsx

/**
 * Verify Deployment Status Script
 * 
 * This script verifies that the Voice Memory application is properly deployed
 * and all systems are functioning correctly in the production environment.
 * 
 * Usage: npm run script scripts/verify-deployment-status.ts
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

// Load environment variables
dotenv.config({ path: '.env.local' })

interface DeploymentCheck {
  name: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  details?: any
  recommendations?: string[]
}

interface DeploymentReport {
  timestamp: string
  overallStatus: 'healthy' | 'degraded' | 'critical'
  checks: DeploymentCheck[]
  summary: {
    passed: number
    failed: number
    warnings: number
    total: number
  }
}

class DeploymentVerifier {
  private supabase: any
  private checks: DeploymentCheck[] = []
  private baseUrl: string

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )
    
    // Determine base URL for testing
    this.baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('localhost')
        ? 'http://localhost:3000'
        : 'https://voice-memory-tau.vercel.app'
  }

  async run(): Promise<void> {
    console.log('🔍 Starting deployment verification...\n')
    console.log(`📍 Target URL: ${this.baseUrl}\n`)

    try {
      // Run all deployment checks
      await this.checkVercelDeployment()
      await this.checkAuthenticationMethods()
      await this.checkEnvironmentVariables()
      await this.checkDatabaseConnectivity()
      await this.checkProcessingQueue()
      await this.checkOpenAIIntegration()
      await this.checkCronConfiguration()
      await this.checkErrorTracking()

      // Generate and display report
      const report = this.generateReport()
      this.displayReport(report)
      this.saveReport(report)

    } catch (error) {
      console.error('❌ Deployment verification failed:', error)
      process.exit(1)
    }
  }

  private async checkVercelDeployment(): Promise<void> {
    console.log('🚀 Checking Vercel deployment...')

    try {
      // Test basic connectivity to the deployment
      const response = await fetch(this.baseUrl, {
        method: 'GET',
        timeout: 10000
      })

      if (response.ok) {
        const html = await response.text()
        const hasExpectedContent = html.includes('Voice Memory') || html.includes('next')

        this.checks.push({
          name: 'Vercel Deployment',
          status: hasExpectedContent ? 'pass' : 'warning',
          message: hasExpectedContent 
            ? 'Deployment accessible and serving content'
            : `Deployment accessible but unexpected content (status: ${response.status})`,
          details: {
            url: this.baseUrl,
            status: response.status,
            contentCheck: hasExpectedContent
          }
        })
      } else {
        this.checks.push({
          name: 'Vercel Deployment',
          status: 'fail',
          message: `Deployment not accessible (status: ${response.status})`,
          details: { url: this.baseUrl, status: response.status },
          recommendations: [
            'Check Vercel deployment status',
            'Verify domain configuration',
            'Check for deployment errors in Vercel dashboard'
          ]
        })
      }
    } catch (error) {
      this.checks.push({
        name: 'Vercel Deployment',
        status: 'fail',
        message: `Failed to connect to deployment: ${error.message}`,
        details: { url: this.baseUrl, error: error.message },
        recommendations: [
          'Check internet connectivity',
          'Verify deployment URL is correct',
          'Check if deployment is still active'
        ]
      })
    }
  }

  private async checkAuthenticationMethods(): Promise<void> {
    console.log('🔐 Checking authentication methods...')

    const authEndpoint = `${this.baseUrl}/api/process/batch`
    const testMethods = [
      {
        name: 'Vercel Cron Headers',
        headers: {
          'x-vercel-cron': '1',
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          'Content-Type': 'application/json'
        }
      },
      {
        name: 'Bearer Token Only',
        headers: {
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          'Content-Type': 'application/json'
        }
      },
      {
        name: 'Cookie Authentication',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'test=value' // This would normally contain session cookie
        }
      }
    ]

    const results = []

    for (const method of testMethods) {
      try {
        const response = await fetch(authEndpoint, {
          method: 'POST',
          headers: method.headers,
          body: JSON.stringify({ batchSize: 1, dryRun: true }),
          timeout: 15000
        })

        const isSuccessful = response.status === 200 || response.status === 429
        const isAuthFailure = response.status === 401 || response.status === 403

        results.push({
          method: method.name,
          status: response.status,
          successful: isSuccessful,
          authFailure: isAuthFailure
        })

      } catch (error) {
        results.push({
          method: method.name,
          status: 0,
          successful: false,
          authFailure: false,
          error: error.message
        })
      }
    }

    const successfulMethods = results.filter(r => r.successful)
    const authFailures = results.filter(r => r.authFailure)

    if (successfulMethods.length > 0) {
      this.checks.push({
        name: 'Authentication Methods',
        status: successfulMethods.length >= 2 ? 'pass' : 'warning',
        message: `${successfulMethods.length} authentication method(s) working`,
        details: { results, successfulMethods: successfulMethods.map(r => r.method) }
      })
    } else if (authFailures.length > 0) {
      this.checks.push({
        name: 'Authentication Methods',
        status: 'fail',
        message: 'Authentication failing for all methods',
        details: { results },
        recommendations: [
          'Check CRON_SECRET environment variable',
          'Verify Vercel cron headers configuration',
          'Test with correct authentication tokens'
        ]
      })
    } else {
      this.checks.push({
        name: 'Authentication Methods',
        status: 'fail',
        message: 'Endpoint not reachable or returning unexpected responses',
        details: { results },
        recommendations: [
          'Check if /api/process/batch endpoint is deployed',
          'Verify API route configuration',
          'Check for deployment errors'
        ]
      })
    }
  }

  private async checkEnvironmentVariables(): Promise<void> {
    console.log('🔧 Checking environment variables...')

    const requiredVars = [
      { name: 'NEXT_PUBLIC_SUPABASE_URL', critical: true },
      { name: 'SUPABASE_SERVICE_KEY', critical: true },
      { name: 'OPENAI_API_KEY', critical: true },
      { name: 'CRON_SECRET', critical: true }
    ]

    const optionalVars = [
      { name: 'SUPABASE_ANON_KEY', critical: false },
      { name: 'OPENAI_MODEL_TRANSCRIPTION', critical: false },
      { name: 'OPENAI_MODEL_ANALYSIS', critical: false }
    ]

    const allVars = [...requiredVars, ...optionalVars]
    const missing = []
    const present = []

    allVars.forEach(varInfo => {
      const value = process.env[varInfo.name]
      if (value) {
        present.push({
          name: varInfo.name,
          hasValue: true,
          length: value.length,
          preview: value.substring(0, 10) + '...'
        })
      } else {
        missing.push({
          name: varInfo.name,
          critical: varInfo.critical
        })
      }
    })

    const criticalMissing = missing.filter(v => v.critical)

    if (criticalMissing.length === 0) {
      this.checks.push({
        name: 'Environment Variables',
        status: missing.length === 0 ? 'pass' : 'warning',
        message: missing.length === 0 
          ? 'All environment variables present'
          : `${present.length} vars present, ${missing.length} optional vars missing`,
        details: { 
          present: present.map(p => ({ name: p.name, length: p.length })),
          missing: missing.map(m => m.name)
        }
      })
    } else {
      this.checks.push({
        name: 'Environment Variables',
        status: 'fail',
        message: `Missing critical environment variables: ${criticalMissing.map(v => v.name).join(', ')}`,
        details: { present: present.map(p => p.name), missing: missing.map(m => m.name) },
        recommendations: [
          'Add missing environment variables to Vercel environment settings',
          'Redeploy after adding environment variables',
          'Verify environment variable names match exactly'
        ]
      })
    }
  }

  private async checkDatabaseConnectivity(): Promise<void> {
    console.log('🗄️  Checking database connectivity...')

    try {
      // Test basic connection
      const { data: connectionTest, error: connectionError } = await this.supabase
        .from('notes')
        .select('count')
        .limit(1)

      if (connectionError) {
        this.checks.push({
          name: 'Database Connectivity',
          status: 'fail',
          message: `Database connection failed: ${connectionError.message}`,
          details: { error: connectionError },
          recommendations: [
            'Check Supabase service status',
            'Verify SUPABASE_URL and service key',
            'Check network connectivity'
          ]
        })
        return
      }

      // Check for required tables
      const tableChecks = []
      const requiredTables = ['notes', 'processing_errors', 'rate_limits']

      for (const table of requiredTables) {
        try {
          const { error } = await this.supabase
            .from(table)
            .select('*')
            .limit(1)

          tableChecks.push({
            table,
            exists: !error,
            error: error?.message
          })
        } catch (e) {
          tableChecks.push({
            table,
            exists: false,
            error: e.message
          })
        }
      }

      const missingTables = tableChecks.filter(t => !t.exists)

      if (missingTables.length === 0) {
        this.checks.push({
          name: 'Database Connectivity',
          status: 'pass',
          message: 'Database connection successful, all required tables exist',
          details: { tableChecks }
        })
      } else {
        this.checks.push({
          name: 'Database Connectivity',
          status: 'warning',
          message: `Database connected but missing tables: ${missingTables.map(t => t.table).join(', ')}`,
          details: { tableChecks, missingTables },
          recommendations: [
            'Run database migrations',
            'Apply 20240119_add_error_tracking.sql migration',
            'Check migration status in Supabase dashboard'
          ]
        })
      }

    } catch (error) {
      this.checks.push({
        name: 'Database Connectivity',
        status: 'fail',
        message: `Database check failed: ${error.message}`,
        details: { error: error.message },
        recommendations: [
          'Check Supabase credentials',
          'Verify database service is running',
          'Check network connectivity'
        ]
      })
    }
  }

  private async checkProcessingQueue(): Promise<void> {
    console.log('📋 Checking processing queue...')

    try {
      // Get processing statistics
      const { data: notes, error } = await this.supabase
        .from('notes')
        .select(`
          id,
          processed_at,
          processing_started_at,
          error_message,
          transcription,
          analysis,
          created_at
        `)

      if (error) {
        this.checks.push({
          name: 'Processing Queue',
          status: 'fail',
          message: `Failed to query processing queue: ${error.message}`,
          details: { error: error.message }
        })
        return
      }

      const now = new Date()
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000)

      const stats = {
        total: notes.length,
        completed: notes.filter(n => n.processed_at).length,
        pending: notes.filter(n => !n.processed_at && !n.processing_started_at && !n.error_message).length,
        processing: notes.filter(n => n.processing_started_at && !n.processed_at).length,
        failed: notes.filter(n => n.error_message).length,
        stuck: notes.filter(n => 
          n.processing_started_at && 
          new Date(n.processing_started_at) < thirtyMinutesAgo && 
          !n.processed_at
        ).length
      }

      const issues = []
      if (stats.stuck > 0) issues.push(`${stats.stuck} notes stuck in processing`)
      if (stats.failed > stats.total * 0.1) issues.push(`High failure rate: ${stats.failed}/${stats.total}`)
      if (stats.pending > 50) issues.push(`Large pending queue: ${stats.pending} notes`)

      if (issues.length === 0) {
        this.checks.push({
          name: 'Processing Queue',
          status: 'pass',
          message: 'Processing queue healthy',
          details: { stats }
        })
      } else {
        this.checks.push({
          name: 'Processing Queue',
          status: issues.length > 2 ? 'fail' : 'warning',
          message: `Processing queue issues: ${issues.join(', ')}`,
          details: { stats, issues },
          recommendations: [
            'Run emergency fix script to reset stuck processing',
            'Check cron job execution',
            'Review error logs for failed notes'
          ]
        })
      }

    } catch (error) {
      this.checks.push({
        name: 'Processing Queue',
        status: 'fail',
        message: `Processing queue check failed: ${error.message}`,
        details: { error: error.message }
      })
    }
  }

  private async checkOpenAIIntegration(): Promise<void> {
    console.log('🤖 Checking OpenAI integration...')

    if (!process.env.OPENAI_API_KEY) {
      this.checks.push({
        name: 'OpenAI Integration',
        status: 'fail',
        message: 'OPENAI_API_KEY not configured',
        recommendations: ['Add OPENAI_API_KEY environment variable']
      })
      return
    }

    try {
      // Test OpenAI API connectivity
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      })

      if (response.ok) {
        const data = await response.json()
        const models = data.data || []
        
        // Check for required models
        const requiredModels = ['whisper-1', 'gpt-4o-mini', 'gpt-4o']
        const availableModels = models.map(m => m.id)
        const missingModels = requiredModels.filter(m => !availableModels.includes(m))

        if (missingModels.length === 0) {
          this.checks.push({
            name: 'OpenAI Integration',
            status: 'pass',
            message: 'OpenAI API accessible, all required models available',
            details: {
              totalModels: models.length,
              requiredModelsAvailable: requiredModels,
              apiStatus: response.status
            }
          })
        } else {
          this.checks.push({
            name: 'OpenAI Integration',
            status: 'warning',
            message: `OpenAI API accessible but missing models: ${missingModels.join(', ')}`,
            details: {
              availableModels: availableModels.slice(0, 10),
              missingModels,
              apiStatus: response.status
            }
          })
        }
      } else {
        this.checks.push({
          name: 'OpenAI Integration',
          status: 'fail',
          message: `OpenAI API returned ${response.status}`,
          details: { status: response.status },
          recommendations: [
            'Check OpenAI API key validity',
            'Verify account has sufficient credits',
            'Check OpenAI service status'
          ]
        })
      }
    } catch (error) {
      this.checks.push({
        name: 'OpenAI Integration',
        status: 'fail',
        message: `OpenAI API connection failed: ${error.message}`,
        details: { error: error.message },
        recommendations: [
          'Check internet connectivity',
          'Verify OpenAI API key format',
          'Check firewall/proxy settings'
        ]
      })
    }
  }

  private async checkCronConfiguration(): Promise<void> {
    console.log('⏰ Checking cron configuration...')

    try {
      // Check if vercel.json exists and has cron configuration
      const vercelConfigPath = path.join(process.cwd(), 'vercel.json')
      
      if (!fs.existsSync(vercelConfigPath)) {
        this.checks.push({
          name: 'Cron Configuration',
          status: 'fail',
          message: 'vercel.json not found',
          recommendations: ['Create vercel.json with cron configuration']
        })
        return
      }

      const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'))
      const hasCronConfig = vercelConfig.crons && vercelConfig.crons.length > 0
      
      if (!hasCronConfig) {
        this.checks.push({
          name: 'Cron Configuration',
          status: 'fail',
          message: 'No cron jobs configured in vercel.json',
          recommendations: ['Add cron job configuration to vercel.json']
        })
        return
      }

      // Analyze cron configuration
      const cronJobs = vercelConfig.crons
      const processingCron = cronJobs.find(cron => 
        cron.path === '/api/process/batch' || 
        cron.path.includes('process')
      )

      if (processingCron) {
        this.checks.push({
          name: 'Cron Configuration',
          status: 'pass',
          message: `Cron job configured: ${processingCron.schedule}`,
          details: {
            cronJobs: cronJobs.length,
            processingCronSchedule: processingCron.schedule,
            processingCronPath: processingCron.path
          }
        })
      } else {
        this.checks.push({
          name: 'Cron Configuration',
          status: 'warning',
          message: 'Cron jobs configured but no processing cron found',
          details: { cronJobs: cronJobs.map(c => ({ path: c.path, schedule: c.schedule })) },
          recommendations: ['Add cron job for /api/process/batch endpoint']
        })
      }

    } catch (error) {
      this.checks.push({
        name: 'Cron Configuration',
        status: 'fail',
        message: `Cron configuration check failed: ${error.message}`,
        details: { error: error.message }
      })
    }
  }

  private async checkErrorTracking(): Promise<void> {
    console.log('📊 Checking error tracking...')

    try {
      // Check if error tracking columns exist
      const { data: columns, error: schemaError } = await this.supabase
        .rpc('exec_sql', {
          sql: `
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'notes' 
            AND column_name IN ('error_message', 'processing_attempts', 'last_error_at')
          `
        })

      if (schemaError) {
        // Fallback: try to query the columns directly
        try {
          const { error: directError } = await this.supabase
            .from('notes')
            .select('error_message, processing_attempts, last_error_at')
            .limit(1)

          if (directError) {
            this.checks.push({
              name: 'Error Tracking',
              status: 'fail',
              message: 'Error tracking columns missing from notes table',
              details: { error: directError.message },
              recommendations: [
                'Run database migration: 20240119_add_error_tracking.sql',
                'Apply error tracking schema updates'
              ]
            })
          } else {
            this.checks.push({
              name: 'Error Tracking',
              status: 'pass',
              message: 'Error tracking columns present and accessible',
              details: { method: 'direct_query' }
            })
          }
        } catch (directError) {
          this.checks.push({
            name: 'Error Tracking',
            status: 'fail',
            message: 'Cannot verify error tracking schema',
            details: { schemaError: schemaError.message, directError: directError.message }
          })
        }
        return
      }

      const foundColumns = columns || []
      const requiredColumns = ['error_message', 'processing_attempts', 'last_error_at']
      const missingColumns = requiredColumns.filter(col => 
        !foundColumns.some(found => found.column_name === col)
      )

      if (missingColumns.length === 0) {
        // Also check if processing_errors table exists
        try {
          const { error: tableError } = await this.supabase
            .from('processing_errors')
            .select('count')
            .limit(1)

          this.checks.push({
            name: 'Error Tracking',
            status: tableError ? 'warning' : 'pass',
            message: tableError 
              ? 'Error tracking columns exist but processing_errors table missing'
              : 'Error tracking fully configured',
            details: {
              notesColumns: foundColumns.map(c => c.column_name),
              processingErrorsTable: !tableError
            }
          })
        } catch (e) {
          this.checks.push({
            name: 'Error Tracking',
            status: 'warning',
            message: 'Error tracking columns exist but cannot verify processing_errors table',
            details: { notesColumns: foundColumns.map(c => c.column_name) }
          })
        }
      } else {
        this.checks.push({
          name: 'Error Tracking',
          status: 'fail',
          message: `Missing error tracking columns: ${missingColumns.join(', ')}`,
          details: {
            foundColumns: foundColumns.map(c => c.column_name),
            missingColumns
          },
          recommendations: [
            'Run emergency-fix-processing.ts script',
            'Apply database migration manually'
          ]
        })
      }

    } catch (error) {
      this.checks.push({
        name: 'Error Tracking',
        status: 'fail',
        message: `Error tracking check failed: ${error.message}`,
        details: { error: error.message }
      })
    }
  }

  private generateReport(): DeploymentReport {
    const summary = {
      passed: this.checks.filter(c => c.status === 'pass').length,
      failed: this.checks.filter(c => c.status === 'fail').length,
      warnings: this.checks.filter(c => c.status === 'warning').length,
      total: this.checks.length
    }

    let overallStatus: 'healthy' | 'degraded' | 'critical'
    if (summary.failed === 0) {
      overallStatus = summary.warnings === 0 ? 'healthy' : 'degraded'
    } else {
      overallStatus = summary.failed > summary.total / 2 ? 'critical' : 'degraded'
    }

    return {
      timestamp: new Date().toISOString(),
      overallStatus,
      checks: this.checks,
      summary
    }
  }

  private displayReport(report: DeploymentReport): void {
    console.log('\n' + '='.repeat(70))
    console.log('📊 DEPLOYMENT VERIFICATION REPORT')
    console.log('='.repeat(70))
    console.log(`🕒 Generated: ${new Date(report.timestamp).toLocaleString()}`)
    console.log(`🎯 Target: ${this.baseUrl}`)
    console.log(`📈 Overall Status: ${this.getStatusEmoji(report.overallStatus)} ${report.overallStatus.toUpperCase()}`)
    console.log('='.repeat(70))

    report.checks.forEach((check, index) => {
      const emoji = this.getStatusEmoji(check.status)
      console.log(`\n${index + 1}. ${check.name} ${emoji}`)
      console.log(`   Status: ${check.status.toUpperCase()}`)
      console.log(`   Message: ${check.message}`)
      
      if (check.recommendations && check.recommendations.length > 0) {
        console.log('   Recommendations:')
        check.recommendations.forEach(rec => console.log(`     • ${rec}`))
      }
    })

    console.log('\n' + '='.repeat(70))
    console.log(`📊 SUMMARY: ${report.summary.passed} passed, ${report.summary.warnings} warnings, ${report.summary.failed} failed`)
    
    if (report.overallStatus === 'healthy') {
      console.log('🎉 Deployment is healthy and fully operational!')
    } else if (report.overallStatus === 'degraded') {
      console.log('⚠️  Deployment has some issues but core functionality should work.')
    } else {
      console.log('🚨 Deployment has critical issues that need immediate attention.')
    }
    
    console.log('='.repeat(70))
  }

  private saveReport(report: DeploymentReport): void {
    const reportPath = path.join(process.cwd(), 'deployment-verification-report.json')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`📄 Detailed report saved to: ${reportPath}`)
  }

  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'pass':
      case 'healthy':
        return '✅'
      case 'warning':
      case 'degraded':
        return '⚠️'
      case 'fail':
      case 'critical':
        return '❌'
      default:
        return '❓'
    }
  }
}

// Execute the deployment verification
if (require.main === module) {
  const verifier = new DeploymentVerifier()
  verifier.run().catch(console.error)
}

export { DeploymentVerifier }