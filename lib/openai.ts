import OpenAI from 'openai'
import { validateAnalysis, type ValidatedAnalysis } from './validation'
import { buildAnalysisPrompt, buildEnhancedAnalysisPrompt, assessTranscriptionComplexity, generateAnalysisCacheKey, estimateAnalysisCost, type AnalysisConfig } from './analysis'
import { createServiceClient } from './supabase-server'

// Lazy initialization to ensure environment variables are loaded
let openai: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openai
}

// Configurable model names with environment variable fallbacks
const OPENAI_MODELS = {
  whisper: process.env.OPENAI_WHISPER_MODEL || 'whisper-1',
  whisperLarge: process.env.OPENAI_WHISPER_LARGE_MODEL || 'whisper-1', // Future large model
  gpt: process.env.OPENAI_GPT_MODEL || 'gpt-4-turbo-preview'
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

// Retry configuration
const RETRY_CONFIG = {
  maxAttempts: parseInt(process.env.OPENAI_RETRY_ATTEMPTS || '3'),
  baseDelay: parseInt(process.env.OPENAI_RETRY_BASE_DELAY || '1000'),
  maxDelay: parseInt(process.env.OPENAI_RETRY_MAX_DELAY || '10000')
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
      
      console.log(`OpenAI request failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms:`, lastError.message)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError!
}

// Enhanced transcription with model selection and language detection
export async function transcribeAudio(
  file: File, 
  options: {
    model?: 'whisper-1' | 'whisper-large'
    language?: string
    enableLanguageDetection?: boolean
    temperature?: number
    prompt?: string
  } = {}
): Promise<{ text: string | null; error: Error | null; metadata?: any }> {
  return withRetry(async () => {
    // Check rate limit
    if (!(await rateLimiter.canMakeRequest('whisper', RATE_LIMIT.whisper.requestsPerMinute))) {
      throw new Error('Rate limit exceeded for Whisper API. Please try again later.')
    }

    const selectedModel = options.model === 'whisper-large' ? OPENAI_MODELS.whisperLarge : OPENAI_MODELS.whisper
    console.log('Starting transcription for file:', file.name, 'Size:', file.size, 'Model:', selectedModel)

    const transcriptionParams: any = {
      file: file,
      model: selectedModel,
      response_format: 'verbose_json', // Get more metadata
      temperature: options.temperature || 0,
    }

    // Add language if specified, otherwise let Whisper auto-detect
    if (options.language && !options.enableLanguageDetection) {
      transcriptionParams.language = options.language
    }

    // Add prompt for better context if provided
    if (options.prompt) {
      transcriptionParams.prompt = options.prompt
    }

    const transcription = await getOpenAIClient().audio.transcriptions.create(transcriptionParams)

    const result = {
      text: transcription.text,
      error: null,
      metadata: {
        language: transcription.language,
        duration: transcription.duration,
        segments: transcription.segments?.slice(0, 5), // First 5 segments for debugging
        model: selectedModel
      }
    }

    console.log('Transcription completed:', {
      length: result.text.length,
      language: result.metadata.language,
      duration: result.metadata.duration,
      model: selectedModel
    })

    return result
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
    
    return { text: null, error: new Error('Transcription failed'), metadata: null }
  })
}

// Cache for frequently transcribed content
const transcriptionCache = new Map<string, { text: string; timestamp: number; metadata: any }>()
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Generate cache key for audio content
 */
function generateCacheKey(file: File, options: any): string {
  // Create a simple hash of file properties and options
  const content = `${file.name}-${file.size}-${file.lastModified}-${JSON.stringify(options)}`
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return hash.toString(36)
}

/**
 * Transcribe with caching for repeated content
 */
export async function transcribeAudioWithCache(
  file: File,
  options: Parameters<typeof transcribeAudio>[1] = {}
): Promise<{ text: string | null; error: Error | null; metadata?: any; fromCache?: boolean }> {
  
  const cacheKey = generateCacheKey(file, options)
  const cached = transcriptionCache.get(cacheKey)
  
  // Check if we have a valid cached result
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('Using cached transcription for:', file.name)
    return {
      text: cached.text,
      error: null,
      metadata: cached.metadata,
      fromCache: true
    }
  }
  
  // Transcribe fresh
  const result = await transcribeAudio(file, options)
  
  // Cache successful results
  if (result.text && !result.error) {
    transcriptionCache.set(cacheKey, {
      text: result.text,
      timestamp: Date.now(),
      metadata: result.metadata
    })
    
    // Clean old cache entries periodically
    if (transcriptionCache.size > 100) {
      const now = Date.now()
      for (const [key, value] of transcriptionCache.entries()) {
        if (now - value.timestamp > CACHE_DURATION) {
          transcriptionCache.delete(key)
        }
      }
    }
  }
  
  return { ...result, fromCache: false }
}

