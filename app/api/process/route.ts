import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { processingService } from '@/lib/processing/ProcessingService'
import { quotaManager } from '@/lib/quota-manager'
import type { ErrorResponse, ErrorType, UsageInfo, RateLimitInfo } from '@/lib/types/api'

// Error categorization and mapping
enum ErrorTypeEnum {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NOT_FOUND = 'not_found',
  RATE_LIMIT = 'rate_limit',
  QUOTA_EXCEEDED = 'quota_exceeded',
  EXTERNAL_SERVICE = 'external_service',
  STORAGE = 'storage_error',
  PROCESSING = 'processing_error',
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
        details: 'Please log in to continue',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString(),
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
        details: 'You do not have permission to perform this action',
        code: 'ACCESS_DENIED',
        timestamp: new Date().toISOString()
      }
    }
  }

  // Not found errors
  if (lowerMessage.includes('not found') || lowerMessage.includes('does not exist') || 
      lowerMessage.includes('no rows returned')) {
    return {
      type: ErrorTypeEnum.NOT_FOUND,
      statusCode: 404,
      response: {
        error: 'Resource not found',
        details: 'The requested note or resource could not be found',
        code: 'NOT_FOUND',
        timestamp: new Date().toISOString()
      }
    }
  }

      // External service errors (OpenAI, etc.) - check before rate limits
    if (lowerMessage.includes('openai') || lowerMessage.includes('api key') || 
        lowerMessage.includes('invalid file') || lowerMessage.includes('file too large') ||
        lowerMessage.includes('transcription failed') || lowerMessage.includes('analysis failed')) {
      return {
        type: ErrorTypeEnum.EXTERNAL_SERVICE,
        statusCode: 502,
        response: {
          error: 'External service error',
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
          details: 'Too many requests. Please wait before trying again.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: 60, // 1 minute
          timestamp: new Date().toISOString()
        }
      }
    }

    // Quota exceeded errors
    if (lowerMessage.includes('quota exceeded') || lowerMessage.includes('processing quota') || 
        lowerMessage.includes('storage limit') || lowerMessage.includes('maximum')) {
      return {
        type: ErrorTypeEnum.QUOTA_EXCEEDED,
        statusCode: 429,
        response: {
          error: 'Quota exceeded',
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
        details: 'Unable to process the audio file. Please check the file format and try again.',
        code: 'PROCESSING_ERROR',
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
  if (type === ErrorTypeEnum.RATE_LIMIT && response.retryAfter) {
    headers['Retry-After'] = response.retryAfter.toString()
  }

  console.error(`[${type}] Processing error:`, error)
  
  return NextResponse.json(response, { 
    status: statusCode,
    headers
  })
}

export async function POST(request: NextRequest) {
  try {
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
                         authHeader?.includes(process.env.SUPABASE_SERVICE_KEY || '')
    
    if (!user && !isServiceAuth) {
      return createErrorResponse(new Error('Unauthorized'))
    }

    const body = await request.json()
    const { noteId, forceReprocess = false } = body

    if (!noteId) {
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

    // Delegate processing to the service
    const userId = user?.id || note.user_id // Use note's user_id if service auth
    const result = await processingService.processNote(noteId, userId, forceReprocess)

    if (!result.success) {
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
    return createErrorResponse(error)
  }
}

// Batch processing endpoint
export async function PUT(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
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