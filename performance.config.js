/**
 * Performance Budget Configuration for Voice Memory
 * These thresholds help maintain optimal performance standards
 */

const performanceBudgets = {
  // Bundle Size Budgets (in bytes)
  budgets: [
    {
      path: '/_app',
      timings: [
        {
          metric: 'script',
          budget: 400000, // 400KB for main JavaScript bundle
          tolerance: 10 // 10% tolerance
        },
        {
          metric: 'style',
          budget: 50000, // 50KB for CSS
          tolerance: 15
        },
        {
          metric: 'total',
          budget: 600000, // 600KB total for main page
          tolerance: 10
        }
      ]
    },
    {
      path: '/',
      timings: [
        {
          metric: 'first-contentful-paint',
          budget: 1800, // 1.8 seconds
          tolerance: 10
        },
        {
          metric: 'largest-contentful-paint',
          budget: 2500, // 2.5 seconds
          tolerance: 15
        },
        {
          metric: 'cumulative-layout-shift',
          budget: 0.1, // CLS should be under 0.1
          tolerance: 50
        },
        {
          metric: 'time-to-interactive',
          budget: 3800, // 3.8 seconds
          tolerance: 20
        }
      ]
    }
  ],

  // Performance Thresholds
  thresholds: {
    // Core Web Vitals
    coreWebVitals: {
      LCP: { good: 2500, poor: 4000 },
      FID: { good: 100, poor: 300 },
      CLS: { good: 0.1, poor: 0.25 },
      FCP: { good: 1800, poor: 3000 },
      TTFB: { good: 800, poor: 1800 },
      INP: { good: 200, poor: 500 }
    },

    // Custom Metrics
    customMetrics: {
      'api-response': { good: 500, poor: 2000 },
      'component-render': { good: 16, poor: 50 },
      'page-transition': { good: 200, poor: 1000 },
      'upload-processing': { good: 5000, poor: 15000 },
      'audio-transcription': { good: 10000, poor: 30000 }
    },

    // Resource Metrics
    resources: {
      maxBundleSize: 500000, // 500KB
      maxImageSize: 200000, // 200KB per image
      maxFontSize: 50000, // 50KB per font
      cacheHitRate: 0.8, // 80% minimum cache hit rate
      compressionRatio: 0.7 // 70% compression minimum
    }
  },

  // Monitoring Configuration
  monitoring: {
    // Sample rates for different environments
    sampleRates: {
      development: 1.0, // 100% in development
      staging: 0.5, // 50% in staging
      production: 0.1 // 10% in production
    },

    // Alert thresholds
    alerts: {
      // Alert if performance score drops below threshold
      performanceScore: 70,
      
      // Alert if error rate exceeds threshold
      errorRate: 0.05, // 5%
      
      // Alert if average response time exceeds threshold
      averageResponseTime: 1000, // 1 second
      
      // Alert if bundle size increases by more than threshold
      bundleSizeIncrease: 0.15 // 15%
    },

    // Metrics to track
    trackedMetrics: [
      'CLS', 'FID', 'FCP', 'LCP', 'TTFB', 'INP',
      'api-response', 'component-render', 'page-transition',
      'upload-processing', 'audio-transcription'
    ]
  },

  // CI/CD Integration
  ci: {
    // Fail build if performance budget is exceeded
    failOnBudgetExceeded: true,
    
    // Performance comparison baseline
    baseline: 'main',
    
    // Lighthouse configuration
    lighthouse: {
      config: {
        extends: 'lighthouse:default',
        settings: {
          onlyAudits: [
            'first-contentful-paint',
            'largest-contentful-paint',
            'cumulative-layout-shift',
            'total-blocking-time',
            'speed-index'
          ]
        }
      },
      thresholds: {
        performance: 80,
        accessibility: 90,
        'best-practices': 80,
        seo: 80
      }
    }
  },

  // Development Tools
  development: {
    // Enable performance debugging
    debugMode: process.env.NODE_ENV === 'development',
    
    // Show performance warnings in console
    consoleWarnings: true,
    
    // Track all renders in development
    trackAllRenders: process.env.NODE_ENV === 'development',
    
    // Bundle analysis
    bundleAnalysis: {
      enabled: process.env.ANALYZE === 'true',
      outputPath: './bundle-analysis',
      excludeAssets: /\.(map|txt|LICENSE)$/,
      generateStatsFile: true
    }
  }
}

module.exports = performanceBudgets