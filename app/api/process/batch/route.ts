import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { processingService } from '@/lib/processing-service'
import { isAuthorizedCronRequest, isVercelCronRequest, getAuthMethod } from '@/lib/cron-auth'

// Environment variable for cron authentication
const CRON_SECRET = process.env.CRON_SECRET
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '5')
const PROCESSING_TIMEOUT_MINUTES = parseInt(process.env.PROCESSING_TIMEOUT_MINUTES || '15')

// Global variables to track if batch processing is running
let isBatchProcessingRunning = false
let batchProcessingStartTime = 0
let currentBatchId: string | null = null

// Function timeout buffer (30 seconds before Vercel timeout)
const FUNCTION_TIMEOUT_BUFFER_MS = 30 * 1000

// Shared authentication helper function
async function authenticateRequest(request: NextRequest): Promise<{
  userId: string
  authMethod: string
  isAuthorized: boolean
}> {
  // Check for cron authentication first
  const isCronRequest = isAuthorizedCronRequest(request, CRON_SECRET)
  
  if (isCronRequest) {
    // Cron request - skip user authentication
    return {
      userId: 'system:cron-service',
      authMethod: 'cron',
      isAuthorized: true
    }
  }
  
  // User request - perform authentication
  const supabase = createServerClient()
  
  // Try to get user from Authorization header first
  let user = null
  let authError = null
  
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '')
    const { data, error } = await supabase.auth.getUser(token)
    
    if (error) {
      authError = error
    } else {
      user = data?.user
      // Set the session for this request
      await supabase.auth.setSession({
        access_token: token,
        refresh_token: token
      })
    }
  }
  
  // If no auth header or it failed, try to get from cookies
  if (!user) {
    const { data: { user: cookieUser }, error } = await supabase.auth.getUser()
    user = cookieUser
    authError = error
  }
  
  // Check for service key authentication (for admin operations)
  const serviceAuthHeader = request.headers.get('X-Service-Auth')
  const isServiceAuth = serviceAuthHeader === 'true' && 
                       authHeader === `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
  
  if (!user && !isServiceAuth) {
    return {
      userId: '',
      authMethod: '',
      isAuthorized: false
    }
  }
  
  return {
    userId: user?.id || 'system:service-admin',
    authMethod: isServiceAuth ? 'service' : 'user',
    isAuthorized: true
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const batchId = `batch_${startTime}_${Math.random().toString(36).substr(2, 9)}`
  let timeoutId: NodeJS.Timeout | null = null
  let gracefulShutdownInitiated = false
  
  try {
    // Authenticate the request
    const auth = await authenticateRequest(request)
    
    if (!auth.isAuthorized) {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          timestamp: new Date().toISOString(),
          batchId
        },
        { status: 401 }
      )
    }
    
    const { userId, authMethod } = auth
    console.log(`Authenticated as ${authMethod} request for batch processing (userId: ${userId})`)

    // Enhanced concurrency protection (especially important for cron requests)
    if (isBatchProcessingRunning && authMethod === 'cron') {
      const runningTime = Math.floor((Date.now() - batchProcessingStartTime) / 1000)
      const runningBatch = currentBatchId || 'unknown'
      console.log(`Batch processing already running (batch: ${runningBatch}) for ${runningTime} seconds`)
      
      // If it's been running for more than the timeout, consider it stuck and reset
      if (runningTime > (PROCESSING_TIMEOUT_MINUTES * 60)) {
        console.warn(`Batch processing appears stuck (batch: ${runningBatch}), resetting flag`)
        isBatchProcessingRunning = false
        currentBatchId = null
      } else {
        return NextResponse.json({
          success: false,
          error: 'Batch processing already in progress',
          timestamp: new Date().toISOString(),
          batchId,
          runningForSeconds: runningTime,
          runningBatch,
          healthMetrics: {
            healthStatus: 'busy',
            concurrencyProtection: 'active'
          }
        }, { status: 429 })
      }
    }

    // Set processing flag and start time
    isBatchProcessingRunning = true
    batchProcessingStartTime = Date.now()
    currentBatchId = batchId

    console.log(`Starting ${authMethod} batch processing (batch: ${batchId})`)

    // Enhanced timeout protection with graceful shutdown (for cron requests)
    if (authMethod === 'cron') {
      const functionTimeoutMs = (PROCESSING_TIMEOUT_MINUTES * 60 * 1000) - FUNCTION_TIMEOUT_BUFFER_MS
      let isTimedOut = false
      
      timeoutId = setTimeout(() => {
        isTimedOut = true
        gracefulShutdownInitiated = true
        console.warn(`Batch processing timeout reached (batch: ${batchId}), initiating graceful shutdown`)
      }, functionTimeoutMs)
    }

    let body
    try {
      body = await request.json()
    } catch (error) {
      body = {}
    }
    
    // Get batch size from request body or use default (with enhanced validation)
    const requestedBatchSize = authMethod === 'cron' 
      ? Math.min(Math.max(body.batchSize || BATCH_SIZE, 1), 20)
      : Math.min(body.batchSize || 5, 10)

    // Check circuit breaker status before processing
    const circuitBreakerStatus = processingService.getCircuitBreakerStatus()
    if (circuitBreakerStatus.isOpen) {
      console.warn(`Circuit breaker is open, skipping batch processing (batch: ${batchId})`)
      return NextResponse.json({
        success: false,
        warning: 'Circuit breaker is open - OpenAI API temporarily unavailable',
        timestamp: new Date().toISOString(),
        batchId,
        circuitBreakerStatus,
        healthMetrics: {
          healthStatus: 'degraded',
          circuitBreakerOpen: true
        }
      })
    }

    // Process the batch with timeout checking for cron requests
    let result: Awaited<ReturnType<typeof processingService.processNextBatch>>
    
    if (authMethod === 'cron' && timeoutId) {
      // Race between processing and timeout for cron requests
      const processingPromise = processingService.processNextBatch(requestedBatchSize)
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        const checkTimeout = () => {
          if (gracefulShutdownInitiated) {
            reject(new Error('Processing timeout reached'))
          } else {
            setTimeout(checkTimeout, 1000) // Check every second
          }
        }
        checkTimeout()
      })

      try {
        result = await Promise.race([processingPromise, timeoutPromise])
      } catch (error) {
        if (gracefulShutdownInitiated) {
          // Attempt graceful shutdown
          console.warn(`Graceful shutdown initiated (batch: ${batchId})`)
          
          // Try to get partial results
          const partialResult = {
            processed: 0,
            failed: 0,
            errors: ['Processing interrupted due to timeout'],
            metrics: {
              totalTime: Date.now() - startTime,
              averageProcessingTime: 0,
              successRate: 0,
              errorBreakdown: { timeout: 1 }
            }
          }

          return NextResponse.json({
            success: false,
            warning: 'Processing interrupted due to timeout (graceful shutdown)',
            timestamp: new Date().toISOString(),
            batchId,
            timeoutReached: true,
            gracefulShutdown: true,
            healthMetrics: {
              healthStatus: 'timeout',
              gracefulShutdown: true,
              processingInterrupted: true
            },
            ...partialResult
          })
        }
        throw error
      }
    } else {
      // Regular processing for user requests
      result = await processingService.processNextBatch(requestedBatchSize)
    }

    // Clear timeout if we completed successfully
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }

    const endTime = Date.now()
    const totalTimeMs = endTime - startTime
    const processingRate = result.processed > 0 ? (totalTimeMs / result.processed) : 0

    console.log(`${authMethod} batch processing completed (batch: ${batchId}):`, result)

    // Enhanced health metrics calculation (especially for cron requests)
    const totalNotes = result.processed + result.failed
    const successRate = totalNotes > 0 ? (result.processed / totalNotes) * 100 : 0
    const errorRate = 100 - successRate

    // Determine health status based on multiple factors
    let healthStatus = 'healthy'
    if (errorRate > 50) {
      healthStatus = 'unhealthy'
    } else if (errorRate > 20 || successRate < 80) {
      healthStatus = 'degraded'
    } else if (circuitBreakerStatus.failures > 2) {
      healthStatus = 'degraded'
    }

    const healthMetrics = {
      totalTimeMs,
      averageProcessingTimeMs: result.metrics?.averageProcessingTime || 0,
      processingRateMs: processingRate,
      successRate,
      errorRate,
      healthStatus,
      notesProcessed: result.processed,
      notesFailed: result.failed,
      batchEfficiency: totalNotes > 0 ? (result.processed / requestedBatchSize) * 100 : 0,
      circuitBreakerStatus,
      errorBreakdown: result.metrics?.errorBreakdown || {},
      memoryUsage: process.memoryUsage()
    }

    // Check if we timed out during processing (for cron requests)
    if (gracefulShutdownInitiated) {
      console.warn(`Batch processing completed but timeout was reached during execution (batch: ${batchId})`)
      healthMetrics.healthStatus = 'timeout'
      
      return NextResponse.json({
        success: true,
        warning: 'Processing completed but timeout was reached',
        timestamp: new Date().toISOString(),
        batchId,
        batchSize: requestedBatchSize,
        timeoutReached: true,
        healthMetrics,
        ...result
      })
    }

    // Log comprehensive processing report
    console.log(`Batch ${batchId} health metrics:`, healthMetrics)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      batchId,
      batchSize: requestedBatchSize,
      authMethod,
      healthMetrics,
      ...result,
      message: `Batch processing completed: ${result.processed} successful, ${result.failed} failed`
    })

  } catch (error) {
    console.error(`${authMethod || 'unknown'} batch processing error (batch: ${batchId}):`, error)
    
    // Clear timeout on error
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    // Enhanced structured error reporting
    const errorDetails = error instanceof Error ? {
      message: error.message,
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 5).join('\n'), // Limit stack trace
      category: categorizeError(error.message)
    } : {
      message: 'Unknown error',
      name: 'UnknownError',
      category: 'unknown'
    }

    const endTime = Date.now()
    const totalTimeMs = endTime - startTime

    // Enhanced error health metrics
    const healthMetrics = {
      healthStatus: 'error',
      errorRate: 100,
      successRate: 0,
      totalTimeMs,
      errorCategory: errorDetails.category,
      batchId,
      memoryUsage: process.memoryUsage(),
      circuitBreakerStatus: processingService.getCircuitBreakerStatus()
    }

    return NextResponse.json(
      { 
        success: false,
        error: 'Batch processing failed',
        errorDetails,
        timestamp: new Date().toISOString(),
        batchId,
        totalTimeMs,
        healthMetrics
      },
      { status: 500 }
    )
  } finally {
    // Always reset the processing flag in the finally block for proper cleanup
    isBatchProcessingRunning = false
    batchProcessingStartTime = 0
    currentBatchId = null
    
    // Clean up timeout if it still exists
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    console.log(`Batch processing cleanup completed (batch: ${batchId})`)
  }
}

export async function GET(request: NextRequest) {
  try {
    const isVercelCron = isVercelCronRequest(request)
    const isAuthorized = isAuthorizedCronRequest(request, CRON_SECRET)
    const authMethod = getAuthMethod(request, CRON_SECRET)
    
    // Enhanced authentication - allow both cron and user requests
    const auth = await authenticateRequest(request)
    
    if (!auth.isAuthorized) {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          timestamp: new Date().toISOString()
        },
        { status: 401 }
      )
    }
    
    const { userId, authMethod: detectedAuthMethod } = auth
    console.log(`Authenticated as ${detectedAuthMethod} request for health check/stats (userId: ${userId})`)

    // Get processing stats for health check
    let processingStats = null
    try {
      // For cron requests, use system health check; for users, use their specific stats
      const statsUserId = detectedAuthMethod === 'cron' ? 'system-health-check' : userId
      processingStats = await processingService.getProcessingStats(statsUserId)
    } catch (error) {
      console.warn('Failed to get processing stats for health check:', error)
    }

    // Get current processing metrics and circuit breaker status
    const currentMetrics = processingService.getProcessingMetrics()
    const circuitBreakerStatus = processingService.getCircuitBreakerStatus()

    const currentTime = Date.now()
    const runningTime = isBatchProcessingRunning 
      ? Math.floor((currentTime - batchProcessingStartTime) / 1000)
      : 0

    // Enhanced health status determination
    let overallHealthStatus = 'healthy'
    const healthChecks = {
      batchProcessing: !isBatchProcessingRunning || runningTime < (PROCESSING_TIMEOUT_MINUTES * 60),
      circuitBreaker: !circuitBreakerStatus.isOpen,
      processingStats: processingStats ? processingStats.failed <= processingStats.completed : true,
      authentication: !!CRON_SECRET,
      configuration: BATCH_SIZE > 0 && PROCESSING_TIMEOUT_MINUTES > 0
    }

    const failedChecks = Object.entries(healthChecks)
      .filter(([_, status]) => !status)
      .map(([check]) => check)

    if (failedChecks.length > 0) {
      overallHealthStatus = failedChecks.length > 2 ? 'unhealthy' : 'degraded'
    }

    // Comprehensive health status response
    const healthStatus = {
      success: true,
      status: overallHealthStatus,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      batchSize: BATCH_SIZE,
      timeoutMinutes: PROCESSING_TIMEOUT_MINUTES,
      cronSecretConfigured: !!CRON_SECRET,
      isVercelCron,
      isAuthorized,
      authMethod: detectedAuthMethod,
      processing: {
        isRunning: isBatchProcessingRunning,
        runningForSeconds: runningTime,
        currentBatchId,
        stats: processingStats,
        activeMetrics: currentMetrics.size,
        circuitBreaker: circuitBreakerStatus
      },
      healthChecks,
      failedChecks,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    }

    // Determine response status code based on health
    const statusCode = overallHealthStatus === 'healthy' ? 200 : 
                       overallHealthStatus === 'degraded' ? 207 : 503

    return NextResponse.json(healthStatus, { status: statusCode })
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json({
      success: false,
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Health check failed',
      memoryUsage: process.memoryUsage()
    }, { status: 500 })
  }
}

// Helper function to categorize errors for better monitoring
function categorizeError(errorMessage: string): string {
  const message = errorMessage.toLowerCase()
  
  if (message.includes('timeout')) return 'timeout'
  if (message.includes('rate limit')) return 'rate_limit'
  if (message.includes('network') || message.includes('connection')) return 'network'
  if (message.includes('authentication') || message.includes('authorization')) return 'auth'
  if (message.includes('openai') || message.includes('api')) return 'api_error'
  if (message.includes('storage') || message.includes('file')) return 'storage'
  if (message.includes('validation')) return 'validation'
  if (message.includes('circuit breaker')) return 'circuit_breaker'
  if (message.includes('memory') || message.includes('resource')) return 'resource'
  
  return 'unknown'
}