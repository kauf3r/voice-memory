/**
 * Environment-specific Configuration Overrides
 * 
 * Defines configuration overrides for different environments
 */

import { AppConfig } from './AppConfig'

export const developmentConfig: Partial<AppConfig> = {
  environment: 'development',
  processing: {
    timeoutMinutes: 5, // Shorter timeout for development
    maxAttempts: 2,
    batchSize: 2, // Smaller batch size for easier debugging
    retryDelayMs: 500,
    enableCircuitBreaker: true,
    circuitBreaker: {
      failureThreshold: 3, // Lower threshold for development
      timeoutMs: 120000, // 2 minutes
      resetTimeoutMs: 15000 // 15 seconds
    },
    enableBackgroundJobs: false,
    backgroundJobs: { maxConcurrency: 1, processingInterval: 5000, retryDelay: 1000, maxRetries: 2, enableScheduledMaintenance: false }
  },
  monitoring: {
    enableMetrics: true,
    enableLogging: true,
    logLevel: 'debug',
    metricsRetentionHours: 1,
    healthCheckInterval: 30000, // 30 seconds
    alerting: {
      enabled: false, // Disable alerting in development
      errorThreshold: 10
    }
  },
  security: {
    jwtSecret: 'dev-secret-key',
    sessionTimeout: 86400000, // 24 hours
    rateLimiting: {
      enabled: false, // Disable rate limiting in development
      windowMs: 900000,
      maxRequests: 1000 // Higher limit for development
    },
    cors: {
      enabled: true,
      origins: ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true
    }
  }
}

export const stagingConfig: Partial<AppConfig> = {
  environment: 'staging',
  processing: {
    timeoutMinutes: 10,
    maxAttempts: 3,
    batchSize: 3,
    retryDelayMs: 1000,
    enableCircuitBreaker: true,
    circuitBreaker: {
      failureThreshold: 4,
      timeoutMs: 240000, // 4 minutes
      resetTimeoutMs: 20000 // 20 seconds
    },
    enableBackgroundJobs: false,
    backgroundJobs: { maxConcurrency: 2, processingInterval: 5000, retryDelay: 1000, maxRetries: 3, enableScheduledMaintenance: false }
  },
  monitoring: {
    enableMetrics: true,
    enableLogging: true,
    logLevel: 'info',
    metricsRetentionHours: 12,
    healthCheckInterval: 60000, // 1 minute
    alerting: {
      enabled: true,
      errorThreshold: 5
    }
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || 'staging-secret-key',
    sessionTimeout: 43200000, // 12 hours
    rateLimiting: {
      enabled: true,
      windowMs: 900000, // 15 minutes
      maxRequests: 200
    },
    cors: {
      enabled: true,
      origins: ['https://staging.voice-memory.app'],
      credentials: true
    }
  }
}

export const productionConfig: Partial<AppConfig> = {
  environment: 'production',
  processing: {
    timeoutMinutes: 15,
    maxAttempts: 3,
    batchSize: 5,
    retryDelayMs: 1000,
    enableCircuitBreaker: true,
    circuitBreaker: {
      failureThreshold: 5,
      timeoutMs: 300000, // 5 minutes
      resetTimeoutMs: 30000 // 30 seconds
    },
    enableBackgroundJobs: false,
    backgroundJobs: { maxConcurrency: 3, processingInterval: 30000, retryDelay: 60000, maxRetries: 3, enableScheduledMaintenance: false }
  },
  monitoring: {
    enableMetrics: true,
    enableLogging: true,
    logLevel: 'warn', // Only warnings and errors in production
    metricsRetentionHours: 24,
    healthCheckInterval: 60000, // 1 minute
    alerting: {
      enabled: true,
      errorThreshold: 3 // Lower threshold for production alerts
    }
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || '',
    sessionTimeout: 28800000, // 8 hours
    rateLimiting: {
      enabled: true,
      windowMs: 900000, // 15 minutes
      maxRequests: 100
    },
    cors: {
      enabled: true,
      origins: ['https://voice-memory.app'],
      credentials: true
    }
  },
  features: {
    enableVideoProcessing: true,
    enableBatchProcessing: true,
    enableAdvancedAnalysis: true,
    enableRealtimeUpdates: true,
    enableTaskPinning: true,
    enableKnowledgeBase: true
  }
}

