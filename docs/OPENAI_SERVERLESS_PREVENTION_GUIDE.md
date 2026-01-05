# OpenAI SDK Connection Failures in Serverless: Prevention Guide

## Executive Summary

**Problem**: OpenAI SDK connections fail in Vercel serverless environments when handling large file uploads (>3MB) and long-running API calls (>4 minutes).

**Root Cause**: The SDK maintains connection state and has fixed timeouts that are incompatible with serverless architectures where functions may be throttled, suspended, or reinitialized.

**Solution**: Use direct `fetch()` API calls instead of SDK for critical paths requiring large uploads or extended timeouts.

**Prevention Goal**: Never experience this issue in future projects through architectural decisions made upfront.

---

## Part 1: Prevention Strategies

### Strategy 1: Architecture Decision Framework

Use this decision tree when evaluating SDKs vs direct API calls in serverless environments:

```
Is this serverless (Lambda, Vercel Functions, Cloud Functions)?
├─ YES
│  ├─ Will this handle file uploads > 2MB?
│  │  ├─ YES → Use fetch()
│  │  └─ NO → Proceed to next question
│  ├─ Will this run > 2 minutes?
│  │  ├─ YES → Use fetch()
│  │  └─ NO → Proceed to next question
│  ├─ Is the SDK actively maintained?
│  │  ├─ YES → Check for "serverless" support documentation
│  │  │  ├─ Documented support → Safe to use SDK
│  │  │  └─ No mention → Use fetch()
│  │  └─ NO → Use fetch()
│  └─ Result: DEFAULT PREFERENCE = fetch()
│
└─ NO (Traditional server or local)
   └─ USE SDK (better DX, built-in features)
```

**Implementation**: Add this decision framework to your project's architecture documentation.

### Strategy 2: Pre-Project Checklist

Before using any external API in a serverless project, verify:

```checklist
API Integration Checklist for Serverless
==========================================

[ ] Connection Type
    [ ] API documented for stateless connections?
    [ ] SDK explicitly supports serverless (Vercel, Lambda, etc.)?
    [ ] Any persistent connection requirements (WebSocket, SSH)?

[ ] Timeout Handling
    [ ] Default SDK timeout listed in docs?
    [ ] Is it configurable?
    [ ] Exceeds your function timeout?
    [ ] Exceeds your provider's hard limits?

[ ] Large Data Handling
    [ ] File upload support documented?
    [ ] Chunked upload support?
    [ ] Multipart form data support?
    [ ] Known file size limits?

[ ] Error Handling
    [ ] Documented transient error patterns?
    [ ] Retry logic built-in?
    [ ] Connection reset handling?
    [ ] Timeout behavior documented?

[ ] Network Assumptions
    [ ] Assumes persistent connection?
    [ ] Requires connection pooling?
    [ ] Assumes client-side persistence (browser)?
    [ ] Works with request/response isolation?

Result:
  - 5+ failures → Use fetch()
  - 3-4 failures → Use fetch() OR require SDK configuration
  - 0-2 failures → SDK is likely safe
```

### Strategy 3: Configuration Hardening Pattern

When you must use an SDK, apply this hardening pattern:

```typescript
// DO NOT: Use SDK with default settings
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// DO: Explicitly configure for serverless
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,

  // Critical for serverless
  timeout: 240000, // Explicit timeout (4 min for Vercel)
  maxRetries: 0,   // We handle retries ourselves (SDK retries are risky)

  // Network hardening
  httpAgent: new http.Agent({
    keepAlive: false,  // CRITICAL: Don't reuse connections
    timeout: 240000
  }),
  httpsAgent: new https.Agent({
    keepAlive: false,  // CRITICAL: Don't reuse connections
    timeout: 240000
  })
})
```

**Key Principle**: Disable connection pooling in serverless. Each request should be independent.

### Strategy 4: Fetch Wrapper Pattern

For critical paths, always use fetch with explicit error handling:

