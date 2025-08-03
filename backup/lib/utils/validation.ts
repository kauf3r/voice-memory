/**
 * Input validation and sanitization utilities for API endpoints
 * Provides protection against common vulnerabilities and data integrity
 */

/**
 * Validates that a string is a valid task ID format
 */
export function validateTaskId(taskId: string): { isValid: boolean; error?: string } {
  if (!taskId || typeof taskId !== 'string') {
    return { isValid: false, error: 'Task ID must be a non-empty string' }
  }
  
  if (taskId.length > 200) {
    return { isValid: false, error: 'Task ID is too long' }
  }
  
  // Basic pattern check for task IDs (UUIDs or custom format)
  const taskIdPattern = /^[a-zA-Z0-9_-]+$/
  if (!taskIdPattern.test(taskId)) {
    return { isValid: false, error: 'Task ID contains invalid characters' }
  }
  
  return { isValid: true }
}

/**
 * Validates and sanitizes filter parameters
 */
export function validateFilter(filter: any): { isValid: boolean; sanitized?: any; error?: string } {
  if (!filter || typeof filter !== 'object') {
    return { isValid: false, error: 'Filter must be an object' }
  }
  
  const allowedTypes = ['date', 'status', 'type']
  if (!filter.type || !allowedTypes.includes(filter.type)) {
    return { isValid: false, error: 'Invalid filter type' }
  }
  
  // Sanitize filter value
  let sanitizedValue = filter.value
  if (typeof sanitizedValue === 'string') {
    sanitizedValue = sanitizedValue.trim().substring(0, 100) // Limit length
  }
  
  return {
    isValid: true,
    sanitized: {
      type: filter.type,
      value: sanitizedValue
    }
  }
}

/**
 * Validates authorization header
 */
export function validateAuthHeader(authHeader: string | null): { isValid: boolean; token?: string; error?: string } {
  if (!authHeader) {
    return { isValid: false, error: 'Authorization header is required' }
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    return { isValid: false, error: 'Authorization header must use Bearer token' }
  }
  
  const token = authHeader.slice(7) // Remove 'Bearer '
  
  if (!token || token.length < 20) {
    return { isValid: false, error: 'Invalid token format' }
  }
  
  return { isValid: true, token }
}

/**
 * Sanitizes error messages to prevent information disclosure
 */
export function sanitizeErrorMessage(error: any): string {
  if (!error) return 'Unknown error occurred'
  
  if (typeof error === 'string') {
    return error.substring(0, 200) // Limit error message length
  }
  
  if (error.message) {
    // Remove sensitive patterns from error messages
    let message = error.message.toString()
    
    // Remove potential SQL injection patterns
    message = message.replace(/DROP|DELETE|INSERT|UPDATE|SELECT/gi, '[SQL_COMMAND]')
    
    // Remove file paths
    message = message.replace(/\/[^\s]+/g, '[PATH]')
    
    // Remove potential API keys
    message = message.replace(/[a-zA-Z0-9]{32,}/g, '[REDACTED]')
    
    return message.substring(0, 200)
  }
  
  return 'Operation failed'
}

/**
 * Rate limiting helper (basic implementation)
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(identifier: string, maxRequests = 100, windowMs = 60000): { allowed: boolean; remaining?: number } {
  const now = Date.now()
  const existing = requestCounts.get(identifier)
  
  if (!existing || now > existing.resetTime) {
    // Reset window
    requestCounts.set(identifier, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1 }
  }
  
  if (existing.count >= maxRequests) {
    return { allowed: false, remaining: 0 }
  }
  
  existing.count++
  return { allowed: true, remaining: maxRequests - existing.count }
}

/**
 * Validates request method
 */
export function validateMethod(method: string, allowedMethods: string[]): { isValid: boolean; error?: string } {
  if (!allowedMethods.includes(method)) {
    return { isValid: false, error: `Method ${method} not allowed` }
  }
  return { isValid: true }
}

/**
 * General request validation helper
 */
export function validateRequest(request: Request): {
  isValid: boolean
  auth?: { token: string }
  errors?: string[]
} {
  const errors: string[] = []
  
  // Validate method (basic check)
  const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  if (!allowedMethods.includes(request.method)) {
    errors.push(`Method ${request.method} not allowed`)
  }
  
  // Validate auth header
  const authHeader = request.headers.get('authorization')
  const authValidation = validateAuthHeader(authHeader)
  
  let auth: { token: string } | undefined
  if (authValidation.isValid && authValidation.token) {
    auth = { token: authValidation.token }
  } else if (authValidation.error) {
    errors.push(authValidation.error)
  }
  
  return {
    isValid: errors.length === 0,
    auth,
    errors
  }
}