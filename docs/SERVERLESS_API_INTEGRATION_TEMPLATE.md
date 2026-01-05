# Serverless API Integration Template

Use this template when integrating ANY external API into a serverless environment (Vercel, AWS Lambda, Google Cloud Functions, etc.).

---

## 1. API Assessment

**For**: _________________________________ API
**Date**: ________________________________
**Evaluated by**: _________________________

### 1.1 Connection Model
- [ ] Stateless (REST) - Safe for serverless
- [ ] Stateful (WebSocket, persistent) - Risky for serverless
- [ ] Hybrid - Check documentation

**Assessment**: _______________________________________________

### 1.2 Timeout Capabilities
- [ ] Fully configurable timeout
- [ ] Supports partial configuration
- [ ] Fixed timeout (non-configurable)

**API Default Timeout**: _________________
**Our Requirement**: _________________
**Assessment**: _______________________________________________

### 1.3 Large Data Handling
- [ ] Chunked uploads
- [ ] Multipart form data
- [ ] Streaming support
- [ ] File size limits: _________________

**Assessment**: _______________________________________________

### 1.4 SDK Status
- [ ] Official SDK available
- [ ] Community maintained
- [ ] Only official API available
- [ ] Serverless support documented: YES / NO

**Assessment**: _______________________________________________

### 1.5 Error Handling
- [ ] Connection reset handling
- [ ] Built-in retry logic
- [ ] Rate limiting detection
- [ ] Timeout error types

**Assessment**: _______________________________________________

---

## 2. Decision

Based on assessment above:

```
Use SDK if:
[ ] Stateless connections
[ ] Configurable timeout
[ ] Good serverless support
[ ] Simple use case
[ ] Team familiar with SDK

Use fetch() if:
[ ] Any connection concerns
[ ] Large files likely
[ ] Long operations likely
[ ] Critical reliability needed
[ ] Unknown serverless compatibility

Use async processing if:
[ ] Operations likely > provider timeout
[ ] Work can be queued
[ ] User can wait for results
```

**Decision**: ☐ SDK  ☐ fetch()  ☐ async processing  ☐ hybrid

**Rationale**: _____________________________________________________
________________________________________________________________

---

## 3. Timeout Configuration

### 3.1 Provider Limits

**Serverless Provider**: ____________________
**Free Tier Timeout**: ____________________
**Pro/Paid Timeout**: ____________________
**Hard Maximum**: ____________________

Check here: https://vercel.com/docs/functions/serverless-functions/runtimes#resource-limits

### 3.2 Timeout Hierarchy

```
Provider hard limit (e.g., 50s free, 900s pro)
        ↓ (must be less than this)
Function config maxDuration (e.g., 300s)
        ↓ (must be less than this)
SDK/API client timeout (e.g., 240s)
        ↓ (must be less than this)
Individual operation timeout (e.g., 180s)
        ↓ (must be less than this)
AbortController timeout (e.g., 150s)
```

**Filled in with values**:
- Provider: _________ → Function: _________ → Client: _________ → Op: _________ → Signal: _________

### 3.3 Configuration Location

**vercel.json**:
```json
{
  "functions": {
    "app/api/[endpoint]/**": {
      "maxDuration": ____
    }
  }
}
```

**API Client** (if SDK):
```typescript
const client = new [SDK]({
  timeout: ____,
  maxRetries: 0
})
```

**Per-operation** (always):
```typescript
const controller = new AbortController()
const timeoutId = setTimeout(
  () => controller.abort(),
  ____  // Operation timeout
)
```

---

## 4. Implementation Choice Details

### 4.A Using SDK

**File**: `lib/[api-name]-sdk.ts`

```typescript
import [SDK] from '[package]'

// Configuration
const client = new [SDK]({
  apiKey: process.env.API_KEY,
  timeout: 240000,           // 4 minutes
  maxRetries: 0,             // We handle retries

  // Network hardening (if applicable)
  httpAgent: new http.Agent({
    keepAlive: false,        // CRITICAL for serverless
    timeout: 240000
  }),
  httpsAgent: new https.Agent({
    keepAlive: false,        // CRITICAL for serverless
    timeout: 240000
  })
})

// Usage wrapper
export async function [operation](params: [Type]): Promise<[ReturnType]> {
  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    180000  // Operation-specific timeout
  )

  try {
    // Actual SDK call here
    const result = await client.[method]([params])
    return result
  } catch (error) {
    // Handle specific errors (see Part 5)
  } finally {
    clearTimeout(timeoutId)
  }
}
```

