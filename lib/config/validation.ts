/**
 * Configuration Validation System
 * 
 * Comprehensive validation for application configuration
 */

import { AppConfig, DatabaseConfig, ProcessingConfig, OpenAIConfig, StorageConfig, SecurityConfig, MonitoringConfig } from './AppConfig'

export interface ValidationError {
  field: string
  message: string
  severity: 'error' | 'warning' | 'info'
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
}

export class ConfigValidator {
  
  /**
   * Validate the complete application configuration
   */
  static validate(config: AppConfig): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationError[] = []

    // Validate each section
    errors.push(...this.validateDatabase(config.database))
    errors.push(...this.validateProcessing(config.processing))
    errors.push(...this.validateOpenAI(config.openai))
    errors.push(...this.validateStorage(config.storage))
    errors.push(...this.validateSecurity(config.security))
    errors.push(...this.validateMonitoring(config.monitoring))

    // Environment-specific validations
    warnings.push(...this.validateEnvironment(config))

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  private static validateDatabase(config: DatabaseConfig): ValidationError[] {
    const errors: ValidationError[] = []

    // Required fields
    if (!config.supabaseUrl) {
      errors.push({
        field: 'database.supabaseUrl',
        message: 'Supabase URL is required',
        severity: 'error'
      })
    } else if (!config.supabaseUrl.startsWith('https://')) {
      errors.push({
        field: 'database.supabaseUrl',
        message: 'Supabase URL must start with https://',
        severity: 'error'
      })
    } else if (!config.supabaseUrl.includes('.supabase.co')) {
      errors.push({
        field: 'database.supabaseUrl',
        message: 'Supabase URL should contain .supabase.co',
        severity: 'warning'
      })
    }

    if (!config.supabaseAnonKey) {
      errors.push({
        field: 'database.supabaseAnonKey',
        message: 'Supabase anonymous key is required',
        severity: 'error'
      })
    } else if (config.supabaseAnonKey.length < 100) {
      errors.push({
        field: 'database.supabaseAnonKey',
        message: 'Supabase anonymous key seems too short',
        severity: 'warning'
      })
    }

    if (!config.supabaseServiceKey) {
      errors.push({
        field: 'database.supabaseServiceKey',
        message: 'Supabase service key is required',
        severity: 'error'
      })
    } else if (config.supabaseServiceKey.length < 100) {
      errors.push({
        field: 'database.supabaseServiceKey',
        message: 'Supabase service key seems too short',
        severity: 'warning'
      })
    }

    // Numeric validations
    if (config.connectionTimeout < 1000) {
      errors.push({
        field: 'database.connectionTimeout',
        message: 'Connection timeout must be at least 1000ms',
        severity: 'error'
      })
    }

    if (config.maxConnections < 1) {
      errors.push({
        field: 'database.maxConnections',
        message: 'Max connections must be at least 1',
        severity: 'error'
      })
    } else if (config.maxConnections > 100) {
      errors.push({
        field: 'database.maxConnections',
        message: 'Max connections seems very high (>100)',
        severity: 'warning'
      })
    }

    if (config.defaultLimit < 1) {
      errors.push({
        field: 'database.defaultLimit',
        message: 'Default limit must be at least 1',
        severity: 'error'
      })
    }

    if (config.maxLimit < config.defaultLimit) {
      errors.push({
        field: 'database.maxLimit',
        message: 'Max limit must be greater than or equal to default limit',
        severity: 'error'
      })
    }

    if (config.lockTimeoutMinutes < 1) {
      errors.push({
        field: 'database.lockTimeoutMinutes',
        message: 'Lock timeout must be at least 1 minute',
        severity: 'error'
      })
    } else if (config.lockTimeoutMinutes > 60) {
      errors.push({
        field: 'database.lockTimeoutMinutes',
        message: 'Lock timeout seems very long (>60 minutes)',
        severity: 'warning'
      })
    }

    return errors
  }

