/**
 * Configuration System Entry Point
 * 
 * Main configuration loader and manager for the Voice Memory application.
 * Provides a unified interface for accessing all configuration settings.
 */

import { AppConfig, configManager } from './AppConfig'
import { getEnvironmentConfig, featurePresets, performancePresets } from './environments'
import { ConfigValidator, ValidationResult } from './validation'

export type { 
  AppConfig, 
  DatabaseConfig, 
  ProcessingConfig, 
  OpenAIConfig, 
  StorageConfig, 
  SecurityConfig, 
  MonitoringConfig, 
  FeatureFlags 
} from './AppConfig'

export type { ValidationError, ValidationResult } from './validation'

/**
 * Enhanced Configuration Manager with environment-specific overrides
 */
class EnhancedConfigManager {
  private baseConfig: AppConfig | null = null
  private validationResult: ValidationResult | null = null
  private initialized = false

  /**
   * Initialize configuration with environment-specific overrides
   */
  initialize(): AppConfig {
    if (this.initialized && this.baseConfig) {
      return this.baseConfig
    }

    // Get base configuration
    const baseConfig = configManager.getConfig()
    
    // Apply environment-specific overrides
    const envOverrides = getEnvironmentConfig(baseConfig.environment)
    this.baseConfig = this.mergeConfig(baseConfig, envOverrides)

    // Apply feature and performance presets if specified
    this.applyPresets()

    // Validate configuration
    this.validationResult = ConfigValidator.validate(this.baseConfig)
    this.handleValidationResult()

    this.initialized = true
    
    console.log(`🎯 Enhanced configuration initialized for ${this.baseConfig.environment}`)
    console.log(`📊 Features enabled: ${Object.entries(this.baseConfig.features).filter(([_, enabled]) => enabled).map(([feature]) => feature).join(', ')}`)
    
    return this.baseConfig
  }

