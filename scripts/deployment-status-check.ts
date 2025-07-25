#!/usr/bin/env ts-node

/**
 * DEPLOYMENT STATUS CHECK SCRIPT
 * 
 * Quick deployment status check script that provides an immediate assessment
 * of what's working and what's broken in the Voice Memory system.
 */

import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  gray: '\x1b[90m'
}

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function logStatus(component: string, status: 'healthy' | 'degraded' | 'unhealthy', details: string) {
  const statusColors = {
    healthy: colors.green,
    degraded: colors.yellow,
    unhealthy: colors.red
  }
  
  const statusIcons = {
    healthy: '🟢',
    degraded: '🟡', 
    unhealthy: '🔴'
  }

  log(`${statusIcons[status]} ${statusColors[status]}${component.padEnd(25)}${colors.reset} ${details}`)
}

function logSection(title: string) {
  log(`\n${colors.bold}${colors.cyan}${title}${colors.reset}`)
  log(`${colors.cyan}${'='.repeat(title.length)}${colors.reset}`)
}

interface ComponentStatus {
  component: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  details: string
  error?: string
  quickFix?: string
}

interface DeploymentStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy'
  components: ComponentStatus[]
  criticalIssues: string[]
  quickFixes: string[]
  processingQueue: {
    total: number
    pending: number
    processing: number
    completed: number
    failed: number
    stuck: number
  }
}

class DeploymentStatusChecker {
  private supabase: any
  private baseUrl: string
  private status: DeploymentStatus

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