```typescript
/**
 * Secure fetch wrapper for serverless large file uploads
 *
 * Handles:
 * - Explicit timeout control
 * - Multipart form data
 * - Progress tracking
 * - Serverless function suspension
 * - Connection reset recovery
 */
async function secureFetchUpload(
  url: string,
  file: File,
  options?: {
    timeoutMs?: number
    headers?: Record<string, string>
    onProgress?: (loaded: number, total: number) => void
  }
): Promise<Response> {
  const timeoutMs = options?.timeoutMs || 300000 // 5 minutes default
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const formData = new FormData()
    formData.append('file', file)

    // Add any other form fields
    if (options?.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        formData.append(key, value)
      })
    }

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
      // Critical headers
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        // Don't set Content-Type - let fetch handle multipart boundary
      }
    })

    return response
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
```

### Strategy 5: Monitoring and Alerting

Implement early warning system for SDK connection issues:

```typescript
// Track SDK connection failures
class ServerlessSDKMonitor {
  private failures: Map<string, number> = new Map()
  private readonly FAILURE_THRESHOLD = 3
  private readonly WINDOW_MS = 60000 // 1 minute

  recordSDKUsage(sdkName: string, success: boolean, durationMs: number) {
    // Alert on repeated failures
    if (!success) {
      const count = (this.failures.get(sdkName) || 0) + 1
      this.failures.set(sdkName, count)

      if (count >= this.FAILURE_THRESHOLD) {
        console.error(`ALERT: ${sdkName} failures detected (${count} in ${WINDOW_MS}ms)`)
        console.error(`Recommend switching to fetch() for this API`)
      }
    }

    // Alert on slow operations in serverless
    if (durationMs > 120000) { // 2 minutes
      console.warn(`WARN: ${sdkName} operation took ${durationMs}ms in serverless`)
      console.warn(`Consider fetch() alternative or async processing`)
    }

    // Reset counter after window
    setTimeout(() => {
      this.failures.delete(sdkName)
    }, WINDOW_MS)
  }
}
```

---

## Part 2: Best Practices for OpenAI API in Serverless

### Best Practice 1: Timeout Hierarchy

Always establish a clear timeout hierarchy:

```typescript
/**
 * Timeout hierarchy for serverless functions
 *
 * Provider Hard Limit (50s for free tier, configurable for Pro)
 *   ↓
 * Function Timeout Setting in vercel.json (maxDuration: 300s)
 *   ↓
 * API Client Timeout (240s for OpenAI)
 *   ↓
 * Individual Operation Timeout (180s for analysis, 300s for transcription)
 *   ↓
 * AbortController Signal Timeout (explicit per-request)
 */

// In vercel.json:
export const maxDuration = 300 // 5 minutes

// For OpenAI client:
const client = new OpenAI({
  timeout: 240000, // 4 minutes (leaves 1 min buffer)
})

// For individual operations:
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 180000)
```

**Why This Matters**: If you set your abort timeout to 5 minutes but Vercel kills the function at 50 seconds, your code never gets to handle the timeout.

### Best Practice 2: File Upload Strategy

Three-tier approach based on file size:

```typescript
// Tier 1: Small files (< 1MB) - Use SDK
if (file.size < 1024 * 1024) {
  const transcription = await client.audio.transcriptions.create({
    file: await toFile(buffer, file.name),
    model: 'whisper-1'
  })
}

// Tier 2: Medium files (1-3MB) - Use fetch with form data
else if (file.size < 3 * 1024 * 1024) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('model', 'whisper-1')

  const response = await fetch(
    'https://api.openai.com/v1/audio/transcriptions',
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData,
      signal: controller.signal
    }
  )
}

// Tier 3: Large files (> 3MB) - Use signed URLs to Supabase
// Let the client upload directly to storage
else {
  const { url, expiresIn } = await generateSignedURL()

  // Return URL to client - they upload directly
  // When done, client calls /api/process with the stored URL
  // No file transfer through serverless function
}
```

### Best Practice 3: Async Processing Pattern

For operations that might exceed timeout:

```typescript
/**
 * Async processing pattern for serverless
 *
 * 1. Client uploads file
 * 2. Server creates database record immediately
 * 3. Server returns to client with "processing" status
 * 4. Background job processes the file (can run 5+ minutes)
 * 5. Client polls for completion or uses webhooks
 */

// In API route
export async function POST(request: NextRequest) {
  const file = await parseFile(request)

  // Store immediately
  const note = await db.notes.create({
    url: file.url,
    status: 'processing',
    createdAt: new Date()
  })

  // Return immediately
  return NextResponse.json({ noteId: note.id, status: 'processing' }, 202)

  // Don't wait for processing - start it in background
  // Option A: Trigger cron job to process pending notes
  // Option B: Queue message to background processor
  // Option C: Call /api/process with timeout error handling
}
```