  /**
   * Get the current configuration
   */
  getConfig(): AppConfig {
    if (!this.initialized || !this.baseConfig) {
      return this.initialize()
    }
    return this.baseConfig
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
  isFeatureEnabled(feature: keyof AppConfig['features']): boolean {
    return this.getConfig().features[feature]
  }

  /**
   * Get validation result
   */
  getValidationResult(): ValidationResult | null {
    return this.validationResult
  }

  /**
   * Validate current configuration
   */
  validate(): ValidationResult {
    const config = this.getConfig()
    this.validationResult = ConfigValidator.validate(config)
    return this.validationResult
  }

  /**
   * Update feature flags at runtime
   */
  updateFeatures(features: Partial<AppConfig['features']>): void {
    const config = this.getConfig()
    config.features = { ...config.features, ...features }
    
    // Re-validate after update
    this.validationResult = ConfigValidator.validate(config)
    this.handleValidationResult()

    console.log(`🔄 Feature flags updated:`, features)
  }

  /**
   * Update processing configuration at runtime
   */
  updateProcessingConfig(processing: Partial<AppConfig['processing']>): void {
    const config = this.getConfig()
    config.processing = { ...config.processing, ...processing }
    
    // Re-validate after update
    this.validationResult = ConfigValidator.validate(config)
    this.handleValidationResult()

    console.log(`🔄 Processing configuration updated:`, processing)
  }

  /**
   * Apply feature preset
   */
  applyFeaturePreset(preset: keyof typeof featurePresets): void {
    const presetConfig = featurePresets[preset]
    if (presetConfig) {
      this.updateFeatures(presetConfig)
      console.log(`✅ Applied feature preset: ${preset}`)
    } else {
      console.warn(`⚠️ Unknown feature preset: ${preset}`)
    }
  }

  /**
   * Apply performance preset
   */
  applyPerformancePreset(preset: keyof typeof performancePresets): void {
    const presetConfig = performancePresets[preset]
    if (presetConfig) {
      const config = this.getConfig()
      config.processing = { ...config.processing, ...presetConfig.processing }
      config.database = { ...config.database, ...presetConfig.database }
      
      // Re-validate after update
      this.validationResult = ConfigValidator.validate(config)
      this.handleValidationResult()
      
      console.log(`✅ Applied performance preset: ${preset}`)
    } else {
      console.warn(`⚠️ Unknown performance preset: ${preset}`)
    }
  }

  /**
   * Get configuration summary for monitoring/debugging
   */
  getSummary(): any {
    const config = this.getConfig()
    const validation = this.getValidationResult()
    
    return {
      environment: config.environment,
      version: config.version,
      initialized: this.initialized,
      validation: {
        isValid: validation?.isValid || false,
        errorCount: validation?.errors.length || 0,
        warningCount: validation?.warnings.length || 0
      },
      features: {
        enabled: Object.entries(config.features).filter(([_, enabled]) => enabled).map(([feature]) => feature),
        disabled: Object.entries(config.features).filter(([_, enabled]) => !enabled).map(([feature]) => feature)
      },
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

  /**
   * Check if configuration is ready for production
   */
  isProductionReady(): boolean {
    const config = this.getConfig()
    const validation = this.getValidationResult()
    
    if (!validation?.isValid) {
      return false
    }

    // Check critical production requirements
    const criticalChecks = [
      config.openai.apiKey && config.openai.apiKey !== 'your-api-key',
      config.database.supabaseUrl && config.database.supabaseUrl.includes('.supabase.co'),
      config.database.supabaseServiceKey && config.database.supabaseServiceKey.length > 50,
      config.security.jwtSecret && config.security.jwtSecret !== 'your-secret-key',
      config.monitoring.alerting.enabled,
      config.security.rateLimiting.enabled
    ]

    return criticalChecks.every(check => check)
  }

  private mergeConfig(base: AppConfig, overrides: Partial<AppConfig>): AppConfig {
    // Deep merge configuration objects
    return {
      ...base,
      ...overrides,
      database: { ...base.database, ...overrides.database },
      processing: { 
        ...base.processing, 
        ...overrides.processing,
        circuitBreaker: { 
          ...base.processing.circuitBreaker, 
          ...overrides.processing?.circuitBreaker 
        }
      },
      openai: { ...base.openai, ...overrides.openai },
      storage: { ...base.storage, ...overrides.storage },
      security: {
        ...base.security,
        ...overrides.security,
        rateLimiting: { 
          ...base.security.rateLimiting, 
          ...overrides.security?.rateLimiting 
        },
        cors: { 
          ...base.security.cors, 
          ...overrides.security?.cors 
        }
      },
      monitoring: {
        ...base.monitoring,
        ...overrides.monitoring,
        alerting: { 
          ...base.monitoring.alerting, 
          ...overrides.monitoring?.alerting 
        }
      },
      features: { ...base.features, ...overrides.features }
    }
  }

  private applyPresets(): void {
    if (!this.baseConfig) return

    // Apply feature preset from environment variable
    const featurePreset = process.env.FEATURE_PRESET as keyof typeof featurePresets
    if (featurePreset && featurePresets[featurePreset]) {
      this.baseConfig.features = { ...this.baseConfig.features, ...featurePresets[featurePreset] }
      console.log(`✅ Applied feature preset from env: ${featurePreset}`)
    }

    // Apply performance preset from environment variable
    const performancePreset = process.env.PERFORMANCE_PRESET as keyof typeof performancePresets
    if (performancePreset && performancePresets[performancePreset]) {
      const preset = performancePresets[performancePreset]
      this.baseConfig.processing = { ...this.baseConfig.processing, ...preset.processing }
      this.baseConfig.database = { ...this.baseConfig.database, ...preset.database }
      console.log(`✅ Applied performance preset from env: ${performancePreset}`)
    }
  }

  private handleValidationResult(): void {
    if (!this.validationResult) return

    // Log validation errors
    if (this.validationResult.errors.length > 0) {
      console.error('🚨 Configuration validation errors:')
      this.validationResult.errors.forEach(error => {
        console.error(`  ❌ ${error.field}: ${error.message}`)
      })
      
      // Check for critical errors
      const criticalErrors = ConfigValidator.validateCritical(this.baseConfig!)
      if (criticalErrors.length > 0) {
        console.error('💥 Critical configuration errors found!')
        throw new Error(`Critical configuration errors: ${criticalErrors.map(e => e.message).join(', ')}`)
      }
    }

    // Log validation warnings
    if (this.validationResult.warnings.length > 0) {
      console.warn('⚠️ Configuration validation warnings:')
      this.validationResult.warnings.forEach(warning => {
        console.warn(`  ⚠️ ${warning.field}: ${warning.message}`)
      })
    }

    if (this.validationResult.isValid) {
      console.log('✅ Configuration validation passed')
    }
  }
}

// Create singleton instance
const enhancedConfigManager = new EnhancedConfigManager()

// Initialize configuration on module load
const config = enhancedConfigManager.initialize()

// Export convenience functions
export const getConfig = () => enhancedConfigManager.getConfig()
export const getSection = <K extends keyof AppConfig>(section: K) => enhancedConfigManager.getSection(section)
export const isFeatureEnabled = (feature: keyof AppConfig['features']) => enhancedConfigManager.isFeatureEnabled(feature)
export const updateFeatures = (features: Partial<AppConfig['features']>) => enhancedConfigManager.updateFeatures(features)
export const updateProcessingConfig = (processing: Partial<AppConfig['processing']>) => enhancedConfigManager.updateProcessingConfig(processing)
export const applyFeaturePreset = (preset: keyof typeof featurePresets) => enhancedConfigManager.applyFeaturePreset(preset)
export const applyPerformancePreset = (preset: keyof typeof performancePresets) => enhancedConfigManager.applyPerformancePreset(preset)
export const getValidationResult = () => enhancedConfigManager.getValidationResult()
export const validateConfig = () => enhancedConfigManager.validate()
export const getConfigSummary = () => enhancedConfigManager.getSummary()
export const isProductionReady = () => enhancedConfigManager.isProductionReady()

// Environment helpers
export const isDevelopment = () => config.environment === 'development'
export const isProduction = () => config.environment === 'production'
export const isStaging = () => config.environment === 'staging'
export const isTest = () => config.environment === 'test'

// Export the enhanced manager for advanced usage
export { enhancedConfigManager as configManager }

// Export the initialized configuration as default
export default config