  private static validateProcessing(config: ProcessingConfig): ValidationError[] {
    const errors: ValidationError[] = []

    if (config.timeoutMinutes < 1) {
      errors.push({
        field: 'processing.timeoutMinutes',
        message: 'Processing timeout must be at least 1 minute',
        severity: 'error'
      })
    } else if (config.timeoutMinutes > 120) {
      errors.push({
        field: 'processing.timeoutMinutes',
        message: 'Processing timeout seems very long (>120 minutes)',
        severity: 'warning'
      })
    }

    if (config.maxAttempts < 1) {
      errors.push({
        field: 'processing.maxAttempts',
        message: 'Max attempts must be at least 1',
        severity: 'error'
      })
    } else if (config.maxAttempts > 10) {
      errors.push({
        field: 'processing.maxAttempts',
        message: 'Max attempts seems very high (>10)',
        severity: 'warning'
      })
    }

    if (config.batchSize < 1) {
      errors.push({
        field: 'processing.batchSize',
        message: 'Batch size must be at least 1',
        severity: 'error'
      })
    } else if (config.batchSize > 50) {
      errors.push({
        field: 'processing.batchSize',
        message: 'Batch size seems very large (>50)',
        severity: 'warning'
      })
    }

    if (config.retryDelayMs < 100) {
      errors.push({
        field: 'processing.retryDelayMs',
        message: 'Retry delay must be at least 100ms',
        severity: 'error'
      })
    }

    // Circuit breaker validation
    if (config.circuitBreaker.failureThreshold < 1) {
      errors.push({
        field: 'processing.circuitBreaker.failureThreshold',
        message: 'Circuit breaker failure threshold must be at least 1',
        severity: 'error'
      })
    }

    if (config.circuitBreaker.timeoutMs < 1000) {
      errors.push({
        field: 'processing.circuitBreaker.timeoutMs',
        message: 'Circuit breaker timeout must be at least 1000ms',
        severity: 'error'
      })
    }

    if (config.circuitBreaker.resetTimeoutMs < 1000) {
      errors.push({
        field: 'processing.circuitBreaker.resetTimeoutMs',
        message: 'Circuit breaker reset timeout must be at least 1000ms',
        severity: 'error'
      })
    }

    return errors
  }

  private static validateOpenAI(config: OpenAIConfig): ValidationError[] {
    const errors: ValidationError[] = []

    if (!config.apiKey) {
      errors.push({
        field: 'openai.apiKey',
        message: 'OpenAI API key is required',
        severity: 'error'
      })
    } else if (!config.apiKey.startsWith('sk-')) {
      errors.push({
        field: 'openai.apiKey',
        message: 'OpenAI API key should start with sk-',
        severity: 'error'
      })
    } else if (config.apiKey.length < 40) {
      errors.push({
        field: 'openai.apiKey',
        message: 'OpenAI API key seems too short',
        severity: 'warning'
      })
    }

    if (!config.model) {
      errors.push({
        field: 'openai.model',
        message: 'OpenAI model is required',
        severity: 'error'
      })
    }

    if (!config.whisperModel) {
      errors.push({
        field: 'openai.whisperModel',
        message: 'Whisper model is required',
        severity: 'error'
      })
    }

    if (config.maxTokens < 100) {
      errors.push({
        field: 'openai.maxTokens',
        message: 'Max tokens must be at least 100',
        severity: 'error'
      })
    } else if (config.maxTokens > 8000) {
      errors.push({
        field: 'openai.maxTokens',
        message: 'Max tokens seems very high (>8000)',
        severity: 'warning'
      })
    }

    if (config.temperature < 0 || config.temperature > 2) {
      errors.push({
        field: 'openai.temperature',
        message: 'Temperature must be between 0 and 2',
        severity: 'error'
      })
    }

    if (config.requestTimeout < 10000) {
      errors.push({
        field: 'openai.requestTimeout',
        message: 'Request timeout should be at least 10 seconds',
        severity: 'warning'
      })
    }

    if (config.maxRetries < 1) {
      errors.push({
        field: 'openai.maxRetries',
        message: 'Max retries must be at least 1',
        severity: 'error'
      })
    }

    return errors
  }

  private static validateStorage(config: StorageConfig): ValidationError[] {
    const errors: ValidationError[] = []

    if (!config.bucket) {
      errors.push({
        field: 'storage.bucket',
        message: 'Storage bucket name is required',
        severity: 'error'
      })
    }

    if (config.maxFileSize < 1024) {
      errors.push({
        field: 'storage.maxFileSize',
        message: 'Max file size must be at least 1KB',
        severity: 'error'
      })
    } else if (config.maxFileSize > 1073741824) { // 1GB
      errors.push({
        field: 'storage.maxFileSize',
        message: 'Max file size seems very large (>1GB)',
        severity: 'warning'
      })
    }

    if (config.allowedMimeTypes.length === 0) {
      errors.push({
        field: 'storage.allowedMimeTypes',
        message: 'At least one MIME type must be allowed',
        severity: 'error'
      })
    }

    if (config.uploadTimeout < 10000) {
      errors.push({
        field: 'storage.uploadTimeout',
        message: 'Upload timeout should be at least 10 seconds',
        severity: 'warning'
      })
    }

    if (config.downloadTimeout < 5000) {
      errors.push({
        field: 'storage.downloadTimeout',
        message: 'Download timeout should be at least 5 seconds',
        severity: 'warning'
      })
    }

    return errors
  }

