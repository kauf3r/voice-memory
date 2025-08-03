#!/usr/bin/env tsx

/**
 * Production Health Check Script
 * 
 * This script performs comprehensive health checks for the Voice Memory application
 * to ensure all systems are functioning properly in production.
 */

import dotenv from 'dotenv'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

interface HealthCheck {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy' | 'critical' | 'error'
  details: any
  duration: number
  recommendations?: string[]
}

interface HealthReport {
  overallStatus: 'healthy' | 'degraded' | 'unhealthy' | 'critical' | 'error'
  timestamp: string
  checks: HealthCheck[]
  summary: {
    totalChecks: number
    healthyChecks: number
    warnings: number
    errors: number
    criticalIssues: number
  }
  recommendations: string[]
  environment: {
    nodeEnv: string
    vercelEnv?: string
    hasRequiredEnvVars: boolean
  }
}

class ProductionHealthChecker {
  private supabase: any
  private openai: any
  private startTime: number

  constructor() {
    this.startTime = Date.now()
    
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY
    
    if (supabaseUrl && supabaseServiceKey) {
      this.supabase = createClient(supabaseUrl, supabaseServiceKey)
    }
    
    // Initialize OpenAI client
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      })
    }
  }

  private async measureDuration<T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = Date.now()
    const result = await operation()
    const duration = Date.now() - start
    return { result, duration }
  }

  async checkDatabaseConnectivity(): Promise<HealthCheck> {
    try {
      if (!this.supabase) {
        return {
          name: 'Database Connectivity',
          status: 'error',
          details: { error: 'Supabase client not initialized - missing environment variables' },
          duration: 0,
          recommendations: ['Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables']
        }
      }

      const { result, duration } = await this.measureDuration(async () => {
        // Test basic connectivity
        const { data, error } = await this.supabase
          .from('notes')
          .select('count(*)')
          .limit(1)

        if (error) throw error

        // Test auth functionality
        const { data: authData, error: authError } = await this.supabase.auth.getSession()
        
        return { notesQuery: data, auth: !authError }
      })

      return {
        name: 'Database Connectivity',
        status: duration > 5000 ? 'degraded' : 'healthy',
        details: {
          responseTime: duration,
          supabaseConnection: 'successful',
          authService: result.auth ? 'operational' : 'degraded'
        },
        duration,
        recommendations: duration > 5000 ? ['Database response time is slow, consider optimizing queries'] : []
      }

    } catch (error) {
      return {
        name: 'Database Connectivity',
        status: 'critical',
        details: {
          error: error instanceof Error ? error.message : 'Unknown database error'
        },
        duration: 0,
        recommendations: ['Check database connection and credentials', 'Verify Supabase project status']
      }
    }
  }

  async checkMigrationStatus(): Promise<HealthCheck> {
    try {
      if (!this.supabase) {
        return {
          name: 'Migration Status',
          status: 'error',
          details: { error: 'Database connection not available' },
          duration: 0
        }
      }

      const { result, duration } = await this.measureDuration(async () => {
        // Check if notes table has error tracking fields
        const { data: notesSchema, error: schemaError } = await this.supabase
          .rpc('check_table_columns', { table_name: 'notes' })
          .catch(() => ({ data: null, error: 'RPC function not available' }))

        // Check for processing lock functions
        const { data: lockFunctions, error: lockError } = await this.supabase
          .rpc('acquire_processing_lock', { p_note_id: 'test', p_lock_timeout_minutes: 1 })
          .catch(() => ({ data: null, error: 'Lock functions not available' }))

        // Check for error tracking fields in notes table
        const { data: sampleNote, error: noteError } = await this.supabase
          .from('notes')
          .select('id, error_message, processing_attempts, last_error_at, processing_started_at')
          .limit(1)
          .single()

        return {
          errorTrackingFields: !noteError,
          lockFunctions: !lockError || lockError.includes('test'), // Test ID should fail but function exists
          tableAccess: !schemaError
        }
      })

      const issues = []
      if (!result.errorTrackingFields) {
        issues.push('Error tracking fields missing from notes table')
      }
      if (!result.lockFunctions) {
        issues.push('Processing lock functions not available')
      }

      const status = issues.length === 0 ? 'healthy' : issues.length === 1 ? 'degraded' : 'unhealthy'

      return {
        name: 'Migration Status',
        status,
        details: {
          errorTrackingFields: result.errorTrackingFields,
          lockFunctions: result.lockFunctions,
          issues
        },
        duration,
        recommendations: issues.length > 0 ? ['Run database migrations to apply missing schema changes'] : []
      }

    } catch (error) {
      return {
        name: 'Migration Status',
        status: 'error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown migration check error'
        },
        duration: 0,
        recommendations: ['Check database permissions and migration scripts']
      }
    }
  }

  async checkProcessingPipelineHealth(): Promise<HealthCheck> {
    try {
      if (!this.supabase) {
        return {
          name: 'Processing Pipeline Health',
          status: 'error',
          details: { error: 'Database connection not available' },
          duration: 0
        }
      }

      const { result, duration } = await this.measureDuration(async () => {
        // Check for stuck notes (processing for more than 30 minutes)
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
        const { data: stuckNotes, error: stuckError } = await this.supabase
          .from('notes')
          .select('id, processing_started_at')
          .not('processing_started_at', 'is', null)
          .is('processed_at', null)
          .lt('processing_started_at', thirtyMinutesAgo)

        // Check recent error rates (last hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
        const { data: recentNotes, error: recentError } = await this.supabase
          .from('notes')
          .select('id, error_message, processed_at')
          .gte('created_at', oneHourAgo)

        // Check processing queue depth
        const { data: pendingNotes, error: pendingError } = await this.supabase
          .from('notes')
          .select('count(*)')
          .is('transcription', null)
          .is('error_message', null)
          .is('processing_started_at', null)

        return {
          stuckNotes: stuckNotes || [],
          recentNotes: recentNotes || [],
          pendingCount: pendingNotes?.[0]?.count || 0,
          errors: {
            stuck: stuckError,
            recent: recentError,
            pending: pendingError
          }
        }
      })

      const stuckCount = result.stuckNotes.length
      const recentNotes = result.recentNotes
      const errorRate = recentNotes.length > 0 
        ? (recentNotes.filter((n: any) => n.error_message).length / recentNotes.length) * 100 
        : 0

      let status: HealthCheck['status'] = 'healthy'
      const issues = []

      if (stuckCount > 5) {
        status = 'critical'
        issues.push(`${stuckCount} notes stuck in processing`)
      } else if (stuckCount > 2) {
        status = 'degraded'
        issues.push(`${stuckCount} notes may be stuck`)
      }

      if (errorRate > 50) {
        status = 'critical'
        issues.push(`High error rate: ${errorRate.toFixed(1)}%`)
      } else if (errorRate > 20) {
        status = status === 'critical' ? 'critical' : 'unhealthy'
        issues.push(`Elevated error rate: ${errorRate.toFixed(1)}%`)
      }

      if (result.pendingCount > 100) {
        status = status === 'critical' ? 'critical' : 'degraded'
        issues.push(`Large processing queue: ${result.pendingCount} pending`)
      }

      return {
        name: 'Processing Pipeline Health',
        status,
        details: {
          stuckNotes: stuckCount,
          errorRate: parseFloat(errorRate.toFixed(1)),
          pendingQueue: result.pendingCount,
          recentlyProcessed: recentNotes.length,
          issues
        },
        duration,
        recommendations: issues.length > 0 ? [
          'Consider running batch processing to clear queue',
          'Check for processing lock cleanup',
          'Review error patterns in failed notes'
        ] : []
      }

    } catch (error) {
      return {
        name: 'Processing Pipeline Health',
        status: 'error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown pipeline error'
        },
        duration: 0,
        recommendations: ['Check database connectivity and query permissions']
      }
    }
  }

  async checkOpenAIConnectivity(): Promise<HealthCheck> {
    try {
      if (!this.openai) {
        return {
          name: 'OpenAI API Connectivity',
          status: 'critical',
          details: { error: 'OpenAI client not initialized - missing API key' },
          duration: 0,
          recommendations: ['Set OPENAI_API_KEY environment variable']
        }
      }

      const { result, duration } = await this.measureDuration(async () => {
        // Test OpenAI API with a simple request
        const response = await this.openai.models.list()
        const models = response.data
        
        // Check for required models
        const whisperModel = models.find((m: any) => m.id.includes('whisper'))
        const gptModel = models.find((m: any) => m.id.includes('gpt-4') || m.id.includes('gpt-3.5'))
        
        return {
          modelsAvailable: models.length,
          hasWhisper: !!whisperModel,
          hasGPT: !!gptModel,
          models: models.map((m: any) => m.id).slice(0, 10) // First 10 models
        }
      })

      let status: HealthCheck['status'] = 'healthy'
      const issues = []

      if (!result.hasWhisper) {
        status = 'critical'
        issues.push('Whisper models not available')
      }

      if (!result.hasGPT) {
        status = 'critical'
        issues.push('GPT models not available')
      }

      if (duration > 10000) {
        status = status === 'critical' ? 'critical' : 'degraded'
        issues.push('Slow API response time')
      }

      return {
        name: 'OpenAI API Connectivity',
        status,
        details: {
          responseTime: duration,
          modelsAvailable: result.modelsAvailable,
          hasRequiredModels: result.hasWhisper && result.hasGPT,
          availableModels: result.models,
          issues
        },
        duration,
        recommendations: issues.length > 0 ? [
          'Check OpenAI API key permissions',
          'Verify account billing status',
          'Check for API rate limits'
        ] : []
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown OpenAI error'
      let status: HealthCheck['status'] = 'critical'
      
      if (errorMessage.includes('rate limit')) {
        status = 'degraded'
      } else if (errorMessage.includes('quota') || errorMessage.includes('billing')) {
        status = 'critical'
      }

      return {
        name: 'OpenAI API Connectivity',
        status,
        details: { error: errorMessage },
        duration: 0,
        recommendations: [
          'Check OpenAI API key validity',
          'Verify account has sufficient credits',
          'Check for rate limiting issues'
        ]
      }
    }
  }

  async checkCronJobStatus(): Promise<HealthCheck> {
    try {
      const cronSecret = process.env.CRON_SECRET
      const vercelUrl = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL
      
      if (!cronSecret) {
        return {
          name: 'Cron Job Status',
          status: 'degraded',
          details: { warning: 'CRON_SECRET not configured' },
          duration: 0,
          recommendations: ['Set CRON_SECRET environment variable for secure cron endpoints']
        }
      }

      if (!vercelUrl) {
        return {
          name: 'Cron Job Status',
          status: 'degraded',
          details: { warning: 'App URL not configured for cron testing' },
          duration: 0,
          recommendations: ['Set VERCEL_URL or NEXT_PUBLIC_APP_URL for cron endpoint testing']
        }
      }

      const { result, duration } = await this.measureDuration(async () => {
        // Test unified endpoint health
        const cronUrl = `https://${vercelUrl}/api/process/batch`
        const response = await fetch(cronUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${cronSecret}`,
            'User-Agent': 'Health-Check/1.0'
          }
        })

        const healthData = await response.json()
        
        return {
          statusCode: response.status,
          healthy: response.ok,
          cronData: healthData
        }
      })

      let status: HealthCheck['status'] = 'healthy'
      if (!result.healthy) {
        status = result.statusCode === 401 ? 'degraded' : 'unhealthy'
      }

      return {
        name: 'Cron Job Status',
        status,
        details: {
          endpointAccessible: result.healthy,
          responseTime: duration,
          statusCode: result.statusCode,
          cronHealth: result.cronData
        },
        duration,
        recommendations: !result.healthy ? ['Check cron endpoint configuration and authentication'] : []
      }

    } catch (error) {
      return {
        name: 'Cron Job Status',
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown cron error'
        },
        duration: 0,
        recommendations: ['Check cron endpoint accessibility and configuration']
      }
    }
  }

  async checkStorageHealth(): Promise<HealthCheck> {
    try {
      if (!this.supabase) {
        return {
          name: 'Storage Health',
          status: 'error',
          details: { error: 'Database connection not available' },
          duration: 0
        }
      }

      const { result, duration } = await this.measureDuration(async () => {
        // Test storage bucket access
        const { data: buckets, error: bucketsError } = await this.supabase.storage.listBuckets()
        
        // Test file listing in audio-files bucket
        const { data: files, error: filesError } = await this.supabase.storage
          .from('audio-files')
          .list('', { limit: 1 })

        return {
          bucketsAccessible: !bucketsError,
          audioFilesAccessible: !filesError,
          bucketCount: buckets?.length || 0,
          errors: {
            buckets: bucketsError,
            files: filesError
          }
        }
      })

      let status: HealthCheck['status'] = 'healthy'
      const issues = []

      if (!result.bucketsAccessible) {
        status = 'critical'
        issues.push('Cannot access storage buckets')
      }

      if (!result.audioFilesAccessible) {
        status = 'critical'
        issues.push('Cannot access audio-files bucket')
      }

      if (duration > 5000) {
        status = status === 'critical' ? 'critical' : 'degraded'
        issues.push('Slow storage response time')
      }

      return {
        name: 'Storage Health',
        status,
        details: {
          responseTime: duration,
          bucketsAccessible: result.bucketsAccessible,
          audioFilesAccessible: result.audioFilesAccessible,
          bucketCount: result.bucketCount,
          issues
        },
        duration,
        recommendations: issues.length > 0 ? [
          'Check Supabase storage configuration',
          'Verify storage permissions and policies'
        ] : []
      }

    } catch (error) {
      return {
        name: 'Storage Health',
        status: 'critical',
        details: {
          error: error instanceof Error ? error.message : 'Unknown storage error'
        },
        duration: 0,
        recommendations: ['Check storage connectivity and permissions']
      }
    }
  }

  async checkEnvironmentConfiguration(): Promise<HealthCheck> {
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_KEY',
      'OPENAI_API_KEY'
    ]

    const optionalEnvVars = [
      'CRON_SECRET',
      'BATCH_SIZE',
      'PROCESSING_TIMEOUT_MINUTES',
      'OPENAI_WHISPER_MODEL',
      'OPENAI_GPT_MODEL'
    ]

    const missingRequired = requiredEnvVars.filter(envVar => !process.env[envVar])
    const missingOptional = optionalEnvVars.filter(envVar => !process.env[envVar])

    let status: HealthCheck['status'] = 'healthy'
    if (missingRequired.length > 0) {
      status = 'critical'
    } else if (missingOptional.length > 2) {
      status = 'degraded'
    }

    return {
      name: 'Environment Configuration',
      status,
      details: {
        requiredVars: requiredEnvVars.map(envVar => ({
          name: envVar,
          configured: !!process.env[envVar]
        })),
        optionalVars: optionalEnvVars.map(envVar => ({
          name: envVar,
          configured: !!process.env[envVar]
        })),
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV
      },
      duration: 0,
      recommendations: [
        ...missingRequired.map(envVar => `Set required environment variable: ${envVar}`),
        ...missingOptional.map(envVar => `Consider setting optional environment variable: ${envVar}`)
      ]
    }
  }

  async runFullHealthCheck(): Promise<HealthReport> {
    console.log('🏥 Starting comprehensive production health check...')
    console.log('=' .repeat(60))

    const checks: HealthCheck[] = []

    // Run all health checks
    const checkFunctions = [
      () => this.checkEnvironmentConfiguration(),
      () => this.checkDatabaseConnectivity(),
      () => this.checkMigrationStatus(),
      () => this.checkProcessingPipelineHealth(),
      () => this.checkOpenAIConnectivity(),
      () => this.checkCronJobStatus(),
      () => this.checkStorageHealth()
    ]

    for (const checkFn of checkFunctions) {
      try {
        const check = await checkFn()
        checks.push(check)
        
        const statusIcon = this.getStatusIcon(check.status)
        console.log(`${statusIcon} ${check.name}: ${check.status.toUpperCase()} (${check.duration}ms)`)
        
        if (check.recommendations && check.recommendations.length > 0) {
          check.recommendations.forEach(rec => console.log(`  💡 ${rec}`))
        }
      } catch (error) {
        console.error(`❌ Failed to run health check: ${error}`)
      }
    }

    // Calculate overall status
    const statusPriority = { healthy: 0, degraded: 1, unhealthy: 2, critical: 3, error: 4 }
    const worstStatus = checks.reduce((worst, check) => {
      return statusPriority[check.status] > statusPriority[worst.status] ? check : worst
    }, checks[0] || { status: 'healthy' as const, name: 'default', details: {}, duration: 0 })

    // Generate summary
    const summary = {
      totalChecks: checks.length,
      healthyChecks: checks.filter(c => c.status === 'healthy').length,
      warnings: checks.filter(c => c.status === 'degraded').length,
      errors: checks.filter(c => c.status === 'unhealthy').length,
      criticalIssues: checks.filter(c => c.status === 'critical' || c.status === 'error').length
    }

    // Collect all recommendations
    const allRecommendations = checks
      .flatMap(check => check.recommendations || [])
      .filter((rec, index, arr) => arr.indexOf(rec) === index) // Remove duplicates

    const report: HealthReport = {
      overallStatus: worstStatus.status,
      timestamp: new Date().toISOString(),
      checks,
      summary,
      recommendations: allRecommendations,
      environment: {
        nodeEnv: process.env.NODE_ENV || 'unknown',
        vercelEnv: process.env.VERCEL_ENV,
        hasRequiredEnvVars: !['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'OPENAI_API_KEY']
          .some(envVar => !process.env[envVar])
      }
    }

    this.printHealthReport(report)

    return report
  }

  private getStatusIcon(status: HealthCheck['status']): string {
    switch (status) {
      case 'healthy': return '✅'
      case 'degraded': return '⚠️'
      case 'unhealthy': return '❌'
      case 'critical': return '🚨'
      case 'error': return '💥'
      default: return '❓'
    }
  }

  private printHealthReport(report: HealthReport): void {
    console.log('\n' + '=' .repeat(60))
    console.log('📊 HEALTH REPORT SUMMARY')
    console.log('=' .repeat(60))
    
    const overallIcon = this.getStatusIcon(report.overallStatus)
    console.log(`${overallIcon} Overall Status: ${report.overallStatus.toUpperCase()}`)
    console.log(`🌍 Environment: ${report.environment.nodeEnv} ${report.environment.vercelEnv ? `(${report.environment.vercelEnv})` : ''}`)
    console.log(`⏱️  Total Duration: ${Date.now() - this.startTime}ms`)
    
    console.log('\n📈 Summary:')
    console.log(`  ✅ Healthy: ${report.summary.healthyChecks}/${report.summary.totalChecks}`)
    console.log(`  ⚠️  Warnings: ${report.summary.warnings}`)
    console.log(`  ❌ Errors: ${report.summary.errors}`)
    console.log(`  🚨 Critical: ${report.summary.criticalIssues}`)
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:')
      report.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`)
      })
    }
    
    if (report.overallStatus === 'healthy') {
      console.log('\n🎉 All systems operational!')
    } else {
      console.log(`\n⚠️  Action required: ${report.summary.criticalIssues + report.summary.errors} issue(s) need attention`)
    }
    
    console.log('=' .repeat(60))
  }
}

// Main execution
async function main() {
  try {
    const healthChecker = new ProductionHealthChecker()
    const report = await healthChecker.runFullHealthCheck()
    
    // Exit with appropriate code
    const exitCode = report.overallStatus === 'healthy' ? 0 : 1
    process.exit(exitCode)
    
  } catch (error) {
    console.error('💥 Health check failed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

export { ProductionHealthChecker, type HealthReport, type HealthCheck } 