    // Initialize status
    this.status = {
      overall: 'healthy',
      components: [],
      criticalIssues: [],
      quickFixes: [],
      processingQueue: { total: 0, pending: 0, processing: 0, completed: 0, failed: 0, stuck: 0 }
    }
  }

  async checkEnvironmentVariables(): Promise<ComponentStatus> {
    const requiredVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'OPENAI_API_KEY'
    ]

    // Check for either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY
    const hasServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    const serviceKeyVars = hasServiceKey ? [] : ['SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY']

    const optionalVars = [
      'CRON_SECRET',
      'NEXT_PUBLIC_APP_URL',
      'VERCEL_URL'
    ]

    const missing = [...requiredVars.filter(varName => !process.env[varName]), ...serviceKeyVars]
    const optionalMissing = optionalVars.filter(varName => !process.env[varName])

    if (missing.length === 0) {
      return {
        component: 'Environment Variables',
        status: optionalMissing.length > 0 ? 'degraded' : 'healthy',
        details: optionalMissing.length > 0 
          ? `Required vars OK, missing optional: ${optionalMissing.join(', ')}`
          : 'All environment variables configured',
        quickFix: optionalMissing.length > 0 
          ? 'Set missing optional variables in Vercel dashboard'
          : undefined
      }
    } else {
      return {
        component: 'Environment Variables',
        status: 'unhealthy',
        details: `Missing required: ${missing.join(', ')}`,
        error: 'System cannot function without required environment variables',
        quickFix: 'Set missing variables in Vercel dashboard or .env file'
      }
    }
  }

  async checkDatabaseConnectivity(): Promise<ComponentStatus> {
    try {
      const { data, error } = await this.supabase
        .from('notes')
        .select('count', { count: 'exact', head: true })

      if (error) {
        return {
          component: 'Database Connectivity',
          status: 'unhealthy',
          details: 'Cannot connect to database',
          error: error.message,
          quickFix: 'Check SUPABASE_SERVICE_ROLE_KEY and database status'
        }
      }

      return {
        component: 'Database Connectivity',
        status: 'healthy',
        details: `Connected successfully (${data || 0} notes total)`
      }
    } catch (error) {
      return {
        component: 'Database Connectivity',
        status: 'unhealthy',
        details: 'Database connection failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        quickFix: 'Verify Supabase URL and service key'
      }
    }
  }

  async checkMigrationStatus(): Promise<ComponentStatus> {
    try {
      // Check if error tracking columns exist
      const { data: sampleNote, error: sampleError } = await this.supabase
        .from('notes')
        .select('*')
        .limit(1)
      
      const hasErrorTracking = !sampleError && sampleNote && sampleNote[0] && 
        ('error_message' in sampleNote[0] && 'processing_attempts' in sampleNote[0])

      // Check if processing_errors table exists
      const { error: tableError } = await this.supabase
        .from('processing_errors')
        .select('*')
        .limit(1)
      
      const hasProcessingErrorsTable = !tableError

      // Check if database functions exist
      const { error: functionError } = await this.supabase.rpc('get_processing_stats', {
        p_user_id: '00000000-0000-0000-0000-000000000000'
      })
      
      const hasFunctions = !functionError

      // Determine status
      if (hasErrorTracking && hasProcessingErrorsTable && hasFunctions) {
        return {
          component: 'Database Migration',
          status: 'healthy',
          details: 'All migration components present'
        }
      } else {
        const missing = []
        if (!hasErrorTracking) missing.push('error tracking columns')
        if (!hasProcessingErrorsTable) missing.push('processing_errors table')
        if (!hasFunctions) missing.push('database functions')

        return {
          component: 'Database Migration',
          status: 'unhealthy',
          details: `Missing: ${missing.join(', ')}`,
          error: '20240119_add_error_tracking.sql migration not applied',
          quickFix: 'Run: npx ts-node scripts/immediate-migration-fix.ts'
        }
      }
    } catch (error) {
      return {
        component: 'Database Migration',
        status: 'unhealthy',
        details: 'Migration check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        quickFix: 'Run: npx ts-node scripts/immediate-migration-fix.ts'
      }
    }
  }

  async checkAPIEndpoints(): Promise<ComponentStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/api/process/batch`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY}`,
          'X-Service-Auth': 'true'
        },
        timeout: 10000
      })

      const data = await response.json()

      if (response.ok) {
        const healthStatus = data.status || 'unknown'
        return {
          component: 'API Endpoints',
          status: healthStatus === 'healthy' ? 'healthy' : 
                  healthStatus === 'degraded' ? 'degraded' : 'unhealthy',
          details: `Batch API responding (${healthStatus})`
        }
      } else {
        return {
          component: 'API Endpoints',
          status: 'unhealthy',
          details: `API error: HTTP ${response.status}`,
          error: data.error || 'Unknown API error',
          quickFix: 'Check Vercel deployment and function logs'
        }
      }
    } catch (error) {
      return {
        component: 'API Endpoints',
        status: 'unhealthy',
        details: 'API unreachable',
        error: error instanceof Error ? error.message : 'Unknown error',
        quickFix: 'Check Vercel deployment status and URL configuration'
      }
    }
  }

  async checkCronConfiguration(): Promise<ComponentStatus> {
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      return {
        component: 'Cron Configuration',
        status: 'degraded',
        details: 'CRON_SECRET not configured',
        quickFix: 'Set CRON_SECRET in Vercel environment variables'
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/process/batch`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cronSecret}`,
          'User-Agent': 'vercel-cron/1.0'
        },
        timeout: 10000
      })

      if (response.ok) {
        return {
          component: 'Cron Configuration',
          status: 'healthy',
          details: 'Cron authentication working'
        }
      } else {
        return {
          component: 'Cron Configuration',
          status: 'unhealthy',
          details: `Cron auth failed: HTTP ${response.status}`,
          quickFix: 'Verify CRON_SECRET matches vercel.json configuration'
        }
      }
    } catch (error) {
      return {
        component: 'Cron Configuration',
        status: 'degraded',  
        details: 'Cron test failed (API may be down)',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async checkProcessingQueue(): Promise<void> {
    try {
      const { data: notes, error } = await this.supabase
        .from('notes')
        .select('processing_started_at, processed_at, error_message')

      if (error || !notes) {
        this.status.processingQueue = { total: 0, pending: 0, processing: 0, completed: 0, failed: 0, stuck: 0 }
        return
      }

      const now = new Date()
      const stuckThreshold = new Date(now.getTime() - 15 * 60 * 1000) // 15 minutes ago

      this.status.processingQueue = {
        total: notes.length,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        stuck: 0
      }

      notes.forEach(note => {
        if (note.processed_at) {
          this.status.processingQueue.completed++
        } else if (note.error_message) {
          this.status.processingQueue.failed++
        } else if (note.processing_started_at) {
          const startTime = new Date(note.processing_started_at)
          if (startTime < stuckThreshold) {
            this.status.processingQueue.stuck++
          } else {
            this.status.processingQueue.processing++
          }
        } else {
          this.status.processingQueue.pending++
        }
      })
    } catch (error) {
      // Fallback if processing queue check fails
      this.status.processingQueue = { total: 0, pending: 0, processing: 0, completed: 0, failed: 0, stuck: 0 }
    }
  }

  async runAllChecks(): Promise<void> {
    const checks = [
      this.checkEnvironmentVariables(),
      this.checkDatabaseConnectivity(), 
      this.checkMigrationStatus(),
      this.checkAPIEndpoints(),
      this.checkCronConfiguration()
    ]

    this.status.components = await Promise.all(checks)
    await this.checkProcessingQueue()

    // Determine overall status
    const unhealthyCount = this.status.components.filter(c => c.status === 'unhealthy').length
    const degradedCount = this.status.components.filter(c => c.status === 'degraded').length

    if (unhealthyCount > 0) {
      this.status.overall = 'unhealthy'
    } else if (degradedCount > 0) {
      this.status.overall = 'degraded'  
    } else {
      this.status.overall = 'healthy'
    }

    // Collect critical issues and quick fixes
    this.status.components.forEach(component => {
      if (component.status === 'unhealthy') {
        this.status.criticalIssues.push(`${component.component}: ${component.details}`)
      }
      if (component.quickFix) {
        this.status.quickFixes.push(`${component.component}: ${component.quickFix}`)
      }
    })

    // Add processing queue issues
    if (this.status.processingQueue.stuck > 0) {
      this.status.criticalIssues.push(`${this.status.processingQueue.stuck} notes are stuck in processing`)
      this.status.quickFixes.push('Processing Queue: Run npx ts-node scripts/reset-processing-state.ts')
    }
  }

  displayReport(): void {
    log(`${colors.bold}${colors.magenta}VOICE MEMORY - DEPLOYMENT STATUS CHECK${colors.reset}`)
    log(`${colors.magenta}=======================================${colors.reset}`)

    // Overall status
    const overallColor = this.status.overall === 'healthy' ? colors.green :
                        this.status.overall === 'degraded' ? colors.yellow : colors.red
    const overallIcon = this.status.overall === 'healthy' ? '🟢' :
                       this.status.overall === 'degraded' ? '🟡' : '🔴'
    
    log(`\n${colors.bold}OVERALL STATUS: ${overallColor}${this.status.overall.toUpperCase()}${colors.reset} ${overallIcon}`)

    // Component status
    logSection('COMPONENT STATUS')
    this.status.components.forEach(component => {
      logStatus(component.component, component.status, component.details)
      if (component.error) {
        log(`${colors.gray}    Error: ${component.error}${colors.reset}`)
      }
    })

    // Processing queue
    logSection('PROCESSING QUEUE')
    const queue = this.status.processingQueue
    log(`📊 Total Notes: ${queue.total}`)
    log(`   ✅ Completed: ${queue.completed}`)
    log(`   ⏳ Pending: ${queue.pending}`)
    log(`   🔄 Processing: ${queue.processing}`)
    log(`   ❌ Failed: ${queue.failed}`)
    log(`   🚨 Stuck: ${queue.stuck}`)

    // Critical issues
    if (this.status.criticalIssues.length > 0) {
      logSection('🚨 CRITICAL ISSUES')
      this.status.criticalIssues.forEach(issue => {
        log(`${colors.red}• ${issue}${colors.reset}`)
      })
    }

    // Quick fixes
    if (this.status.quickFixes.length > 0) {
      logSection('🔧 QUICK FIXES')
      this.status.quickFixes.forEach(fix => {
        log(`${colors.yellow}• ${fix}${colors.reset}`)
      })
    }

    // Recommendations
    logSection('📋 RECOMMENDATIONS')
    
    if (this.status.overall === 'healthy') {
      log(`${colors.green}✅ System is healthy and operational${colors.reset}`)
      log(`${colors.green}• Continue monitoring for any issues${colors.reset}`)
      log(`${colors.green}• Test voice note upload and processing${colors.reset}`)
    } else if (this.status.overall === 'degraded') {
      log(`${colors.yellow}⚠️  System is partially operational${colors.reset}`)
      log(`${colors.yellow}• Address the quick fixes listed above${colors.reset}`)
      log(`${colors.yellow}• Monitor processing queue for stability${colors.reset}`)
    } else {
      log(`${colors.red}❌ System requires immediate attention${colors.reset}`)
      log(`${colors.red}• Fix critical issues before system will work properly${colors.reset}`)
      log(`${colors.red}• Start with migration and environment variable issues${colors.reset}`)
    }

    // Next steps
    logSection('📝 NEXT STEPS')
    
    const hasUnhealthyComponents = this.status.components.some(c => c.status === 'unhealthy')
    
    if (hasUnhealthyComponents) {
      const migrationIssue = this.status.components.find(c => 
        c.component === 'Database Migration' && c.status === 'unhealthy'
      )
      
      if (migrationIssue) {
        log(`1. ${colors.cyan}Fix database migration (CRITICAL):${colors.reset}`)
        log(`   npx ts-node scripts/immediate-migration-fix.ts`)
      }
      
      log(`2. ${colors.cyan}Re-run this status check:${colors.reset}`)
      log(`   npx ts-node scripts/deployment-status-check.ts`)
      
      log(`3. ${colors.cyan}Run comprehensive verification:${colors.reset}`)
      log(`   npx ts-node scripts/verify-and-test-fix.ts`)
    } else {
      log(`1. ${colors.cyan}Test voice note upload and processing${colors.reset}`)
      log(`2. ${colors.cyan}Monitor the admin dashboard for processing health${colors.reset}`)
      log(`3. ${colors.cyan}Check Vercel function logs for any errors${colors.reset}`)
    }

    // Summary
    const timeEstimate = hasUnhealthyComponents ? '10-30 minutes' : '2-5 minutes'
    log(`\n${colors.bold}Estimated fix time: ${timeEstimate}${colors.reset}`)
    log(`${colors.gray}Last checked: ${new Date().toISOString()}${colors.reset}`)
  }
}

async function main() {
  try {
    const checker = new DeploymentStatusChecker()
    await checker.runAllChecks()
    checker.displayReport()
    
    // Exit with appropriate code
    const exitCode = checker.status.overall === 'unhealthy' ? 1 : 0
    process.exit(exitCode)
    
  } catch (error) {
    log(`${colors.red}${colors.bold}CRITICAL ERROR:${colors.reset} ${error}`, colors.red)
    log('\nCould not complete status check. Please verify:')
    log('• Environment variables are set correctly')
    log('• Network connectivity is working')
    log('• Supabase database is accessible')
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}

export { DeploymentStatusChecker }