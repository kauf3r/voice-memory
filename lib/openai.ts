import OpenAI, { toFile } from 'openai'
import { validateAnalysis, type ValidatedAnalysis } from './validation'
import { buildAnalysisPrompt } from './analysis'
import { createServiceClient } from './supabase-server'

// Lazy initialization to ensure environment variables are loaded
let openai: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openai) {
    console.log('🔑 Initializing OpenAI client...')
    
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OPENAI_API_KEY environment variable is not set')
      console.log('🔍 Available environment variables:', {
        NODE_ENV: process.env.NODE_ENV || 'undefined',
        VERCEL_ENV: process.env.VERCEL_ENV || 'undefined',
        hasOpenAIKey: !!process.env.OPENAI_API_KEY
      })
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }
    
    console.log('✅ OPENAI_API_KEY found, creating client')
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 240000, // 4 minutes timeout for large audio file uploads
      maxRetries: 0, // We handle retries ourselves
    })
    console.log('✅ OpenAI client initialized successfully')
  }
  return openai
}

// Configurable model names with environment variable fallbacks
// GPT-4o is recommended: 50% cheaper than gpt-4-turbo, faster, same quality
// Options: gpt-4o (recommended), gpt-4o-mini (budget), gpt-4-turbo (legacy)
const OPENAI_MODELS = {
  whisper: process.env.OPENAI_WHISPER_MODEL || 'whisper-1',
  gpt: process.env.OPENAI_GPT_MODEL || 'gpt-4o'
}

// Rate limiting configuration
const RATE_LIMIT = {
  whisper: {
    requestsPerMinute: parseInt(process.env.OPENAI_WHISPER_RATE_LIMIT || '50'),
    maxConcurrent: parseInt(process.env.OPENAI_WHISPER_MAX_CONCURRENT || '5'),
  },
  gpt4: {
    requestsPerMinute: parseInt(process.env.OPENAI_GPT_RATE_LIMIT || '200'),
    maxConcurrent: parseInt(process.env.OPENAI_GPT_MAX_CONCURRENT || '10'),
  }
}

// Enhanced rate limiter with Supabase persistence option
class RateLimiter {
  private requests: Map<string, number[]> = new Map()
  private supabase: any = null
  private useDatabase: boolean
  private tableChecked: boolean = false
  private tableExists: boolean = false
  private lastTableCheck: number = 0
  private readonly TABLE_CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutes
  
  constructor(useDatabase: boolean = false) {
    this.useDatabase = useDatabase
  }
  
  private getSupabase() {
    if (!this.supabase) {
      this.supabase = createServiceClient()
    }
    return this.supabase
  }
  
  /**
   * Check if the rate_limits table exists and is accessible
   */
  private async checkTableExists(): Promise<boolean> {
    const now = Date.now()
    
    // Only check table existence every 5 minutes to avoid overhead
    if (this.tableChecked && (now - this.lastTableCheck < this.TABLE_CHECK_INTERVAL)) {
      return this.tableExists
    }
    
    try {
      // Try a simple select to test table existence and accessibility
      const { error } = await this.getSupabase()
        .from('rate_limits')
        .select('service')
        .limit(1)
        .maybeSingle()
      
      if (error) {
        // Check for table existence errors
        if (error.code === '42P01' || // relation does not exist
            error.message.includes('relation "rate_limits" does not exist') ||
            error.message.includes('table "rate_limits" does not exist')) {
          console.warn('Rate limiting: rate_limits table does not exist, using memory fallback')
          this.tableExists = false
        } else if (error.code === '42501' || // insufficient privilege
                   error.message.includes('permission denied') ||
                   error.message.includes('insufficient privilege')) {
          console.warn('Rate limiting: insufficient permissions for rate_limits table, using memory fallback')
          this.tableExists = false
        } else {
          console.warn('Rate limiting: database error during table check, using memory fallback:', error)
          this.tableExists = false
        }
      } else {
        this.tableExists = true
      }
    } catch (error) {
      console.warn('Rate limiting: failed to check table existence, using memory fallback:', error)
      this.tableExists = false
    }
    
    this.tableChecked = true
    this.lastTableCheck = now
    return this.tableExists
  }
  
