import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createServiceClient } from '@/lib/supabase-server'
import { processingService } from '@/lib/processing/ProcessingService'
import { quotaManager } from '@/lib/quota-manager'
import type { ErrorResponse, ErrorType, UsageInfo, RateLimitInfo } from '@/lib/types/api'
import { retryOpenAIOperation, retryQueue, circuitBreaker } from '@/lib/utils/retry'

// Error categorization and mapping
enum ErrorTypeEnum {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  RATE_LIMIT = 'rate_limit',
  OPENAI_ERROR = 'openai_error',
  STORAGE = 'storage_error',
  PROCESSING = 'processing_error',
  DATABASE_ERROR = 'database_error',
  INTERNAL = 'server_error'
}

function categorizeError(error: unknown): { type: ErrorType; statusCode: number; response: ErrorResponse } {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const lowerMessage = errorMessage.toLowerCase()

  // Authentication errors
  if (lowerMessage.includes('unauthorized') || lowerMessage.includes('authentication failed') || 
      lowerMessage.includes('invalid token') || lowerMessage.includes('token expired')) {
    return {
      type: ErrorTypeEnum.AUTHENTICATION,
      statusCode: 401,
      response: {
        error: 'Authentication required',
        type: ErrorTypeEnum.AUTHENTICATION,
        details: 'Please log in to continue',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      }
    }
  }

  // Authorization errors
  if (lowerMessage.includes('forbidden') || lowerMessage.includes('access denied') || 
      lowerMessage.includes('insufficient permissions')) {
    return {
      type: ErrorTypeEnum.AUTHORIZATION,
      statusCode: 403,
      response: {
        error: 'Access denied',
        type: ErrorTypeEnum.AUTHORIZATION,
        details: 'You do not have permission to perform this action',
        code: 'ACCESS_DENIED',
        timestamp: new Date().toISOString()
      }
    }
  }

  // Not found errors - treat as database errors
  if (lowerMessage.includes('not found') || lowerMessage.includes('does not exist') || 
      lowerMessage.includes('no rows returned')) {
    return {
      type: ErrorTypeEnum.DATABASE_ERROR,
      statusCode: 404,
      response: {
        error: 'Resource not found',
        type: ErrorTypeEnum.DATABASE_ERROR,
        details: 'The requested note or resource could not be found',
        code: 'NOT_FOUND',
        timestamp: new Date().toISOString()
      }
    }
  }

      // External service errors (OpenAI, etc.) - check before rate limits
      // Retry logic is now handled by the retry utility with circuit breaker
    if (lowerMessage.includes('openai_api_key') || lowerMessage.includes('openai_api_key environment variable')) {
      return {
        type: ErrorTypeEnum.OPENAI_ERROR,
        statusCode: 500,
        response: {
          error: 'Configuration error',
          type: ErrorTypeEnum.OPENAI_ERROR,
          details: 'The OpenAI API key is not configured. Please contact support.',
          code: 'MISSING_API_KEY',
          timestamp: new Date().toISOString()
        }
      }
    }

    if (lowerMessage.includes('openai') || lowerMessage.includes('api key') || 
        lowerMessage.includes('invalid file') || lowerMessage.includes('file too large') ||
        lowerMessage.includes('transcription failed') || lowerMessage.includes('analysis failed')) {
      return {
        type: ErrorTypeEnum.OPENAI_ERROR,
        statusCode: 502,
        response: {
          error: 'External service error',
          type: ErrorTypeEnum.OPENAI_ERROR,
          details: 'The processing service is temporarily unavailable. Please try again later.',
          code: 'EXTERNAL_SERVICE_ERROR',
          timestamp: new Date().toISOString()
        }
      }
    }

    // Rate limit errors
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests') || 
        lowerMessage.includes('rate_limit_exceeded')) {
      return {
        type: ErrorTypeEnum.RATE_LIMIT,
        statusCode: 429,
        response: {
          error: 'Rate limit exceeded',
          type: ErrorTypeEnum.RATE_LIMIT,
          details: 'Too many requests. Please wait before trying again.',
          code: 'RATE_LIMIT_EXCEEDED',
          timestamp: new Date().toISOString()
        }
      }
    }

    // Quota exceeded errors - treat as rate limit errors
    if (lowerMessage.includes('quota exceeded') || lowerMessage.includes('processing quota') || 
        lowerMessage.includes('storage limit') || lowerMessage.includes('maximum')) {
      return {
        type: ErrorTypeEnum.RATE_LIMIT,
        statusCode: 429,
        response: {
          error: 'Quota exceeded',
          type: ErrorTypeEnum.RATE_LIMIT,
          details: 'You have reached your processing limit. Please wait or upgrade your plan.',
          code: 'QUOTA_EXCEEDED',
          timestamp: new Date().toISOString()
        }
      }
    }

  // Storage errors
  if (lowerMessage.includes('storage') || lowerMessage.includes('file') || 
      lowerMessage.includes('audio file') || lowerMessage.includes('download')) {
    return {
      type: ErrorTypeEnum.STORAGE,
      statusCode: 500,
      response: {
        error: 'Storage error',
        type: ErrorTypeEnum.STORAGE,
        details: 'Unable to access the audio file. Please try again or contact support.',
        code: 'STORAGE_ERROR',
        timestamp: new Date().toISOString()
      }
    }
  }

  // Processing errors
  if (lowerMessage.includes('processing') || lowerMessage.includes('analysis') || 
      lowerMessage.includes('transcription') || lowerMessage.includes('validation')) {
    return {
      type: ErrorTypeEnum.PROCESSING,
      statusCode: 422,
      response: {
        error: 'Processing failed',
        type: ErrorTypeEnum.PROCESSING,
        details: 'Unable to process the audio file. Please check the file format and try again.',
        code: 'PROCESSING_ERROR',
        timestamp: new Date().toISOString()
      }
    }
  }

  // Environment validation errors
  if (lowerMessage.includes('environment validation failed') || lowerMessage.includes('environment variable')) {
    return {
      type: ErrorTypeEnum.INTERNAL,
      statusCode: 500,
      response: {
        error: 'Configuration error',
        type: ErrorTypeEnum.INTERNAL,
        details: 'Server configuration is incomplete. Please contact support.',
        code: 'CONFIG_ERROR',
        timestamp: new Date().toISOString()
      }
    }
  }

  // Validation errors
  if (lowerMessage.includes('validation') || lowerMessage.includes('invalid') || 
      lowerMessage.includes('required') || lowerMessage.includes('missing')) {
    return {
      type: ErrorTypeEnum.VALIDATION,
      statusCode: 400,
      response: {
        error: 'Invalid request',
        type: ErrorTypeEnum.VALIDATION,
        details: errorMessage,
        code: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString()
      }
    }
  }

  // Default internal error
  return {
    type: ErrorTypeEnum.INTERNAL,
    statusCode: 500,
    response: {
      error: 'Internal server error',
      type: ErrorTypeEnum.INTERNAL,
      details: 'An unexpected error occurred. Please try again later.',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    }
  }
}