// Enhanced analysis cache with metadata
interface CachedAnalysis {
  analysis: ValidatedAnalysis
  timestamp: number
  model: string
  confidence: number
  cost: number
  complexity: string
}

const analysisCache = new Map<string, CachedAnalysis>()
const ANALYSIS_CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours
const MAX_CACHE_SIZE = 500

// Analysis performance metrics
interface AnalysisMetrics {
  totalRequests: number
  cacheHits: number
  gpt4Requests: number
  gpt35Requests: number
  totalCost: number
  averageConfidence: number
  errorRate: number
}

const analysisMetrics: AnalysisMetrics = {
  totalRequests: 0,
  cacheHits: 0,
  gpt4Requests: 0,
  gpt35Requests: 0,
  totalCost: 0,
  averageConfidence: 0,
  errorRate: 0
}

/**
 * Enhanced analysis with intelligent model selection and caching
 */
export async function analyzeTranscriptionEnhanced(
  transcription: string,
  projectKnowledge: string = '',
  recordingDate?: string,
  userPatterns?: string,
  options: {
    forceModel?: 'gpt-4' | 'gpt-3.5-turbo'
    skipCache?: boolean
    enableMultiPass?: boolean
    confidenceThreshold?: number
  } = {}
): Promise<{
  analysis: ValidatedAnalysis | null
  error: Error | null
  warning?: string
  metadata: {
    model: string
    fromCache: boolean
    confidence: number
    cost: number
    complexity: string
    processingTime: number
    cacheKey?: string
  }
}> {
  const startTime = Date.now()
  analysisMetrics.totalRequests++
  
  try {
    // Step 1: Assess complexity and determine optimal configuration
    const complexity = assessTranscriptionComplexity(transcription, projectKnowledge)
    const { prompt, config } = buildEnhancedAnalysisPrompt(
      transcription,
      projectKnowledge,
      recordingDate,
      userPatterns,
      complexity
    )
    
    // Override model if specified
    if (options.forceModel) {
      config.model = options.forceModel
    }
    
    console.log(`Analysis complexity: ${complexity.level} (score: ${complexity.score.toFixed(2)})`, {
      factors: complexity.factors,
      selectedModel: config.model,
      reasoning: complexity.reasoning
    })
    
    // Step 2: Check cache if enabled
    const cacheKey = generateAnalysisCacheKey(transcription, projectKnowledge)
    
    if (!options.skipCache) {
      const cached = analysisCache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < ANALYSIS_CACHE_DURATION) {
        analysisMetrics.cacheHits++
        console.log('Using cached analysis result')
        
        return {
          analysis: cached.analysis,
          error: null,
          metadata: {
            model: cached.model,
            fromCache: true,
            confidence: cached.confidence,
            cost: 0, // No cost for cached results
            complexity: complexity.level,
            processingTime: Date.now() - startTime,
            cacheKey
          }
        }
      }
    }
    
    // Step 3: Estimate cost and check rate limits
    const estimatedCost = estimateAnalysisCost(transcription, config)
    const rateLimitService = config.model === 'gpt-4' ? 'gpt4' : 'gpt35'
    const rateLimitConfig = config.model === 'gpt-4' ? RATE_LIMIT.gpt4 : RATE_LIMIT.gpt4 // Using same limits for now
    
    if (!(await rateLimiter.canMakeRequest(rateLimitService, rateLimitConfig.requestsPerMinute))) {
      throw new Error(`Rate limit exceeded for ${config.model} API. Please try again later.`)
    }
    
    console.log(`Processing with ${config.model} (estimated cost: $${estimatedCost.toFixed(4)})`)
    
    // Step 4: Perform analysis with selected model
    const result = await performAnalysisWithConfig(prompt, config, complexity.level)
    
    // Step 5: Update metrics
    if (config.model === 'gpt-4') {
      analysisMetrics.gpt4Requests++
    } else {
      analysisMetrics.gpt35Requests++
    }
    analysisMetrics.totalCost += estimatedCost
    
    // Step 6: Cache successful results
    if (result.analysis && !options.skipCache) {
      const confidence = result.analysis.analysisMetadata?.overallConfidence || 0.8
      
      // Only cache high-confidence results
      if (confidence >= (options.confidenceThreshold || config.confidenceThreshold)) {
        analysisCache.set(cacheKey, {
          analysis: result.analysis,
          timestamp: Date.now(),
          model: config.model,
          confidence,
          cost: estimatedCost,
          complexity: complexity.level
        })
        
        // Clean cache if it gets too large
        if (analysisCache.size > MAX_CACHE_SIZE) {
          cleanAnalysisCache()
        }
      }
    }
    
    const processingTime = Date.now() - startTime
    
    return {
      analysis: result.analysis,
      error: result.error,
      warning: result.warning,
      metadata: {
        model: config.model,
        fromCache: false,
        confidence: result.analysis?.analysisMetadata?.overallConfidence || 0,
        cost: estimatedCost,
        complexity: complexity.level,
        processingTime,
        cacheKey
      }
    }
    
  } catch (error) {
    analysisMetrics.errorRate = (analysisMetrics.errorRate * (analysisMetrics.totalRequests - 1) + 1) / analysisMetrics.totalRequests
    
    console.error('Enhanced analysis error:', error)
    
    return {
      analysis: null,
      error: error instanceof Error ? error : new Error('Analysis failed'),
      metadata: {
        model: 'unknown',
        fromCache: false,
        confidence: 0,
        cost: 0,
        complexity: 'unknown',
        processingTime: Date.now() - startTime
      }
    }
  }
}