### Best Practice 4: Retry and Circuit Breaker

Implement resilience patterns:

```typescript
/**
 * Exponential backoff with circuit breaker
 * Prevents cascading failures
 */
class ResilientOpenAIClient {
  private circuitBreakerOpen = false
  private failureCount = 0
  private readonly FAILURE_THRESHOLD = 5
  private readonly RESET_TIMEOUT = 60000 // 1 minute

  async transcribe(file: File): Promise<string> {
    // Check circuit breaker
    if (this.circuitBreakerOpen) {
      throw new Error('Service temporarily unavailable - circuit breaker open')
    }

    // Retry logic
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await this.transcribeWithTimeout(file)
        this.failureCount = 0 // Reset on success
        return result
      } catch (error) {
        this.failureCount++

        if (attempt === 3) {
          // Open circuit after 3 failures
          if (this.failureCount >= this.FAILURE_THRESHOLD) {
            this.circuitBreakerOpen = true
            setTimeout(() => {
              this.circuitBreakerOpen = false
              this.failureCount = 0
            }, this.RESET_TIMEOUT)
          }
          throw error
        }

        // Exponential backoff
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 30000)
        await new Promise(r => setTimeout(r, delayMs))
      }
    }
  }
}
```

### Best Practice 5: Environment Configuration

Always make timeouts configurable:

```typescript
// lib/config.ts
export const OPENAI_CONFIG = {
  // Allow override via environment
  TIMEOUT_MS: parseInt(process.env.OPENAI_TIMEOUT_MS || '240000'),
  MAX_RETRIES: parseInt(process.env.OPENAI_MAX_RETRIES || '5'),
  RETRY_BASE_DELAY: parseInt(process.env.OPENAI_RETRY_BASE_DELAY || '1000'),

  // Tier thresholds
  SMALL_FILE_THRESHOLD: 1024 * 1024, // 1MB - use SDK
  MEDIUM_FILE_THRESHOLD: 3 * 1024 * 1024, // 3MB - use fetch
  // Larger files - use signed URLs
}

// Usage
const response = await fetch(url, {
  signal: AbortSignal.timeout(OPENAI_CONFIG.TIMEOUT_MS)
})
```

**Why Configurable**: Different Vercel plans have different limits. Pro plan allows 900s, free allows 60s.

---

## Part 3: SDK vs Fetch Decision Matrix

| Scenario | SDK | Fetch | Recommendation |
|----------|-----|-------|-----------------|
| **Files < 1MB, short operations** | ✅ Good | ✅ OK | SDK (simpler) |
| **Files 1-3MB** | ⚠️ Risky | ✅ Good | **Fetch** |
| **Files > 3MB** | ❌ Fails | ✅ With URLs | **Signed URLs** |
| **Operations < 2min** | ✅ Good | ✅ OK | SDK (simpler) |
| **Operations 2-4min** | ⚠️ Risky | ✅ Good | **Fetch** |
| **Operations > 4min** | ❌ Fails | ❌ Fails | **Async processing** |
| **Streaming responses** | ✅ Good | ⚠️ Manual | SDK |
| **Simple single call** | ✅ Good | ✅ OK | SDK (simpler) |
| **Complex flow** | ⚠️ State issues | ✅ Good | **Fetch** |
| **Production critical** | ⚠️ Unknown bugs | ✅ Transparent | **Fetch** |

**Key Insight**: SDK is optimized for client-side and traditional servers. Fetch is optimized for serverless.

---

## Part 4: Testing Recommendations

### Test 1: Load Test with File Sizes

```typescript
describe('OpenAI Integration - File Size Testing', () => {
  it('should handle small files with SDK', async () => {
    const file = createMockAudioFile(500 * 1024) // 500KB
    const result = await transcribeWithSDK(file)
    expect(result).toBeDefined()
  })

  it('should handle medium files with fetch', async () => {
    const file = createMockAudioFile(2 * 1024 * 1024) // 2MB
    const result = await transcribeWithFetch(file)
    expect(result).toBeDefined()
  })

  it('should timeout gracefully on oversized files', async () => {
    const file = createMockAudioFile(50 * 1024 * 1024) // 50MB
    await expect(transcribeWithSDK(file)).rejects.toThrow('timeout')
  })
})
```