  /**
   * Enhanced database rate limiting with comprehensive error handling
   */
  private async canMakeRequestDatabase(service: string, limit: number): Promise<boolean> {
    const now = Date.now()
    
    try {
      // Check if table exists before attempting database operations
      if (!(await this.checkTableExists())) {
        console.warn(`Rate limiting: falling back to memory for service: ${service}`)
        return this.canMakeRequestMemory(service, limit)
      }
      
      // Get current rate limit data
      const { data, error } = await this.getSupabase()
        .from('rate_limits')
        .select('requests')
        .eq('service', service)
        .single()
      
      // Handle query errors
      if (error) {
        if (error.code === 'PGRST116') {
          // No existing record - this is fine, we'll create one
        } else if (error.code === '42P01' || 
                   error.message.includes('relation "rate_limits" does not exist')) {
          // Table doesn't exist anymore - mark for recheck and fallback
          this.tableExists = false
          this.tableChecked = false
          console.warn('Rate limiting: rate_limits table no longer exists, falling back to memory')
          return this.canMakeRequestMemory(service, limit)
        } else {
          console.warn(`Rate limiting: database query error for service ${service}, falling back to memory:`, error)
          return this.canMakeRequestMemory(service, limit)
        }
      }
      
      // Process rate limit data
      let requests = data?.requests || []
      
      // Validate requests array
      if (!Array.isArray(requests)) {
        console.warn(`Rate limiting: invalid requests data for service ${service}, resetting`)
        requests = []
      }
      
             // Remove requests older than 1 minute and ensure they're valid numbers
       requests = requests
         .filter((time: any) => typeof time === 'number' && !isNaN(time) && now - time < 60000)
         .sort((a: number, b: number) => a - b) // Sort chronologically
      
      // Check if limit is exceeded
      if (requests.length >= limit) {
        const oldestRequest = requests[0]
        const timeUntilReset = Math.ceil((oldestRequest + 60000 - now) / 1000)
        console.log(`Rate limiting: limit exceeded for ${service}. Reset in ${timeUntilReset}s`)
        return false
      }
      
      // Add current request
      requests.push(now)
      
      // Update rate limit data with retry logic
      const maxRetries = 3
      let retryCount = 0
      
      while (retryCount < maxRetries) {
        try {
          const { error: upsertError } = await this.getSupabase()
            .from('rate_limits')
            .upsert({
              service,
              requests,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'service'
            })
          
          if (upsertError) {
            if (upsertError.code === '42P01' || 
                upsertError.message.includes('relation "rate_limits" does not exist')) {
              // Table was dropped during operation
              this.tableExists = false
              this.tableChecked = false
              console.warn('Rate limiting: rate_limits table was dropped, falling back to memory')
              return this.canMakeRequestMemory(service, limit)
            }
            throw upsertError
          }
          
          // Success
          return true
          
        } catch (retryError) {
          retryCount++
          if (retryCount >= maxRetries) {
            console.warn(`Rate limiting: failed to update database after ${maxRetries} retries for service ${service}, falling back to memory:`, retryError)
            return this.canMakeRequestMemory(service, limit)
          }
          
          // Short delay before retry
          await new Promise(resolve => setTimeout(resolve, 100 * retryCount))
        }
      }
      
      return true
      
    } catch (error) {
      console.warn(`Rate limiting: unexpected error for service ${service}, falling back to memory:`, error)
      return this.canMakeRequestMemory(service, limit)
    }
  }
  
  async canMakeRequest(service: string, limit: number): Promise<boolean> {
    if (this.useDatabase) {
      return this.canMakeRequestDatabase(service, limit)
    } else {
      return this.canMakeRequestMemory(service, limit)
    }
  }
  
  private canMakeRequestMemory(service: string, limit: number): boolean {
    const now = Date.now()
    const requests = this.requests.get(service) || []
    
    // Remove requests older than 1 minute
    const validRequests = requests.filter(time => now - time < 60000)
    
    if (validRequests.length >= limit) {
      return false
    }
    
    validRequests.push(now)
    this.requests.set(service, validRequests)
    return true
  }
}

// Use database rate limiting if configured, otherwise fall back to memory
const rateLimiter = new RateLimiter(process.env.USE_DATABASE_RATE_LIMITING === 'true')

