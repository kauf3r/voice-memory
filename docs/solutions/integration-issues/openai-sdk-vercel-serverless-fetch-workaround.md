---
title: "OpenAI SDK Connection Failures in Vercel Serverless - Direct Fetch Workaround"
problem_type: ["integration-issues", "infrastructure-issues"]
components:
  - path: "lib/openai.ts"
    type: "integration"
  - path: "app/api/process/route.ts"
    type: "api-route"
symptoms:
  - "Connection error from OpenAI SDK"
  - "502 Bad Gateway timeout"
  - "ECONNRESET during upload"
  - "ETIMEDOUT on large file processing"
  - "This is often transient - retrying in Xs..."
error_codes:
  - "ECONNRESET"
  - "ETIMEDOUT"
  - "502"
root_causes:
  - "OpenAI SDK connection issues in serverless environment"
  - "SDK overhead and connection pooling assumptions don't work in stateless serverless"
  - "Large file uploads (>3MB) exceed SDK's internal timeout handling"
solutions:
  - type: "direct-fetch"
    description: "Bypass OpenAI SDK with native fetch() API"
    affected_files:
      - "lib/openai.ts"
tags:
  - "openai"
  - "vercel"
  - "serverless"
  - "fetch"
  - "whisper"
  - "gpt-4"
  - "connection-error"
date_solved: "2026-01-04"
---

# OpenAI SDK Connection Failures in Vercel Serverless

## Problem

OpenAI API calls (Whisper transcription and GPT-4 analysis) were failing with "Connection error" in Vercel's serverless environment when using the OpenAI SDK.

### Symptoms

- Logs showing: `This is often transient - retrying in 3s...`
- Connection errors on both Whisper uploads and GPT-4 chat completions
- Large audio files (7MB+) consistently failing
- Retries exhausting without success

### Error Messages

```
Connection error on attempt N/maxAttempts
⚠️ Connection error on attempt 1/5: Connection error
This is often transient - retrying in 2s...
```

## Root Cause

The OpenAI SDK adds overhead and has built-in connection management that doesn't play well with serverless constraints:

1. **SDK connection pooling** - Assumes persistent connections that don't exist in serverless
2. **Internal retry logic** - Competes with serverless timeout limits
3. **Socket handling** - Serverless containers manage network sockets differently
4. **Large file buffering** - SDK's approach doesn't optimize for stateless execution

## Solution

Replace OpenAI SDK calls with direct `fetch()` API for both Whisper and GPT-4:

### 1. Direct Fetch for Whisper Transcription

```typescript
async function transcribeWithDirectFetch(file: File): Promise<{ text: string; error: null }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  // Create multipart form data
  const formData = new FormData()
  const arrayBuffer = await file.arrayBuffer()
  const blob = new Blob([arrayBuffer], { type: file.type || 'audio/mpeg' })
  formData.append('file', blob, file.name)
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'text')
  formData.append('language', 'en')

  // AbortController with 5-minute timeout for large files
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 300000)

  try {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        // Don't set Content-Type - fetch auto-sets with boundary
      },
      body: formData,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    return { text: await response.text(), error: null }
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Upload timeout - file too large for serverless')
    }
    throw error
  }
}
```

### 2. Direct Fetch for GPT-4 Analysis

```typescript
async function analyzeWithDirectFetch(prompt: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  // AbortController with 3-minute timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 180000)

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 3500,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    return data.choices?.[0]?.message?.content?.trim() || ''
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Analysis timeout - request took too long')
    }
    throw error
  }
}
```

### 3. Integration with Existing Code

Use direct fetch for large files, SDK for smaller ones:

```typescript
export async function transcribeAudio(file: File) {
  const fileSizeThreshold = 3 * 1024 * 1024 // 3MB

  if (file.size > fileSizeThreshold) {
    console.log('📤 Large file detected, using direct fetch upload...')
    return await transcribeWithDirectFetch(file)
  }

  // Use SDK for smaller files
  return await getOpenAIClient().audio.transcriptions.create({ ... })
}
```

## Why This Works

| Aspect | OpenAI SDK | Direct Fetch |
|--------|------------|--------------|
| **Overhead** | High (retry logic, pooling) | Minimal |
| **Timeout Control** | SDK-managed | Explicit AbortController |
| **Serverless Compat** | Assumes persistence | Works stateless |
| **Large Files** | Struggles | Handles with proper timeout |
| **Error Recovery** | May exceed timeout | Manual retry works better |

## Prevention

1. **Always use direct fetch in serverless** for OpenAI API calls when reliability is critical
2. **Set generous timeouts** - 5 min for Whisper, 3 min for GPT-4
3. **Use AbortController** for explicit timeout control
4. **Keep SDK as fallback** for small files where connection issues are rare

## Requirements

- **Vercel Pro** for extended function timeout (300s max)
- Configure in `vercel.json`:
  ```json
  {
    "functions": {
      "app/api/process/**/*.ts": {
        "maxDuration": 300
      }
    }
  }
  ```

## Related Issues

- Vercel body size limits (separate issue - use signed URL uploads)
- Rate limiting (handled by existing RateLimiter class)