/**
 * Perform analysis with specific configuration
 */
async function performAnalysisWithConfig(
  prompt: string,
  config: AnalysisConfig,
  complexityLevel: string
): Promise<{ analysis: ValidatedAnalysis | null; error: Error | null; warning?: string }> {
  return withRetry(async () => {
    const systemPrompt = `You are an expert AI analyst specializing in voice note analysis. You provide comprehensive, accurate insights with confidence scoring.

Key principles:
- Always return valid JSON matching the exact schema
- Provide confidence scores for all major insights
- Focus on actionable, valuable information
- Use specific examples from the transcription
- Maintain consistency in terminology

Complexity level: ${complexityLevel}
Expected quality: ${config.confidenceThreshold >= 0.9 ? 'High precision' : 'Standard quality'}`

    const completion = await getOpenAIClient().chat.completions.create({
      model: config.model,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      response_format: { type: "json_object" } // Force JSON response
    })

    const responseText = completion.choices[0]?.message?.content?.trim()
    
    if (!responseText) {
      throw new Error(`Empty response from ${config.model}`)
    }

    console.log(`${config.model} analysis completed, response length:`, responseText.length)

    // Parse JSON response
    let rawAnalysis
    try {
      // Clean up response if needed
      let cleanedResponse = responseText.trim()
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '')
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }
      
      rawAnalysis = JSON.parse(cleanedResponse)
      
      // Add metadata if not present
      if (!rawAnalysis.analysisMetadata) {
        rawAnalysis.analysisMetadata = {
          version: '2.0',
          model: config.model,
          processingTime: '0ms',
          overallConfidence: 0.8,
          complexityScore: 0.5,
          qualityFlags: ['standard_analysis'],
          suggestions: []
        }
      }
      
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      console.error('Raw response:', responseText.substring(0, 500) + '...')
      throw new Error(`Invalid JSON response from ${config.model}`)
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
      result.warning = `Validation adjustments made: ${validationError}`
    }

    return result
  })
}

/**
 * Legacy analysis function for backward compatibility
 */