function createErrorResponse(error: unknown, additionalData?: Partial<ErrorResponse>): NextResponse {
  const { type, statusCode, response } = categorizeError(error)
  
  // Add additional data if provided
  if (additionalData) {
    Object.assign(response, additionalData)
  }

  // Add retry-after header for rate limit errors
  const headers: Record<string, string> = {}
  if (type === ErrorTypeEnum.RATE_LIMIT) {
    // Set a default retry-after of 60 seconds for rate limit errors
    headers['Retry-After'] = '60'
  }

  // Enhanced error logging with full context
  console.error(`[${type}] Processing API Error:`, {
    type,
    statusCode,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
    response,
    additionalData
  })
  
  return NextResponse.json(response, { 
    status: statusCode,
    headers
  })
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log('🚀 Processing API called:', {
    timestamp: new Date().toISOString(),
    userAgent: request.headers.get('user-agent'),
    host: request.headers.get('host')
  })
  
  try {
    // Check for service key authentication first (for admin operations)
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
    const serviceAuthHeader = request.headers.get('X-Service-Auth')
    const serviceKey = process.env.SUPABASE_SERVICE_KEY
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
    const isServiceAuth = serviceAuthHeader === 'true' &&
                         Boolean(serviceKey) &&
                         token === serviceKey

    console.log('🔐 Service auth check:', {
      hasServiceHeader: serviceAuthHeader === 'true',
      hasServiceKey: Boolean(serviceKey),
      tokenMatch: token === serviceKey,
      isServiceAuth
    })

    // Use service client for service auth (bypasses RLS), otherwise use regular client
    console.log('🔧 Creating Supabase client...')
    const supabase = isServiceAuth ? createServiceClient() : await createServerClient()

    // Try to get user from Authorization header first
    console.log('🔑 Authenticating user...')
    let user = null
    let authError = null
    console.log('📋 Auth header status:', authHeader ? 'PRESENT' : 'MISSING')

    if (!isServiceAuth && authHeader && authHeader.startsWith('Bearer ')) {
      console.log('🎫 Using Bearer token authentication')
      const { data, error } = await supabase.auth.getUser(token!)

      if (error) {
        console.error('❌ Bearer token authentication failed:', error)
        authError = error
      } else {
        user = data?.user
        console.log('✅ Bearer token authentication successful:', { userId: user?.id })
        // Set the session for this request
        await supabase.auth.setSession({
          access_token: token!,
          refresh_token: token!
        })
      }
    }

    // If no auth header or it failed, try to get from cookies
    if (!isServiceAuth && !user) {
      console.log('🍪 Trying cookie authentication...')
      const { data: { user: cookieUser }, error } = await supabase.auth.getUser()
      user = cookieUser
      authError = error

      if (user) {
        console.log('✅ Cookie authentication successful:', { userId: user.id })
      } else {
        console.error('❌ Cookie authentication failed:', error)
      }
    }

    if (!user && !isServiceAuth) {
      return createErrorResponse(new Error('Unauthorized'))
    }

    console.log('📥 Parsing request body...')
    const body = await request.json()
    const { noteId, forceReprocess = false } = body
    console.log('📋 Request parameters:', { noteId, forceReprocess })

    if (!noteId) {
      console.error('❌ Missing noteId in request')
      return createErrorResponse(new Error('noteId is required'))
    }

    // Get the note to verify it exists and get user_id for quota checking
    let noteQuery = supabase
      .from('notes')
      .select('*')
      .eq('id', noteId)
    
    // If we have a user, filter by user_id. If service auth, don't filter by user.
    if (user && !isServiceAuth) {
      noteQuery = noteQuery.eq('user_id', user.id)
    }
    
    const { data: note, error: fetchError } = await noteQuery.single()

    if (fetchError) {
      console.error('Note fetch error:', fetchError)
      return createErrorResponse(new Error('Note not found'))
    }

    // Check if already processed
    if (note.processed_at && !forceReprocess) {
      return NextResponse.json({
        success: true,
        note,
        message: 'Note already processed'
      })
    }

    // Check processing quota (skip for service auth)
    if (user && !isServiceAuth) {
      const quotaCheck = await quotaManager.checkProcessingQuota(user.id)
      if (!quotaCheck.allowed) {
        return createErrorResponse(
          new Error('Processing quota exceeded'),
          {
            details: quotaCheck.reason,
            usage: quotaCheck.usage,
            limits: quotaCheck.limits
          }
        )
      }

      // Record processing attempt
      await quotaManager.recordProcessingAttempt(user.id)
    }

    // Delegate processing to the service with retry logic for transient errors
    const userId = user?.id || note.user_id // Use note's user_id if service auth
    console.log('⚙️ Calling processingService.processNote with retry logic...', { noteId, userId, forceReprocess })
    
    // Check circuit breaker before processing
    if (circuitBreaker.isOpen(`processing_${userId}`)) {
      console.error('🔌 Circuit breaker open for user:', userId)
      
      // Queue for later retry if circuit is open
      retryQueue.enqueue(
        `process_${noteId}`,
        () => processingService.processNote(noteId, userId, forceReprocess),
        {
          maxAttempts: 3,
          baseDelayMs: 5000,
          retryableErrors: ['openai', 'rate_limit', 'timeout', 'network']
        }
      )
      
      return NextResponse.json({
        error: 'Service temporarily unavailable due to high error rate',
        type: ErrorTypeEnum.RATE_LIMIT,
        details: 'Your request has been queued and will be processed automatically when the service recovers.',
        code: 'CIRCUIT_BREAKER_OPEN',
        timestamp: new Date().toISOString()
      }, { status: 503 })
    }
    
    // Wrap processing with retry logic
    const retryResult = await retryOpenAIOperation(
      () => processingService.processNote(noteId, userId, forceReprocess),
      'processNote'
    )
    
    if (!retryResult.success) {
      console.error('❌ Processing failed after retries:', retryResult.error)
      console.log(`📊 Total attempts: ${retryResult.attempts}, Total delay: ${retryResult.totalDelayMs}ms`)
      
      // Record circuit breaker failure
      circuitBreaker.recordFailure(`processing_${userId}`)
      
      // Queue for background retry if it's a transient error
      const errorMessage = retryResult.error?.message || ''
      if (errorMessage.includes('rate_limit') || errorMessage.includes('timeout')) {
        const queued = retryQueue.enqueue(
          `process_${noteId}`,
          () => processingService.processNote(noteId, userId, forceReprocess)
        )
        
        if (queued) {
          console.log('📋 Request queued for background retry:', noteId)
          return NextResponse.json({
            error: 'Processing temporarily delayed',
            type: ErrorTypeEnum.PROCESSING,
            details: 'Your request is being processed in the background. Please check back in a few minutes.',
            code: 'QUEUED_FOR_RETRY',
            timestamp: new Date().toISOString()
          }, { status: 202 })
        }
      }
      
      return createErrorResponse(retryResult.error || new Error('Processing failed'))
    }
    
    const result = retryResult.data!
    console.log('📊 Processing result:', { success: result.success, error: result.error, warning: result.warning, attempts: retryResult.attempts })

    if (!result.success) {
      console.error('❌ Processing returned failure:', result.error)
      return createErrorResponse(new Error(result.error || 'Processing failed'))
    }

    // Get updated note
    const { data: updatedNote, error: updateError } = await supabase
      .from('notes')
      .select('*')
      .eq('id', noteId)
      .single()

    if (updateError) {
      console.error('Error fetching updated note:', updateError)
      return createErrorResponse(new Error('Failed to fetch updated note'))
    }

    console.log('Processing completed successfully for note:', noteId)

    return NextResponse.json({
      success: true,
      note: updatedNote,
      message: 'Processing completed successfully',
      warning: result.warning
    })

  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error('💥 API PROCESSING ERROR:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString()
    })
    return createErrorResponse(error)
  }
}

// Batch processing endpoint
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return createErrorResponse(new Error('Unauthorized'))
    }

    // Delegate batch processing to the service
    const batchResult = await processingService.processNextBatch(5)

    return NextResponse.json({
      success: true,
      processed: batchResult.processed,
      failed: batchResult.failed,
      errors: batchResult.errors,
      message: `Batch processing completed: ${batchResult.processed} successful, ${batchResult.failed} failed`
    })

  } catch (error) {
    return createErrorResponse(error)
  }
}