// Retry configuration - increased for M4A connection reliability
const RETRY_CONFIG = {
  maxAttempts: parseInt(process.env.OPENAI_RETRY_ATTEMPTS || '5'),
  baseDelay: parseInt(process.env.OPENAI_RETRY_BASE_DELAY || '2000'),
  maxDelay: parseInt(process.env.OPENAI_RETRY_MAX_DELAY || '30000')
}

/**
 * Exponential backoff retry wrapper
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = RETRY_CONFIG.maxAttempts
): Promise<T> {
  let lastError: Error
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // Don't retry on certain errors
      if (lastError.message.includes('invalid_file') || 
          lastError.message.includes('file_too_large') ||
          lastError.message.includes('context_length')) {
        throw lastError
      }
      
      if (attempt === maxAttempts) {
        throw lastError
      }
      
      // Exponential backoff with jitter
      const delay = Math.min(
        RETRY_CONFIG.baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000,
        RETRY_CONFIG.maxDelay
      )

      // Enhanced logging for connection errors (common with M4A files)
      const isConnectionError = lastError.message.toLowerCase().includes('connection') ||
                                lastError.message.toLowerCase().includes('network') ||
                                lastError.message.toLowerCase().includes('econnreset') ||
                                lastError.message.toLowerCase().includes('etimedout')

      if (isConnectionError) {
        console.warn(`⚠️ Connection error on attempt ${attempt}/${maxAttempts}:`, lastError.message)
        console.warn(`   This is often transient - retrying in ${Math.round(delay/1000)}s...`)
      } else {
        console.log(`OpenAI request failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms:`, lastError.message)
      }

      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError!
}

/**
 * Direct fetch upload for large files - bypasses SDK for better control
 * Uses chunked transfer with explicit timeouts for serverless environments
 */
async function transcribeWithDirectFetch(file: File): Promise<{ text: string; error: null }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  console.log('📤 Preparing multipart form data...')

  // Create form data
  const formData = new FormData()

  // Add the file - use Blob for better compatibility
  const arrayBuffer = await file.arrayBuffer()
  const blob = new Blob([arrayBuffer], { type: file.type || 'audio/mpeg' })
  formData.append('file', blob, file.name)
  formData.append('model', OPENAI_MODELS.whisper)
  formData.append('response_format', 'text')
  formData.append('language', 'en')

  console.log(`📤 Uploading ${(file.size / 1024 / 1024).toFixed(2)}MB to OpenAI Whisper...`)

  // Use AbortController with generous timeout for large files
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 minute timeout

  try {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        // Don't set Content-Type - fetch will set it with boundary for multipart
      },
      body: formData,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ OpenAI API error:', response.status, errorText)
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const transcription = await response.text()
    console.log('✅ Transcription completed, length:', transcription.length)

    return { text: transcription, error: null }
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Upload timeout - file may be too large for serverless environment')
    }
    throw error
  }
}

export async function transcribeAudio(file: File): Promise<{ text: string | null; error: Error | null }> {
  return withRetry(async () => {
    // Check rate limit
    if (!(await rateLimiter.canMakeRequest('whisper', RATE_LIMIT.whisper.requestsPerMinute))) {
      throw new Error('Rate limit exceeded for Whisper API. Please try again later.')
    }

    console.log('Starting transcription for file:', file.name, 'Size:', file.size, 'Model:', OPENAI_MODELS.whisper)

    // For large files, use direct fetch with multipart form data for better control
    const fileSizeThreshold = 3 * 1024 * 1024 // 3MB

    if (file.size > fileSizeThreshold) {
      console.log('📤 Large file detected, using direct fetch upload...')
      return await transcribeWithDirectFetch(file)
    }

    // For smaller files, use the SDK
    let uploadFile: File | Awaited<ReturnType<typeof toFile>>
    try {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      console.log('📤 Converting file for upload, buffer size:', buffer.length)
      uploadFile = await toFile(buffer, file.name, { type: file.type })
      console.log('📤 File converted successfully')
    } catch (conversionError) {
      console.error('❌ File conversion failed:', conversionError)
      uploadFile = file
    }

    console.log('📤 Calling OpenAI Whisper API...')
    const transcription = await getOpenAIClient().audio.transcriptions.create({
      file: uploadFile,
      model: OPENAI_MODELS.whisper,
      response_format: 'text',
      language: 'en',
    })

    console.log('Transcription completed, length:', transcription.length)
    return { text: transcription, error: null }
  }).catch((error) => {
    console.error('Transcription error:', error)
    
    if (error instanceof Error) {
      // Enhanced error categorization
      if (error.message.includes('rate_limit')) {
        return { text: null, error: new Error('OpenAI rate limit exceeded. Please try again later.') }
      }
      if (error.message.includes('invalid_file')) {
        return { text: null, error: new Error('Invalid audio file format.') }
      }
      if (error.message.includes('file_too_large')) {
        return { text: null, error: new Error('Audio file is too large.') }
      }
      if (error.message.includes('quota_exceeded')) {
        return { text: null, error: new Error('OpenAI quota exceeded. Please check your account.') }
      }
      if (error.message.includes('authentication')) {
        return { text: null, error: new Error('OpenAI authentication failed. Please check your API key.') }
      }
      return { text: null, error }
    }
    
    return { text: null, error: new Error('Transcription failed') }
  })
}