### 4.B Using fetch()

**File**: `lib/[api-name]-fetch.ts`

```typescript
export async function [operation](params: [Type]): Promise<[ReturnType]> {
  const apiKey = process.env.API_KEY
  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    300000  // 5 minutes for fetch
  )

  try {
    const response = await fetch('[API_ENDPOINT]', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout')
    }

    throw error
  }
}
```

### 4.C Using Async Processing

**File**: `app/api/[endpoint]/queue.ts`

```typescript
// Returns immediately
export async function queueOperation(params: [Type]) {
  // Store in database
  const job = await db.jobs.create({
    status: 'pending',
    params,
    createdAt: new Date()
  })

  return { jobId: job.id, status: 'pending' }
}

// Run in background (cron or separate function)
export async function processQueuedJobs() {
  const jobs = await db.jobs.find({ status: 'pending' })

  for (const job of jobs) {
    try {
      // Now we have unlimited time
      const result = await [operation](job.params)

      await db.jobs.update(job.id, {
        status: 'completed',
        result
      })
    } catch (error) {
      await db.jobs.update(job.id, {
        status: 'failed',
        error: error.message
      })
    }
  }
}
```

---

## 5. Error Handling

### 5.1 Expected Error Types

List errors this API can throw:

| Error Type | Cause | Handling |
|-----------|-------|----------|
| _____________ | | [ ] Retry [ ] Fail [ ] Queue [ ] Log |
| _____________ | | [ ] Retry [ ] Fail [ ] Queue [ ] Log |
| _____________ | | [ ] Retry [ ] Fail [ ] Queue [ ] Log |

### 5.2 Retry Logic

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options = {}
): Promise<T> {
  const {
    maxAttempts = 5,
    baseDelay = 1000,
    retryableErrors = ['timeout', 'rate_limit']
  } = options

  let lastError: Error

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // Don't retry certain errors
      if (!retryableErrors.some(e => lastError.message.includes(e))) {
        throw error
      }

      if (attempt === maxAttempts) {
        throw error
      }

      const delay = Math.min(
        baseDelay * Math.pow(2, attempt - 1),
        30000
      )

      await new Promise(r => setTimeout(r, delay))
    }
  }

  throw lastError!
}
```

### 5.3 Circuit Breaker (for critical paths)

```typescript
class CircuitBreaker {
  private failureCount = 0
  private isOpen = false
  private readonly THRESHOLD = 5
  private readonly RESET_TIMEOUT = 60000

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen) {
      throw new Error('Circuit breaker is open')
    }

    try {
      const result = await fn()
      this.failureCount = 0
      return result
    } catch (error) {
      this.failureCount++

      if (this.failureCount >= this.THRESHOLD) {
        this.isOpen = true
        setTimeout(() => {
          this.isOpen = false
          this.failureCount = 0
        }, this.RESET_TIMEOUT)

        throw new Error('Circuit breaker opened due to failures')
      }

      throw error
    }
  }
}
```

---

## 6. Testing

### 6.1 Test Cases

```typescript
describe('[API] Integration - Serverless', () => {
  // Case 1: Normal operation
  it('should [operation] successfully', async () => {
    const result = await [operation](params)
    expect(result).toEqual(expected)
  })

  // Case 2: Timeout handling
  it('should timeout gracefully', async () => {
    await expect([operation](slowParams)).rejects.toThrow('timeout')
  })

  // Case 3: Connection reset
  it('should retry on connection reset', async () => {
    // Mock ECONNRESET
    await expect([operation](params)).resolves.toBeDefined()
  })

  // Case 4: Rate limiting
  it('should handle rate limits', async () => {
    // Mock rate limit response
    const result = await [operation](params)
    expect(result.retryAfter).toBeDefined()
  })

  // Case 5: Large data
  it('should handle large payloads', async () => {
    const largeData = createLargePayload(10 * 1024 * 1024)
    const result = await [operation](largeData)
    expect(result).toBeDefined()
  })
})
```

### 6.2 Environment Simulation

```typescript
describe('[API] - Vercel Environment', () => {
  beforeEach(() => {
    process.env.VERCEL = 'true'
    process.env.VERCEL_ENV = 'production'
  })

  it('should survive function suspension', async () => {
    // Test 1: Make call
    const result1 = await [operation](params)

    // Simulate suspension
    await new Promise(r => setTimeout(r, 100))

    // Test 2: Make another call - should still work
    const result2 = await [operation](params)

    expect(result1).toBeDefined()
    expect(result2).toBeDefined()
  })
})
```

---

## 7. Monitoring & Logging

### 7.1 Telemetry Points

```typescript
const telemetry = {
  recordOperation: (
    operation: string,
    duration: number,
    success: boolean,
    error?: string
  ) => {
    // Log for debugging
    console.log({
      operation,
      duration,
      success,
      error,
      timestamp: new Date().toISOString()
    })

    // Alert on anomalies
    if (duration > 120000) {
      console.warn(`Slow operation: ${operation} (${duration}ms)`)
    }

    if (!success) {
      console.error(`Failed operation: ${operation}`, error)
    }
  }
}

