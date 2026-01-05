# OpenAI in Serverless: Quick Reference Card

## SDK vs Fetch Decision Tree

```
API Integration in Serverless?
│
├─ Files > 3MB?  → Use signed URLs, bypass serverless
├─ Operations > 4min?  → Use async processing + queue
├─ Files 1-3MB?  → fetch() ✅
├─ Operations 2-4min?  → fetch() ✅
├─ SDK docs mention "serverless"?
│  ├─ YES → Configure with keepAlive: false
│  └─ NO → Use fetch() ✅
└─ Simple small file?  → SDK OK (if timeout configured)
```

**Default for serverless: fetch() > SDK**

---

## Timeout Checklist

```typescript
// 1. Configure Vercel (vercel.json)
{
  "functions": {
    "app/api/**": {
      "maxDuration": 300  // 5 minutes (Pro), 60 (Free)
    }
  }
}

// 2. Configure API Client
const client = new OpenAI({
  timeout: 240000,  // 4 minutes (1 min buffer for Vercel)
  maxRetries: 0     // We handle retries
})

// 3. Configure Operation
const controller = new AbortController()
setTimeout(() => controller.abort(), 180000) // 3 minutes

// 4. Verify Hierarchy
// Vercel limit (300s) > client timeout (240s) > operation (180s) > signal (any)
```

---

## File Size Tiers

| Size | Strategy | Notes |
|------|----------|-------|
| < 1MB | SDK or fetch | Both work, SDK simpler |
| 1-3MB | fetch() | SDK gets risky |
| 3-10MB | Signed URLs | Bypass serverless entirely |
| > 10MB | Chunked upload | Use third-party service |

---

## Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `ECONNRESET` | Function suspended | Add retry logic + AbortController |
| `socket hang up` | Connection died | Use fetch(), disable keepAlive |
| Timeout after 60s | Using free Vercel | Upgrade to Pro or split request |
| 502 Bad Gateway | Body too large | Use signed URLs |
| Processing hangs | No timeout set | Add explicit AbortController timeout |
| Works locally, fails prod | Using SDK defaults | Configure timeouts explicitly |

---

## Fetch Template (Copy-Paste Ready)

```typescript
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300 // Set in function config too

async function transcribeWithFetch(file: File): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 300000) // 5min

  try {
    const formData = new FormData()
    const arrayBuffer = await file.arrayBuffer()
    const blob = new Blob([arrayBuffer], { type: file.type || 'audio/mpeg' })

    formData.append('file', blob, file.name)
    formData.append('model', 'whisper-1')
    formData.append('response_format', 'text')

    const response = await fetch(
      'https://api.openai.com/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: formData,
        signal: controller.signal,
      }
    )

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    return await response.text()
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout')
    }
    throw error
  }
}
```

---

## SDK Hardening Config (if you must use SDK)

```typescript
import OpenAI from 'openai'
import http from 'http'
import https from 'https'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,

  // Critical for serverless
  timeout: 240000,        // 4 minutes
  maxRetries: 0,          // Handle retries ourselves

  // Network hardening
  httpAgent: new http.Agent({
    keepAlive: false,     // Don't reuse connections!
    timeout: 240000,
  }),
  httpsAgent: new https.Agent({
    keepAlive: false,     // Don't reuse connections!
    timeout: 240000,
  }),
})
```

---

## Retry Pattern

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 5,
  baseDelay = 2000
): Promise<T> {
  let lastError: Error

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // Don't retry client errors
      if (lastError.message.includes('invalid_file')) {
        throw error
      }

      // Last attempt
      if (attempt === maxAttempts) {
        throw error
      }

      // Exponential backoff
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt - 1),
        30000  // Max 30 seconds
      )

      await new Promise(r => setTimeout(r, delay))
    }
  }

  throw lastError!
}

// Usage
const transcription = await withRetry(
  () => transcribeWithFetch(file)
)
```

---

## Signed URL Pattern (for large files)

```typescript
// 1. Generate signed URL (server)
const { data } = await supabase.storage
  .from('audio')
  .createSignedUrl(`${userId}/${fileName}`, 3600)