  private static validateSecurity(config: SecurityConfig): ValidationError[] {
    const errors: ValidationError[] = []

    if (!config.jwtSecret) {
      errors.push({
        field: 'security.jwtSecret',
        message: 'JWT secret is required',
        severity: 'error'
      })
    } else if (config.jwtSecret.length < 32) {
      errors.push({
        field: 'security.jwtSecret',
        message: 'JWT secret should be at least 32 characters long',
        severity: 'warning'
      })
    } else if (config.jwtSecret === 'your-secret-key') {
      errors.push({
        field: 'security.jwtSecret',
        message: 'JWT secret should not use the default value',
        severity: 'warning'
      })
    }

    if (config.sessionTimeout < 300000) { // 5 minutes
      errors.push({
        field: 'security.sessionTimeout',
        message: 'Session timeout should be at least 5 minutes',
        severity: 'warning'
      })
    }

    if (config.rateLimiting.windowMs < 60000) { // 1 minute
      errors.push({
        field: 'security.rateLimiting.windowMs',
        message: 'Rate limiting window should be at least 1 minute',
        severity: 'warning'
      })
    }

    if (config.rateLimiting.maxRequests < 1) {
      errors.push({
        field: 'security.rateLimiting.maxRequests',
        message: 'Rate limiting max requests must be at least 1',
        severity: 'error'
      })
    }

    if (config.cors.origins.length === 0) {
      errors.push({
        field: 'security.cors.origins',
        message: 'At least one CORS origin must be specified',
        severity: 'error'
      })
    }

    return errors
  }

  private static validateMonitoring(config: MonitoringConfig): ValidationError[] {
    const errors: ValidationError[] = []

    const validLogLevels = ['debug', 'info', 'warn', 'error']
    if (!validLogLevels.includes(config.logLevel)) {
      errors.push({
        field: 'monitoring.logLevel',
        message: `Log level must be one of: ${validLogLevels.join(', ')}`,
        severity: 'error'
      })
    }

    if (config.metricsRetentionHours < 1) {
      errors.push({
        field: 'monitoring.metricsRetentionHours',
        message: 'Metrics retention must be at least 1 hour',
        severity: 'error'
      })
    } else if (config.metricsRetentionHours > 168) { // 1 week
      errors.push({
        field: 'monitoring.metricsRetentionHours',
        message: 'Metrics retention seems very long (>1 week)',
        severity: 'warning'
      })
    }

    if (config.healthCheckInterval < 10000) {
      errors.push({
        field: 'monitoring.healthCheckInterval',
        message: 'Health check interval should be at least 10 seconds',
        severity: 'warning'
      })
    }

    if (config.alerting.enabled) {
      if (!config.alerting.webhookUrl && !config.alerting.slackChannel) {
        errors.push({
          field: 'monitoring.alerting',
          message: 'Either webhook URL or Slack channel must be configured when alerting is enabled',
          severity: 'error'
        })
      }

      if (config.alerting.errorThreshold < 1) {
        errors.push({
          field: 'monitoring.alerting.errorThreshold',
          message: 'Alert error threshold must be at least 1',
          severity: 'error'
        })
      }
    }

    return errors
  }

  private static validateEnvironment(config: AppConfig): ValidationError[] {
    const warnings: ValidationError[] = []

    if (config.environment === 'production') {
      // Production-specific warnings
      if (config.monitoring.logLevel === 'debug') {
        warnings.push({
          field: 'monitoring.logLevel',
          message: 'Debug logging is not recommended in production',
          severity: 'warning'
        })
      }

      if (!config.security.rateLimiting.enabled) {
        warnings.push({
          field: 'security.rateLimiting.enabled',
          message: 'Rate limiting should be enabled in production',
          severity: 'warning'
        })
      }

      if (!config.monitoring.alerting.enabled) {
        warnings.push({
          field: 'monitoring.alerting.enabled',
          message: 'Alerting should be enabled in production',
          severity: 'warning'
        })
      }

      if (config.processing.batchSize > 10) {
        warnings.push({
          field: 'processing.batchSize',
          message: 'Large batch sizes may impact performance in production',
          severity: 'warning'
        })
      }
    }

    if (config.environment === 'development') {
      // Development-specific warnings
      if (config.security.jwtSecret === 'your-secret-key' || config.security.jwtSecret === 'dev-secret-key') {
        warnings.push({
          field: 'security.jwtSecret',
          message: 'Consider using a unique JWT secret even in development',
          severity: 'info'
        })
      }
    }

    return warnings
  }

  /**
   * Quick validation for critical settings
   */
  static validateCritical(config: AppConfig): ValidationError[] {
    const errors: ValidationError[] = []

    // Critical environment variables
    if (!config.database.supabaseUrl) {
      errors.push({
        field: 'database.supabaseUrl',
        message: 'Supabase URL is required for application to function',
        severity: 'error'
      })
    }

    if (!config.openai.apiKey) {
      errors.push({
        field: 'openai.apiKey',
        message: 'OpenAI API key is required for transcription and analysis',
        severity: 'error'
      })
    }

    if (!config.database.supabaseServiceKey) {
      errors.push({
        field: 'database.supabaseServiceKey',
        message: 'Supabase service key is required for server operations',
        severity: 'error'
      })
    }

    return errors
  }
}