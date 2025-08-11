/**
 * Application Configuration Management
 * 
 * Centralized configuration system for the Voice Memory application.
 * Manages environment variables, default values, and configuration validation.
 */

export interface DatabaseConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  supabaseServiceKey: string
  connectionTimeout: number
  maxConnections: number
  defaultLimit: number
  maxLimit: number
  lockTimeoutMinutes: number
}

export interface ProcessingConfig {
  timeoutMinutes: number
  maxAttempts: number
  batchSize: number
  retryDelayMs: number
  enableCircuitBreaker: boolean
  enableBackgroundJobs: boolean
  circuitBreaker: {
    failureThreshold: number
    timeoutMs: number
    resetTimeoutMs: number
  }
  backgroundJobs: {
    maxConcurrency: number
    processingInterval: number
    retryDelay: number
    maxRetries: number
    enableScheduledMaintenance: boolean
  }
}

export interface OpenAIConfig {
  apiKey: string
  model: string
  whisperModel: string
  maxTokens: number
  temperature: number
  requestTimeout: number
  maxRetries: number
}

export interface StorageConfig {
  bucket: string
  maxFileSize: number
  allowedMimeTypes: string[]
  uploadTimeout: number
  downloadTimeout: number
}

export interface SecurityConfig {
  jwtSecret: string
  sessionTimeout: number
  rateLimiting: {
    enabled: boolean
    windowMs: number
    maxRequests: number
  }
  cors: {
    enabled: boolean
    origins: string[]
    credentials: boolean
  }
}

export interface MonitoringConfig {
  enableMetrics: boolean
  enableLogging: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  metricsRetentionHours: number
  healthCheckInterval: number
  alerting: {
    enabled: boolean
    webhookUrl?: string
    slackChannel?: string
    errorThreshold: number
  }
}

export interface FeatureFlags {
  enableVideoProcessing: boolean
  enableBatchProcessing: boolean
  enableAdvancedAnalysis: boolean
  enableRealtimeUpdates: boolean
  enableTaskPinning: boolean
  enableKnowledgeBase: boolean
}

export interface AppConfig {
  environment: 'development' | 'production' | 'staging' | 'test'
  version: string
  database: DatabaseConfig
  processing: ProcessingConfig
  openai: OpenAIConfig
  storage: StorageConfig
  security: SecurityConfig
  monitoring: MonitoringConfig
  features: FeatureFlags
}

class ConfigManager {
  private config: AppConfig | null = null
  private initialized = false

  /**
   * Initialize the configuration system
   */
  initialize(): AppConfig {
    if (this.initialized && this.config) {
      return this.config
    }

    this.config = this.loadConfiguration()
    this.validateConfiguration(this.config)
    this.initialized = true

    console.log(`✅ Configuration initialized for ${this.config.environment} environment`)
    return this.config
  }

  /**
   * Get the current configuration
   */
  getConfig(): AppConfig {
    if (!this.initialized || !this.config) {
      return this.initialize()
    }
    return this.config
  }