return { uploadUrl: data.signedUrl }

// 2. Client uploads directly
await fetch(data.signedUrl, {
  method: 'PUT',
  body: file,
  headers: { 'Content-Type': file.type }
})

// 3. Process (server can take minutes now, no client involvement)
const { text } = await openai.audio.transcriptions.create({
  file: fs.createReadStream('/local/path'),
  model: 'whisper-1'
})
```

---

## Monitoring Setup

```typescript
// Track failures
const telemetry = {
  recordOpenAICall: (operation: string, duration: number, success: boolean) => {
    // Alert if slow
    if (duration > 120000) {
      console.warn(`Slow ${operation}: ${duration}ms`)
    }

    // Alert if failure
    if (!success) {
      console.error(`Failed ${operation}`)
    }

    // Log for analysis
    console.log({
      operation,
      duration,
      success,
      timestamp: new Date().toISOString()
    })
  }
}

// Usage
const start = Date.now()
try {
  const result = await transcribeWithFetch(file)
  telemetry.recordOpenAICall('transcribe', Date.now() - start, true)
} catch (error) {
  telemetry.recordOpenAICall('transcribe', Date.now() - start, false)
  throw error
}
```

---

## Pre-Deployment Checklist

- [ ] Chose SDK vs fetch based on decision tree
- [ ] Set `maxDuration` in `vercel.json` for the function
- [ ] Configured API client timeout (< maxDuration)
- [ ] Added AbortController with explicit timeout
- [ ] Tested with files at tier boundaries (1MB, 3MB)
- [ ] Simulated timeout (hang past maxDuration)
- [ ] Simulated connection reset (throw ECONNRESET)
- [ ] Verified in staging before production
- [ ] Added retry logic for transient errors
- [ ] Configured monitoring/logging
- [ ] Documented choice in code comments
- [ ] Team knows how to debug (check Vercel logs)

---

## Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...

# Optional but recommended
OPENAI_TIMEOUT_MS=240000
OPENAI_WHISPER_MODEL=whisper-1
OPENAI_GPT_MODEL=gpt-4o
OPENAI_RETRY_ATTEMPTS=5
OPENAI_RETRY_BASE_DELAY=2000

# For signed URLs (large files)
NEXT_PUBLIC_SUPABASE_URL=https://...
SUPABASE_SERVICE_KEY=...
```

---

## Production Success Criteria

✅ **You're ready when**:
- Operations complete even with 3MB files
- Timeouts handled gracefully (no hangs)
- Retries work after transient failures
- Monitoring shows no ECONNRESET errors
- Team can debug issues without guessing
- Staging mirrors production config exactly
- Vercel logs show healthy operation

❌ **Not ready if**:
- Still using SDK defaults
- Timeout not configured
- No retry logic
- Different config locally vs production
- Team unclear on how system works
- No monitoring/alerting

---

## Further Reading

1. **Full Guide**: `docs/OPENAI_SERVERLESS_PREVENTION_GUIDE.md`
2. **Error Handling**: `docs/ERROR_HANDLING.md`
3. **Voice Memory Implementation**: `lib/openai.ts`
4. **Real Example**: `app/api/process/route.ts`

---

## Last Resort Debugging

When all else fails:

```typescript
// Add this to see exactly what's happening
console.log('=== OpenAI Call Debug ===')
console.log('File size:', file.size)
console.log('Timeout set:', 300000)
console.log('Current time:', Date.now())
console.log('Function timeout remaining:', ?)  // Check Vercel logs

// Make a simple test call
try {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  })
  console.log('API connectivity:', response.ok)
} catch (e) {
  console.log('API unreachable:', e)
}

// Check if it's a serverless issue
console.log('Running in:', {
  vercel: !!process.env.VERCEL,
  environment: process.env.VERCEL_ENV
})
```

Then check Vercel dashboard:
1. Function logs (not browser console!)
2. CPU time (shows if function was killed)
3. Duration (shows actual execution time)
4. Error messages (actual vs perceived)

---

**TL;DR**: Use fetch() for serverless, configure timeout explicitly, add retry logic. Done.
