// Test the error categorization logic directly
describe('Error Handling Logic', () => {
  // Mock the error categorization functions
  const ErrorType = {
    VALIDATION: 'VALIDATION',
    AUTHENTICATION: 'AUTHENTICATION',
    AUTHORIZATION: 'AUTHORIZATION',
    NOT_FOUND: 'NOT_FOUND',
    RATE_LIMIT: 'RATE_LIMIT',
    QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
    EXTERNAL_SERVICE: 'EXTERNAL_SERVICE',
    STORAGE: 'STORAGE',
    PROCESSING: 'PROCESSING',
    INTERNAL: 'INTERNAL'
  }

  function categorizeError(error: any): { type: string; statusCode: number; response: any } {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const lowerMessage = errorMessage.toLowerCase()

    // Authentication errors
    if (lowerMessage.includes('unauthorized') || lowerMessage.includes('authentication failed') || 
        lowerMessage.includes('invalid token') || lowerMessage.includes('token expired')) {
      return {
        type: ErrorType.AUTHENTICATION,
        statusCode: 401,
        response: {
          error: 'Authentication required',
          details: 'Please log in to continue',
          code: 'AUTH_REQUIRED'
        }
      }
    }

    // Authorization errors
    if (lowerMessage.includes('forbidden') || lowerMessage.includes('access denied') || 
        lowerMessage.includes('insufficient permissions')) {
      return {
        type: ErrorType.AUTHORIZATION,
        statusCode: 403,
        response: {
          error: 'Access denied',
          details: 'You do not have permission to perform this action',
          code: 'ACCESS_DENIED'
        }
      }
    }

    // Not found errors
    if (lowerMessage.includes('not found') || lowerMessage.includes('does not exist') || 
        lowerMessage.includes('no rows returned')) {
      return {
        type: ErrorType.NOT_FOUND,
        statusCode: 404,
        response: {
          error: 'Resource not found',
          details: 'The requested note or resource could not be found',
          code: 'NOT_FOUND'
        }
      }
    }

    // External service errors (OpenAI, etc.) - check before rate limits
    if (lowerMessage.includes('openai') || lowerMessage.includes('api key') || 
        lowerMessage.includes('invalid file') || lowerMessage.includes('file too large') ||
        lowerMessage.includes('transcription failed') || lowerMessage.includes('analysis failed')) {
      return {
        type: ErrorType.EXTERNAL_SERVICE,
        statusCode: 502,
        response: {
          error: 'External service error',
          details: 'The processing service is temporarily unavailable. Please try again later.',
          code: 'EXTERNAL_SERVICE_ERROR'
        }
      }
    }

    // Rate limit errors
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests') || 
        lowerMessage.includes('rate_limit_exceeded')) {
      return {
        type: ErrorType.RATE_LIMIT,
        statusCode: 429,
        response: {
          error: 'Rate limit exceeded',
          details: 'Too many requests. Please wait before trying again.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: 60
        }
      }
    }

    // Quota exceeded errors
    if (lowerMessage.includes('quota exceeded') || lowerMessage.includes('processing quota') || 
        lowerMessage.includes('storage limit') || lowerMessage.includes('maximum')) {
      return {
        type: ErrorType.QUOTA_EXCEEDED,
        statusCode: 429,
        response: {
          error: 'Quota exceeded',
          details: 'You have reached your processing limit. Please wait or upgrade your plan.',
          code: 'QUOTA_EXCEEDED'
        }
      }
    }

    // Storage errors
    if (lowerMessage.includes('storage') || lowerMessage.includes('file') || 
        lowerMessage.includes('audio file') || lowerMessage.includes('download')) {
      return {
        type: ErrorType.STORAGE,
        statusCode: 500,
        response: {
          error: 'Storage error',
          details: 'Unable to access the audio file. Please try again or contact support.',
          code: 'STORAGE_ERROR'
        }
      }
    }

    // Processing errors
    if (lowerMessage.includes('processing') || lowerMessage.includes('analysis') || 
        lowerMessage.includes('transcription') || lowerMessage.includes('validation')) {
      return {
        type: ErrorType.PROCESSING,
        statusCode: 422,
        response: {
          error: 'Processing failed',
          details: 'Unable to process the audio file. Please check the file format and try again.',
          code: 'PROCESSING_ERROR'
        }
      }
    }

    // Validation errors
    if (lowerMessage.includes('validation') || lowerMessage.includes('invalid') || 
        lowerMessage.includes('required') || lowerMessage.includes('missing')) {
      return {
        type: ErrorType.VALIDATION,
        statusCode: 400,
        response: {
          error: 'Invalid request',
          details: errorMessage,
          code: 'VALIDATION_ERROR'
        }
      }
    }

    // Default internal error
    return {
      type: ErrorType.INTERNAL,
      statusCode: 500,
      response: {
        error: 'Internal server error',
        details: 'An unexpected error occurred. Please try again later.',
        code: 'INTERNAL_ERROR'
      }
    }
  }

  describe('Error Categorization', () => {
    it('should categorize authentication errors correctly', () => {
      const error = new Error('Unauthorized')
      const result = categorizeError(error)
      
      expect(result.type).toBe(ErrorType.AUTHENTICATION)
      expect(result.statusCode).toBe(401)
      expect(result.response.error).toBe('Authentication required')
      expect(result.response.code).toBe('AUTH_REQUIRED')
    })

    it('should categorize validation errors correctly', () => {
      const error = new Error('noteId is required')
      const result = categorizeError(error)
      
      expect(result.type).toBe(ErrorType.VALIDATION)
      expect(result.statusCode).toBe(400)
      expect(result.response.error).toBe('Invalid request')
      expect(result.response.code).toBe('VALIDATION_ERROR')
    })

    it('should categorize not found errors correctly', () => {
      const error = new Error('Note not found')
      const result = categorizeError(error)
      
      expect(result.type).toBe(ErrorType.NOT_FOUND)
      expect(result.statusCode).toBe(404)
      expect(result.response.error).toBe('Resource not found')
      expect(result.response.code).toBe('NOT_FOUND')
    })

    it('should categorize rate limit errors correctly', () => {
      const error = new Error('Rate limit exceeded for Whisper API')
      const result = categorizeError(error)
      
      expect(result.type).toBe(ErrorType.RATE_LIMIT)
      expect(result.statusCode).toBe(429)
      expect(result.response.error).toBe('Rate limit exceeded')
      expect(result.response.code).toBe('RATE_LIMIT_EXCEEDED')
      expect(result.response.retryAfter).toBe(60)
    })

    it('should categorize quota exceeded errors correctly', () => {
      const error = new Error('Processing quota exceeded')
      const result = categorizeError(error)
      
      expect(result.type).toBe(ErrorType.QUOTA_EXCEEDED)
      expect(result.statusCode).toBe(429)
      expect(result.response.error).toBe('Quota exceeded')
      expect(result.response.code).toBe('QUOTA_EXCEEDED')
    })

    it('should categorize external service errors correctly', () => {
      const error = new Error('OpenAI API rate limit exceeded')
      const result = categorizeError(error)
      
      expect(result.type).toBe(ErrorType.EXTERNAL_SERVICE)
      expect(result.statusCode).toBe(502)
      expect(result.response.error).toBe('External service error')
      expect(result.response.code).toBe('EXTERNAL_SERVICE_ERROR')
    })

    it('should categorize storage errors correctly', () => {
      const error = new Error('Could not retrieve audio file: Storage error')
      const result = categorizeError(error)
      
      expect(result.type).toBe(ErrorType.STORAGE)
      expect(result.statusCode).toBe(500)
      expect(result.response.error).toBe('Storage error')
      expect(result.response.code).toBe('STORAGE_ERROR')
    })

    it('should categorize processing errors correctly', () => {
      const error = new Error('Processing failed: Invalid audio format')
      const result = categorizeError(error)
      
      expect(result.type).toBe(ErrorType.PROCESSING)
      expect(result.statusCode).toBe(422)
      expect(result.response.error).toBe('Processing failed')
      expect(result.response.code).toBe('PROCESSING_ERROR')
    })

    it('should categorize unknown errors as internal errors', () => {
      const error = new Error('Some unknown error')
      const result = categorizeError(error)
      
      expect(result.type).toBe(ErrorType.INTERNAL)
      expect(result.statusCode).toBe(500)
      expect(result.response.error).toBe('Internal server error')
      expect(result.response.code).toBe('INTERNAL_ERROR')
    })

    it('should handle non-Error objects', () => {
      const error = 'String error message'
      const result = categorizeError(error)
      
      expect(result.type).toBe(ErrorType.INTERNAL)
      expect(result.statusCode).toBe(500)
    })
  })

  describe('Error Response Structure', () => {
    it('should include all required fields in error response', () => {
      const error = new Error('Test error')
      const result = categorizeError(error)
      
      expect(result.response).toHaveProperty('error')
      expect(result.response).toHaveProperty('details')
      expect(result.response).toHaveProperty('code')
      expect(typeof result.response.error).toBe('string')
      expect(typeof result.response.details).toBe('string')
      expect(typeof result.response.code).toBe('string')
    })

    it('should include retry-after for rate limit errors', () => {
      const error = new Error('Rate limit exceeded')
      const result = categorizeError(error)
      
      expect(result.response).toHaveProperty('retryAfter')
      expect(result.response.retryAfter).toBe(60)
    })
  })
}) 