  /**
   * Get a specific configuration section
   */
  getSection<K extends keyof AppConfig>(section: K): AppConfig[K] {
    return this.getConfig()[section]
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(feature: keyof FeatureFlags): boolean {
    return this.getConfig().features[feature]
  }

  /**
   * Get environment-specific configuration
   */
  isDevelopment(): boolean {
    return this.getConfig().environment === 'development'
  }

  isProduction(): boolean {
    return this.getConfig().environment === 'production'
  }

  isTest(): boolean {
    return this.getConfig().environment === 'test'
  }

  private loadConfiguration(): AppConfig {
    // Determine environment
    const environment = (process.env.NODE_ENV || 'development') as AppConfig['environment']
    
    return {
      environment,
      version: process.env.npm_package_version || '1.0.0',
      
      database: {
        supabaseUrl: this.getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
        supabaseAnonKey: this.getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
        supabaseServiceKey: this.getRequiredEnv('SUPABASE_SERVICE_KEY'),
        connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000'),
        maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
        defaultLimit: parseInt(process.env.DB_DEFAULT_LIMIT || '50'),
        maxLimit: parseInt(process.env.DB_MAX_LIMIT || '100'),
        lockTimeoutMinutes: parseInt(process.env.PROCESSING_TIMEOUT_MINUTES || '15')
      },
      
      processing: {
        timeoutMinutes: parseInt(process.env.PROCESSING_TIMEOUT_MINUTES || '15'),
        maxAttempts: parseInt(process.env.PROCESSING_MAX_ATTEMPTS || '3'),
        batchSize: parseInt(process.env.PROCESSING_BATCH_SIZE || '5'),
        retryDelayMs: parseInt(process.env.PROCESSING_RETRY_DELAY || '1000'),
        enableCircuitBreaker: process.env.ENABLE_CIRCUIT_BREAKER !== 'false',
        enableBackgroundJobs: process.env.ENABLE_BACKGROUND_JOBS !== 'false',
        circuitBreaker: {
          failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5'),
          timeoutMs: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '300000'), // 5 minutes
          resetTimeoutMs: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '30000') // 30 seconds
        },
        backgroundJobs: {
          maxConcurrency: parseInt(process.env.BACKGROUND_JOBS_MAX_CONCURRENCY || '3'),
          processingInterval: parseInt(process.env.BACKGROUND_JOBS_INTERVAL || '30000'), // 30 seconds
          retryDelay: parseInt(process.env.BACKGROUND_JOBS_RETRY_DELAY || '60000'), // 1 minute
          maxRetries: parseInt(process.env.BACKGROUND_JOBS_MAX_RETRIES || '3'),
          enableScheduledMaintenance: process.env.ENABLE_SCHEDULED_MAINTENANCE !== 'false'
        }
      },
      
      openai: {
        apiKey: this.getRequiredEnv('OPENAI_API_KEY'),
        model: process.env.OPENAI_MODEL || 'gpt-4',
        whisperModel: process.env.WHISPER_MODEL || 'whisper-1',
        maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2000'),
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
        requestTimeout: parseInt(process.env.OPENAI_REQUEST_TIMEOUT || '60000'),
        maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3')
      },
      
      storage: {
        bucket: process.env.STORAGE_BUCKET || 'audio-files',
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600'), // 100MB
        allowedMimeTypes: (process.env.ALLOWED_MIME_TYPES || 'audio/*,video/*').split(','),
        uploadTimeout: parseInt(process.env.UPLOAD_TIMEOUT || '300000'), // 5 minutes
        downloadTimeout: parseInt(process.env.DOWNLOAD_TIMEOUT || '60000') // 1 minute
      },
      
      security: {
        jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
        sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '86400000'), // 24 hours
        rateLimiting: {
          enabled: process.env.ENABLE_RATE_LIMITING !== 'false',
          windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
          maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100')
        },
        cors: {
          enabled: process.env.ENABLE_CORS !== 'false',
          origins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
          credentials: process.env.CORS_CREDENTIALS !== 'false'
        }
      },
      