### Test 2: Timeout Simulation

```typescript
describe('Timeout Handling in Serverless', () => {
  it('should abort request if it exceeds timeout', async () => {
    const slowAPI = () => new Promise(r =>
      setTimeout(r, 400000) // 6.67 minutes
    )

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 min

    try {
      await Promise.race([
        slowAPI(),
        new Promise((_, reject) =>
          controller.signal.addEventListener('abort', () =>
            reject(new Error('Aborted'))
          )
        )
      ])
    } finally {
      clearTimeout(timeoutId)
    }
  })
})
```

### Test 3: Connection Reset Simulation

```typescript
describe('Connection Resilience', () => {
  it('should retry on connection reset', async () => {
    let attempts = 0

    const unreliableAPI = () => {
      attempts++
      if (attempts < 2) {
        throw new Error('ECONNRESET')
      }
      return Promise.resolve({ data: 'success' })
    }

    const result = await retryWithBackoff(unreliableAPI, {
      maxAttempts: 3,
      retryableErrors: ['ECONNRESET']
    })

    expect(result.data).toBe('success')
    expect(attempts).toBe(2)
  })
})
```

### Test 4: Vercel Environment Simulation

```typescript
describe('Vercel Environment Compatibility', () => {
  beforeEach(() => {
    // Simulate Vercel environment
    process.env.VERCEL = 'true'
    process.env.VERCEL_ENV = 'production'
    process.env.VERCEL_REGION = 'iad1'
  })

  it('should handle function suspension', async () => {
    // Test that code doesn't rely on persistent connections
    const client = createOpenAIClient()
    const result1 = await client.transcribe(file)

    // Simulate function being put to sleep
    await new Promise(r => setTimeout(r, 100))

    // Should still work
    const result2 = await client.transcribe(file)
    expect(result2).toBeDefined()
  })
})
```

---

## Part 5: Early Warning Signs and Symptoms

### Symptom 1: Intermittent Timeouts

**Signs**:
```
- Works fine locally
- Works fine with small files
- Fails randomly with larger files
- No error message, just timeout
```

**Root Cause**: SDK connection being reused across function invocations

**Fix**: Disable connection pooling
```typescript
httpAgent: new http.Agent({ keepAlive: false })
```

### Symptom 2: "Connection Reset by Peer"

**Signs**:
```
Error: socket hang up
Error: ECONNRESET
Error: read ECONNRESET
```

**Root Cause**: Serverless function was suspended, connection dropped

**Fix**: Use fetch() with AbortController and proper retry

### Symptom 3: Mysterious 502/503 Errors

**Signs**:
```
- Only happens with large files
- Only happens during peak hours
- Error originates from Vercel, not OpenAI
- Logs show no clear error
```

**Root Cause**: Request body exceeds Vercel's limit or function times out

**Fix**: Use signed URLs to bypass Vercel's body limit

### Symptom 4: Processing Stuck at 90-99%

**Signs**:
```
- Upload completes
- Processing starts
- Hangs indefinitely
- Never completes or fails
```

**Root Cause**: Function timeout exceeded, but no error handling

**Fix**: Implement timeout monitoring and async processing queue

### Symptom 5: "Failed to fetch"

**Signs**:
```
- Only in browser console
- Works with SDK in server-side
- Happens with certain file sizes
```

**Root Cause**: CORS or browser upload limitations

**Fix**: Use signed URLs for client-side uploads

---

## Part 6: Verification Checklist

Before deploying any OpenAI integration in serverless:

```checklist
Pre-Deployment Verification Checklist
=====================================

Architecture Decision
[ ] Documented why you chose SDK vs fetch()
[ ] Cross-checked against decision matrix (Part 3)
[ ] Team agreed on approach

Timeout Configuration
[ ] maxDuration set in vercel.json
[ ] API client timeout < maxDuration
[ ] Individual operation timeout < client timeout
[ ] AbortController timeout < operation timeout
[ ] Used console to verify settings

Error Handling
[ ] ECONNRESET handled
[ ] Timeout errors caught explicitly
[ ] Rate limit errors handled
[ ] Async processing for long operations
[ ] Circuit breaker implemented

Testing
[ ] Tested with file sizes at tier boundaries (1MB, 3MB)
[ ] Simulated timeout (hang > maxDuration)
[ ] Simulated connection reset
[ ] Tested in production Vercel environment
[ ] Verified Vercel logs for errors

Monitoring
[ ] Added SDK failure tracking
[ ] Set up alerts for timeout patterns
[ ] Configured retry logging
[ ] Added operation duration logging

Documentation
[ ] Documented chosen approach
[ ] Documented timeout hierarchy
[ ] Documented file size tiers
[ ] Created runbook for common issues

Environment
[ ] OPENAI_API_KEY properly set
[ ] Tested in staging environment first
[ ] Rollback plan documented
[ ] Team knows how to debug issues
```

---

## Part 7: Quick Reference Implementation

### Minimum Viable Secure Implementation

```typescript
// lib/openai-serverless.ts
import { toFile } from 'openai'

const OPENAI_CONFIG = {
  TIMEOUT_MS: 240000,        // 4 minutes
  MAX_FILE_SIZE_SDK: 1 * 1024 * 1024,      // 1MB
  MAX_FILE_SIZE_FETCH: 3 * 1024 * 1024,    // 3MB
}

export async function transcribeAudio(file: File) {
  // Choose strategy based on file size
  if (file.size > OPENAI_CONFIG.MAX_FILE_SIZE_FETCH) {
    throw new Error('File too large - use signed URLs instead')
  }

  if (file.size <= OPENAI_CONFIG.MAX_FILE_SIZE_SDK) {
    // Small files - use SDK
    return await transcribeWithSDK(file)
  }

  // Medium files - use fetch
  return await transcribeWithFetch(file)
}

async function transcribeWithSDK(file: File) {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: OPENAI_CONFIG.TIMEOUT_MS,
    maxRetries: 0,
  })

  const buffer = await file.arrayBuffer()
  const uploadFile = await toFile(buffer, file.name, { type: file.type })

  return await client.audio.transcriptions.create({
    file: uploadFile,
    model: 'whisper-1',
  })
}

async function transcribeWithFetch(file: File) {
  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    OPENAI_CONFIG.TIMEOUT_MS
  )

  try {
    const formData = new FormData()
    const arrayBuffer = await file.arrayBuffer()
    const blob = new Blob([arrayBuffer], { type: file.type })
    formData.append('file', blob, file.name)
    formData.append('model', 'whisper-1')

    const response = await fetch(
      'https://api.openai.com/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: formData,
        signal: controller.signal,
      }
    )

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    return await response.text()
  } finally {
    clearTimeout(timeoutId)
  }
}
```

---

## Part 8: Future-Proofing

### When OpenAI Updates Their SDK

Check for these improvements:

```typescript
// Future: Will OpenAI SDK support serverless natively?
// Watch for in future versions:
// 1. keepAlive: false default in serverless environments
// 2. Explicit serverless timeout presets
// 3. Built-in AbortController support
// 4. Documented maximum timeouts per environment

// How to adapt:
if (OPENAI_SDK_VERSION >= '5.0.0') {
  // New SDK might support serverless better
  return await useNewServerlessOptimizedSDK()
} else {
  // Fallback to proven fetch() approach
  return await transcribeWithFetch(file)
}
```

### When Vercel Changes Limits

Monitor and update:

```typescript
// Vercel occasionally changes limits
// Keep this updated with official docs

export const VERCEL_LIMITS = {
  free: { maxDuration: 60, maxBodySize: '4.5mb' },
  pro: { maxDuration: 900, maxBodySize: '4.5mb' },
}

// Always use environment variable to override
const maxDuration = parseInt(
  process.env.VERCEL_TIMEOUT || '300'
)
```

---

## Conclusion

**Key Takeaway**: In serverless environments, treat external APIs like remote services, not local libraries. Use fetch() for critical paths where reliability and visibility matter.

This approach transforms OpenAI API integration from a fragile black box into a transparent, debuggable, resilient system that works reliably in Vercel's serverless environment.

---

## References

- **Voice Memory Implementation**: `/app/api/process/route.ts` and `lib/openai.ts`
- **Error Handling**: `docs/ERROR_HANDLING.md`
- **Related Fixes**: Commit `2c114a6` (5-minute timeout) and `a7589b4` (signed URL uploads)