export async function analyzeTranscription(
  transcription: string, 
  projectKnowledge: string = '',
  recordingDate?: string
): Promise<{ analysis: ValidatedAnalysis | null; error: Error | null; warning?: string }> {
  const result = await analyzeTranscriptionEnhanced(transcription, projectKnowledge, recordingDate)
  return {
    analysis: result.analysis,
    error: result.error,
    warning: result.warning
  }
}

/**
 * Multi-pass analysis for complex content
 */
export async function analyzeTranscriptionMultiPass(
  transcription: string,
  projectKnowledge: string = '',
  recordingDate?: string
): Promise<{
  analysis: ValidatedAnalysis | null
  error: Error | null
  warning?: string
  passes: Array<{ model: string; confidence: number; focus: string }>
}> {
  const passes: Array<{ model: string; confidence: number; focus: string }> = []
  
  try {
    // Pass 1: Quick analysis with GPT-3.5-turbo for basic structure
    const quickResult = await analyzeTranscriptionEnhanced(
      transcription,
      projectKnowledge,
      recordingDate,
      undefined,
      { forceModel: 'gpt-3.5-turbo' }
    )
    
    passes.push({
      model: 'gpt-3.5-turbo',
      confidence: quickResult.metadata.confidence,
      focus: 'basic_structure'
    })
    
    // If quick analysis has low confidence, do detailed pass with GPT-4
    if (quickResult.metadata.confidence < 0.7 || quickResult.metadata.complexity === 'complex') {
      const detailedResult = await analyzeTranscriptionEnhanced(
        transcription,
        projectKnowledge,
        recordingDate,
        undefined,
        { forceModel: 'gpt-4', skipCache: false }
      )
      
      passes.push({
        model: 'gpt-4',
        confidence: detailedResult.metadata.confidence,
        focus: 'detailed_analysis'
      })
      
      // Use the higher confidence result
      if (detailedResult.metadata.confidence > quickResult.metadata.confidence) {
        return {
          analysis: detailedResult.analysis,
          error: detailedResult.error,
          warning: detailedResult.warning,
          passes
        }
      }
    }
    
    return {
      analysis: quickResult.analysis,
      error: quickResult.error,
      warning: quickResult.warning,
      passes
    }
    
  } catch (error) {
    return {
      analysis: null,
      error: error instanceof Error ? error : new Error('Multi-pass analysis failed'),
      warning: 'Multi-pass analysis encountered errors',
      passes
    }
  }
}

/**
 * Clean analysis cache by removing old entries
 */
function cleanAnalysisCache(): void {
  const now = Date.now()
  const entries = Array.from(analysisCache.entries())
  
  // Remove expired entries first
  entries.forEach(([key, value]) => {
    if (now - value.timestamp > ANALYSIS_CACHE_DURATION) {
      analysisCache.delete(key)
    }
  })
  
  // If still too large, remove oldest entries
  if (analysisCache.size > MAX_CACHE_SIZE) {
    const sortedEntries = Array.from(analysisCache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)
    
    const toRemove = sortedEntries.slice(0, analysisCache.size - MAX_CACHE_SIZE + 50)
    toRemove.forEach(([key]) => analysisCache.delete(key))
    
    console.log(`Cleaned ${toRemove.length} entries from analysis cache`)
  }
}

/**
 * Get analysis performance metrics
 */
export function getAnalysisMetrics(): AnalysisMetrics & {
  cacheHitRate: number
  averageCostPerRequest: number
  cacheSize: number
} {
  return {
    ...analysisMetrics,
    cacheHitRate: analysisMetrics.totalRequests > 0 ? analysisMetrics.cacheHits / analysisMetrics.totalRequests : 0,
    averageCostPerRequest: analysisMetrics.totalRequests > 0 ? analysisMetrics.totalCost / analysisMetrics.totalRequests : 0,
    cacheSize: analysisCache.size
  }
}

/**
 * Reset analysis metrics (for testing or periodic resets)
 */
export function resetAnalysisMetrics(): void {
  Object.assign(analysisMetrics, {
    totalRequests: 0,
    cacheHits: 0,
    gpt4Requests: 0,
    gpt35Requests: 0,
    totalCost: 0,
    averageConfidence: 0,
    errorRate: 0
  })
  analysisCache.clear()
  console.log('Analysis metrics and cache reset')
}

export default openai