/**
 * Direct fetch for chat completions - bypasses SDK for better reliability in serverless
 */
async function analyzeWithDirectFetch(
  prompt: string,
  systemPrompt: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  console.log('📤 Using direct fetch for GPT-4 analysis...')

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 180000) // 3 minute timeout

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODELS.gpt,
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
      console.error('❌ OpenAI API error:', response.status, errorText)
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content?.trim()

    if (!content) {
      throw new Error('Empty response from GPT-4')
    }

    console.log('✅ Analysis completed, response length:', content.length)
    return content
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Analysis timeout - request took too long')
    }
    throw error
  }
}

export async function analyzeTranscription(
  transcription: string,
  projectKnowledge: string = '',
  recordingDate?: string
): Promise<{ analysis: ValidatedAnalysis | null; error: Error | null; warning?: string }> {
  return withRetry(async () => {
    // Check rate limit
    if (!(await rateLimiter.canMakeRequest('gpt4', RATE_LIMIT.gpt4.requestsPerMinute))) {
      throw new Error('Rate limit exceeded for GPT-4 API. Please try again later.')
    }

    console.log('Starting analysis for transcription length:', transcription.length, 'Model:', OPENAI_MODELS.gpt)

    const prompt = buildAnalysisPrompt(transcription, projectKnowledge, recordingDate)
    const systemPrompt = 'You are an expert analyst who extracts actionable insights from voice notes. Always return valid JSON.'

    // Use direct fetch for better reliability in serverless environments
    const responseText = await analyzeWithDirectFetch(prompt, systemPrompt)
    
    if (!responseText) {
      throw new Error('Empty response from GPT-4')
    }

    console.log('GPT-4 analysis completed, response length:', responseText.length)

    // Parse JSON response - handle markdown code blocks
    let rawAnalysis
    try {
      // Remove markdown code blocks if present
      let cleanedResponse = responseText.trim()
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '')
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }
      
      rawAnalysis = JSON.parse(cleanedResponse)
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      console.error('Raw response:', responseText)
      throw new Error('Invalid JSON response from GPT-4')
    }

    // Validate the analysis structure
    const { analysis, error: validationError } = validateAnalysis(rawAnalysis)
    
    if (!analysis) {
      throw new Error(`Analysis validation failed: ${validationError}`)
    }

    const result: { analysis: ValidatedAnalysis; error: null; warning?: string } = {
      analysis,
      error: null
    }

    // Add warning if validation had to fix issues
    if (validationError) {
      result.warning = validationError
    }

    return result
  }).catch((error) => {
    console.error('Analysis error:', error)
    
    if (error instanceof Error) {
      // Enhanced error categorization
      if (error.message.includes('rate_limit')) {
        return { analysis: null, error: new Error('OpenAI rate limit exceeded. Please try again later.') }
      }
      if (error.message.includes('context_length')) {
        return { analysis: null, error: new Error('Text too long for analysis.') }
      }
      if (error.message.includes('quota_exceeded')) {
        return { analysis: null, error: new Error('OpenAI quota exceeded. Please check your account.') }
      }
      if (error.message.includes('authentication')) {
        return { analysis: null, error: new Error('OpenAI authentication failed. Please check your API key.') }
      }
      return { analysis: null, error }
    }
    
    return { analysis: null, error: new Error('Analysis failed') }
  })
}

export default openai