      monitoring: {
        enableMetrics: process.env.ENABLE_METRICS !== 'false',
        enableLogging: process.env.ENABLE_LOGGING !== 'false',
        logLevel: (process.env.LOG_LEVEL || 'info') as MonitoringConfig['logLevel'],
        metricsRetentionHours: parseInt(process.env.METRICS_RETENTION_HOURS || '24'),
        healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '60000'), // 1 minute
        alerting: {
          enabled: process.env.ENABLE_ALERTING === 'true' && (!!process.env.ALERT_WEBHOOK_URL || !!process.env.SLACK_ALERT_CHANNEL),
          webhookUrl: process.env.ALERT_WEBHOOK_URL,
          slackChannel: process.env.SLACK_ALERT_CHANNEL,
          errorThreshold: parseInt(process.env.ALERT_ERROR_THRESHOLD || '5')
        }
      },
      
      features: {
        enableVideoProcessing: process.env.ENABLE_VIDEO_PROCESSING !== 'false',
        enableBatchProcessing: process.env.ENABLE_BATCH_PROCESSING !== 'false',
        enableAdvancedAnalysis: process.env.ENABLE_ADVANCED_ANALYSIS !== 'false',
        enableRealtimeUpdates: process.env.ENABLE_REALTIME_UPDATES !== 'false',
        enableTaskPinning: process.env.ENABLE_TASK_PINNING !== 'false',
        enableKnowledgeBase: process.env.ENABLE_KNOWLEDGE_BASE !== 'false'
      }
    }
  }

  private getRequiredEnv(key: string): string {
    const value = process.env[key]
    if (!value) {
      throw new Error(`Required environment variable ${key} is not set`)
    }
    return value
  }

  private validateConfiguration(config: AppConfig): void {
    const errors: string[] = []

    // Validate database configuration
    if (!config.database.supabaseUrl.startsWith('https://')) {
      errors.push('Database URL must start with https://')
    }

    if (config.database.lockTimeoutMinutes < 1) {
      errors.push('Lock timeout must be at least 1 minute')
    }

    if (config.database.maxLimit < config.database.defaultLimit) {
      errors.push('Database max limit must be greater than or equal to default limit')
    }

    // Validate processing configuration
    if (config.processing.maxAttempts < 1) {
      errors.push('Processing max attempts must be at least 1')
    }

    if (config.processing.circuitBreaker.failureThreshold < 1) {
      errors.push('Circuit breaker failure threshold must be at least 1')
    }

    // Validate OpenAI configuration
    // Skip API key format validation as OpenAI key formats may change
    // The API itself will validate the key when making requests

    if (config.openai.maxTokens < 100) {
      errors.push('OpenAI max tokens must be at least 100')
    }

    if (config.openai.temperature < 0 || config.openai.temperature > 2) {
      errors.push('OpenAI temperature must be between 0 and 2')
    }

    // Validate storage configuration
    if (config.storage.maxFileSize < 1024) {
      errors.push('Max file size must be at least 1KB')
    }

    if (config.storage.allowedMimeTypes.length === 0) {
      errors.push('At least one MIME type must be allowed')
    }

    // Validate security configuration
    if (config.security.sessionTimeout < 300000) { // 5 minutes
      errors.push('Session timeout must be at least 5 minutes')
    }

    if (config.security.rateLimiting.maxRequests < 1) {
      errors.push('Rate limiting max requests must be at least 1')
    }

    // Log warnings for development environment
    if (config.environment === 'development') {
      if (config.security.jwtSecret === 'your-secret-key') {
        console.warn('⚠️ Using default JWT secret in development mode')
      }
    }

    // Production environment validation
    if (config.environment === 'production' || config.environment === 'staging') {
      // Check for default or weak secrets
      if (config.security.jwtSecret === 'your-secret-key' || 
          config.security.jwtSecret.length < 32) {
        errors.push('Production requires a strong JWT secret (minimum 32 characters)')
      }

      // Verify API keys are not using defaults or test values
      if (!config.openai.apiKey || 
          config.openai.apiKey.startsWith('sk-test') ||
          config.openai.apiKey === 'your-api-key') {
        errors.push('Production requires valid OpenAI API key')
      }

      // Validate Supabase configuration
      if (!config.database.supabaseUrl.startsWith('https://')) {
        errors.push('Production database URL must use HTTPS')
      }

      if (config.database.supabaseServiceKey === 'your-service-key' ||
          config.database.supabaseServiceKey.length < 40) {
        errors.push('Production requires valid Supabase service key')
      }

      // Validate CORS configuration
      if (config.security.cors.enabled) {
        const validOrigins = config.security.cors.origins.filter(origin => {
          // Check for wildcards or localhost in production
          if (origin === '*' || origin.includes('localhost') || origin.includes('127.0.0.1')) {
            return false
          }
          // Ensure HTTPS for production origins
          if (!origin.startsWith('https://') && !origin.startsWith('http://localhost')) {
            return false
          }
          return true
        })

        if (validOrigins.length !== config.security.cors.origins.length) {
          errors.push('Production CORS origins must use HTTPS and cannot use wildcards or localhost')
        }
      }

      // Ensure rate limiting is enabled
      if (!config.security.rateLimiting.enabled) {
        errors.push('Rate limiting must be enabled in production')
      }

      if (config.security.rateLimiting.maxRequests > 1000) {
        errors.push('Production rate limit seems too high (> 1000 requests per window)')
      }

      // Validate session security
      if (config.security.sessionTimeout > 86400000 * 7) { // 7 days
        errors.push('Production session timeout should not exceed 7 days')
      }

      // Check monitoring configuration
      if (!config.monitoring.enableMetrics) {
        console.warn('⚠️ Metrics collection is disabled in production')
      }

      if (!config.monitoring.enableLogging) {
        console.warn('⚠️ Logging is disabled in production')
      }

      // Validate file upload limits
      if (config.storage.maxFileSize > 104857600) { // 100MB
        console.warn('⚠️ File size limit exceeds 100MB in production')
      }

      // Check for required production features
      if (!config.processing.enableCircuitBreaker) {
        console.warn('⚠️ Circuit breaker is disabled in production')
      }

      // Log production configuration summary for audit
      console.log('🔒 Production security validation completed')
      console.log(`  Environment: ${config.environment}`)
      console.log(`  Rate limiting: ${config.security.rateLimiting.enabled ? 'Enabled' : 'Disabled'}`)
      console.log(`  CORS origins: ${config.security.cors.origins.length} configured`)
      console.log(`  Session timeout: ${config.security.sessionTimeout / 3600000} hours`)
      console.log(`  Circuit breaker: ${config.processing.enableCircuitBreaker ? 'Enabled' : 'Disabled'}`)
    }

    // Throw error if validation fails
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`)
    }

    console.log('✅ Configuration validation passed')
  }

  /**
   * Update configuration at runtime (for testing or feature toggles)
   */
  updateConfig(updates: Partial<AppConfig>): void {
    if (!this.config) {
      throw new Error('Configuration not initialized')
    }

    this.config = { ...this.config, ...updates }
    this.validateConfiguration(this.config)
    
    console.log('✅ Configuration updated')
  }

  /**
   * Get configuration summary for logging/debugging
   */
  getConfigSummary(): any {
    const config = this.getConfig()
    
    return {
      environment: config.environment,
      version: config.version,
      features: config.features,
      processing: {
        timeoutMinutes: config.processing.timeoutMinutes,
        maxAttempts: config.processing.maxAttempts,
        batchSize: config.processing.batchSize,
        circuitBreakerEnabled: config.processing.enableCircuitBreaker
      },
      monitoring: {
        metricsEnabled: config.monitoring.enableMetrics,
        loggingEnabled: config.monitoring.enableLogging,
        logLevel: config.monitoring.logLevel,
        alertingEnabled: config.monitoring.alerting.enabled
      }
    }
  }
}

// Singleton instance
export const configManager = new ConfigManager()

// Convenience exports
export const getConfig = () => configManager.getConfig()
export const getSection = <K extends keyof AppConfig>(section: K) => configManager.getSection(section)
export const isFeatureEnabled = (feature: keyof FeatureFlags) => configManager.isFeatureEnabled(feature)
export const isDevelopment = () => configManager.isDevelopment()
export const isProduction = () => configManager.isProduction()
export const isTest = () => configManager.isTest()

// Initialize configuration on module load
export default configManager.initialize()