export const testConfig: Partial<AppConfig> = {
  environment: 'test',
  processing: {
    timeoutMinutes: 2, // Very short timeout for tests
    maxAttempts: 1,
    batchSize: 1,
    retryDelayMs: 100,
    enableCircuitBreaker: false, // Disable circuit breaker for tests
    circuitBreaker: {
      failureThreshold: 10,
      timeoutMs: 10000,
      resetTimeoutMs: 1000
    },
    enableBackgroundJobs: false,
    backgroundJobs: { maxConcurrency: 1, processingInterval: 1000, retryDelay: 100, maxRetries: 1, enableScheduledMaintenance: false }
  },
  monitoring: {
    enableMetrics: false, // Disable metrics in tests
    enableLogging: false, // Disable logging in tests
    logLevel: 'error',
    metricsRetentionHours: 0,
    healthCheckInterval: 10000,
    alerting: {
      enabled: false,
      errorThreshold: 100
    }
  },
  security: {
    jwtSecret: 'test-secret-key',
    sessionTimeout: 300000, // 5 minutes
    rateLimiting: {
      enabled: false, // Disable rate limiting in tests
      windowMs: 60000,
      maxRequests: 10000
    },
    cors: {
      enabled: false,
      origins: ['*'],
      credentials: false
    }
  },
  features: {
    enableVideoProcessing: false, // Simplify tests
    enableBatchProcessing: false,
    enableAdvancedAnalysis: false,
    enableRealtimeUpdates: false,
    enableTaskPinning: true,
    enableKnowledgeBase: true
  }
}

/**
 * Get environment-specific configuration overrides
 */
export function getEnvironmentConfig(environment: string): Partial<AppConfig> {
  switch (environment) {
    case 'development':
      return developmentConfig
    case 'staging':
      return stagingConfig
    case 'production':
      return productionConfig
    case 'test':
      return testConfig
    default:
      console.warn(`Unknown environment: ${environment}, using development config`)
      return developmentConfig
  }
}

/**
 * Feature flag presets for different environments
 */
export const featurePresets = {
  minimal: {
    enableVideoProcessing: false,
    enableBatchProcessing: false,
    enableAdvancedAnalysis: false,
    enableRealtimeUpdates: false,
    enableTaskPinning: true,
    enableKnowledgeBase: true
  },
  
  standard: {
    enableVideoProcessing: true,
    enableBatchProcessing: true,
    enableAdvancedAnalysis: true,
    enableRealtimeUpdates: true,
    enableTaskPinning: true,
    enableKnowledgeBase: true
  },
  
  enterprise: {
    enableVideoProcessing: true,
    enableBatchProcessing: true,
    enableAdvancedAnalysis: true,
    enableRealtimeUpdates: true,
    enableTaskPinning: true,
    enableKnowledgeBase: true
  }
}

/**
 * Performance presets for different deployment sizes
 */
export const performancePresets = {
  small: {
    processing: {
      batchSize: 2,
      maxAttempts: 2,
      timeoutMinutes: 10
    },
    database: {
      maxConnections: 5,
      defaultLimit: 25,
      maxLimit: 50
    }
  },
  
  medium: {
    processing: {
      batchSize: 5,
      maxAttempts: 3,
      timeoutMinutes: 15
    },
    database: {
      maxConnections: 10,
      defaultLimit: 50,
      maxLimit: 100
    }
  },
  
  large: {
    processing: {
      batchSize: 10,
      maxAttempts: 3,
      timeoutMinutes: 20
    },
    database: {
      maxConnections: 20,
      defaultLimit: 100,
      maxLimit: 200
    }
  }
}