// Usage
const start = Date.now()
try {
  const result = await [operation](params)
  telemetry.recordOperation('[operation]', Date.now() - start, true)
} catch (error) {
  telemetry.recordOperation('[operation]', Date.now() - start, false, error.message)
  throw error
}
```

### 7.2 What to Monitor

- [ ] Operation duration (alert if > 2 minutes)
- [ ] Failure rate (alert if > 5%)
- [ ] Retry count distribution
- [ ] Error type frequency
- [ ] API rate limit usage
- [ ] Timeout occurrences

---

## 8. Pre-Deployment Checklist

- [ ] Decision documented (SDK vs fetch vs async)
- [ ] Timeout hierarchy calculated and verified
- [ ] `maxDuration` set in vercel.json
- [ ] API client timeout configured
- [ ] AbortController timeout implemented
- [ ] Tested with files at size boundaries
- [ ] Tested timeout scenario (hang > maxDuration)
- [ ] Tested connection reset (ECONNRESET)
- [ ] Retry logic tested
- [ ] Staged and tested in production
- [ ] Monitoring/logging configured
- [ ] Team documentation created
- [ ] Runbook for common issues created
- [ ] Rollback plan documented

---

## 9. Documentation

### For Your Team

```markdown
# [API] Integration Guide

## Decision: [SDK / fetch / async]

We chose [decision] because:
- [Reason 1]
- [Reason 2]
- [Reason 3]

## How It Works

[Diagram or ASCII art showing flow]

## Timeout Configuration

- Vercel limit: ___
- Function timeout: ___
- API client timeout: ___
- Operation timeout: ___

## Common Issues

### Issue: [Symptom]
**Cause**: [Root cause]
**Fix**: [Solution]

### Issue: [Symptom]
**Cause**: [Root cause]
**Fix**: [Solution]

## Monitoring

We monitor:
- [Metric 1] (alert if [threshold])
- [Metric 2] (alert if [threshold])

View Vercel logs: [Link]

## Emergency Procedures

If [API] is failing:
1. Check Vercel logs
2. Verify [environment variable]
3. Try manual retry: `npm run retry-[operation]`
4. Rollback: [Git command]

## Contact

Questions? Reach out to [Owner]
```

---

## 10. Example: Voice Memory's OpenAI Integration

**API**: OpenAI
**Decision**: Hybrid (SDK for small files, fetch() for large, async for processing)
**Files**:
- `lib/openai.ts` - Core integration
- `app/api/process/route.ts` - API endpoint
- `docs/OPENAI_SERVERLESS_PREVENTION_GUIDE.md` - Full guide

**What They Did Right**:
✅ Used decision tree (SDK vs fetch)
✅ Configured timeouts explicitly
✅ Implemented retry logic
✅ Added AbortController
✅ Used signed URLs for large files
✅ Created comprehensive documentation

**Reference Implementation**: Study `/app/api/process/route.ts` for:
- Timeout configuration
- Error categorization
- Retry logic
- Circuit breaker pattern
- Monitoring setup

---

## Final Checklist

Before declaring victory:

- [ ] Integration works with 10x expected load
- [ ] Timeout errors handled gracefully
- [ ] No ECONNRESET errors in logs
- [ ] Team can explain why each decision was made
- [ ] Monitoring shows healthy metrics
- [ ] Staging config matches production
- [ ] Documentation is updated
- [ ] Team is trained on troubleshooting

---

**End of Template**

Use this for the next API integration. Adjust sections as needed for your specific API and requirements.
