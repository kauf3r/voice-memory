# Enhanced Error Handling System

## Overview

The process API route (`app/api/process/route.ts`) now includes a comprehensive error handling system that properly categorizes errors and returns appropriate HTTP status codes with user-friendly messages.

## Error Categories

### 1. Authentication Errors (401)
**Triggers:** Unauthorized, authentication failed, invalid token, token expired
**Response:**
```json
{
  "error": "Authentication required",
  "details": "Please log in to continue",
  "code": "AUTH_REQUIRED"
}
```

### 2. Authorization Errors (403)
**Triggers:** Forbidden, access denied, insufficient permissions
**Response:**
```json
{
  "error": "Access denied",
  "details": "You do not have permission to perform this action",
  "code": "ACCESS_DENIED"
}
```

### 3. Validation Errors (400)
**Triggers:** Validation, invalid, required, missing fields
**Response:**
```json
{
  "error": "Invalid request",
  "details": "Specific validation error message",
  "code": "VALIDATION_ERROR"
}
```

### 4. Not Found Errors (404)
**Triggers:** Not found, does not exist, no rows returned
**Response:**
```json
{
  "error": "Resource not found",
  "details": "The requested note or resource could not be found",
  "code": "NOT_FOUND"
}
```

### 5. External Service Errors (502)
**Triggers:** OpenAI, API key, invalid file, file too large, transcription failed, analysis failed
**Response:**
```json
{
  "error": "External service error",
  "details": "The processing service is temporarily unavailable. Please try again later.",
  "code": "EXTERNAL_SERVICE_ERROR"
}
```

### 6. Rate Limit Errors (429)
**Triggers:** Rate limit, too many requests, rate_limit_exceeded
**Response:**
```json
{
  "error": "Rate limit exceeded",
  "details": "Too many requests. Please wait before trying again.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
}
```
**Headers:** `Retry-After: 60`

### 7. Quota Exceeded Errors (429)
**Triggers:** Quota exceeded, processing quota, storage limit, maximum
**Response:**
```json
{
  "error": "Quota exceeded",
  "details": "You have reached your processing limit. Please wait or upgrade your plan.",
  "code": "QUOTA_EXCEEDED",
  "usage": { /* quota usage details */ },
  "limits": { /* quota limits */ }
}
```

### 8. Storage Errors (500)
**Triggers:** Storage, file, audio file, download
**Response:**
```json
{
  "error": "Storage error",
  "details": "Unable to access the audio file. Please try again or contact support.",
  "code": "STORAGE_ERROR"
}
```

### 9. Processing Errors (422)
**Triggers:** Processing, analysis, transcription, validation
**Response:**
```json
{
  "error": "Processing failed",
  "details": "Unable to process the audio file. Please check the file format and try again.",
  "code": "PROCESSING_ERROR"
}
```

### 10. Internal Errors (500)
**Triggers:** Any error not matching the above patterns
**Response:**
```json
{
  "error": "Internal server error",
  "details": "An unexpected error occurred. Please try again later.",
  "code": "INTERNAL_ERROR"
}
```

## Implementation Details

### Error Categorization Function

The `categorizeError` function analyzes error messages and maps them to appropriate error types:

```typescript
function categorizeError(error: any): { 
  type: ErrorType; 
  statusCode: number; 
  response: ErrorResponse 
}
```

### Error Response Creation

The `createErrorResponse` function creates standardized error responses:

```typescript
function createErrorResponse(error: any, additionalData?: any): NextResponse
```

### Key Features

1. **Pattern Matching:** Uses case-insensitive string matching to categorize errors
2. **Priority Order:** External service errors are checked before rate limit errors to avoid misclassification
3. **Additional Data:** Supports passing additional context (e.g., quota usage details)
4. **HTTP Headers:** Automatically adds `Retry-After` header for rate limit errors
5. **Structured Logging:** Logs error type and details for debugging

## Usage Examples

### Basic Error Handling
```typescript
try {
  // Processing logic
} catch (error) {
  return createErrorResponse(error)
}
```

### Error with Additional Data
```typescript
return createErrorResponse(
  new Error('Processing quota exceeded'),
  {
    details: quotaCheck.reason,
    usage: quotaCheck.usage,
    limits: quotaCheck.limits
  }
)
```

## Testing

The error handling system includes comprehensive tests in `__tests__/lib/error-handling.test.ts` that verify:

- Correct error categorization for all error types
- Proper HTTP status codes
- User-friendly error messages
- Response structure consistency
- Retry-After header inclusion

## Best Practices

1. **Consistent Error Messages:** All error messages are user-friendly and actionable
2. **Proper Status Codes:** Each error type maps to the most appropriate HTTP status code
3. **Error Codes:** Include machine-readable error codes for frontend handling
4. **Retry Logic:** Provide retry guidance for transient errors
5. **Logging:** Log error types and details for monitoring and debugging

## Frontend Integration

The frontend can use the error codes to implement specific handling:

```typescript
if (response.code === 'RATE_LIMIT_EXCEEDED') {
  // Show retry countdown
  const retryAfter = response.retryAfter || 60
  showRetryMessage(retryAfter)
} else if (response.code === 'QUOTA_EXCEEDED') {
  // Show upgrade prompt
  showUpgradePrompt(response.usage, response.limits)
} else if (response.code === 'EXTERNAL_SERVICE_ERROR') {
  // Show temporary error message
  showTemporaryError(response.details)
}
```

## Monitoring and Alerting

The error categorization system enables better monitoring:

- Track error types by frequency
- Alert on specific error patterns (e.g., external service failures)
- Monitor quota usage and rate limiting
- Identify processing bottlenecks

## Future Enhancements

1. **Error Recovery:** Implement automatic retry mechanisms for transient errors
2. **Circuit Breaker:** Add circuit breaker pattern for external service calls
3. **Error Analytics:** Track error patterns and user impact
4. **Custom Error Types:** Allow services to define custom error types
5. **Internationalization:** Support localized error messages 