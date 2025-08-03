/**
 * Jest Configuration for Comprehensive Testing Framework
 * Optimized for authentication, accessibility, and performance testing
 */

const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapping: {
    // Handle module aliases (this will be automatically configured for you based on your tsconfig.json paths)
    '^@/(.*)$': '<rootDir>/$1',
  },
  testEnvironment: 'jest-environment-jsdom',
  
  // Performance testing configuration
  testTimeout: 30000, // 30 seconds for performance tests
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.(test|spec).(js|jsx|ts|tsx)',
    '**/*.(test|spec).(js|jsx|ts|tsx)'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
    '!**/coverage/**',
    '!**/.next/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Specific thresholds for critical components
    './app/components/AuthProvider.tsx': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './lib/utils/validation.ts': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },
  
  // Performance monitoring
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './test-results',
      outputName: 'junit.xml',
    }],
    ['jest-html-reporters', {
      publicPath: './test-results',
      filename: 'test-report.html',
      includeFailureMsg: true,
      includeSuiteFailure: true
    }]
  ],
  
  // Test categories
  projects: [
    {
      displayName: 'Unit Tests',
      testMatch: ['<rootDir>/__tests__/**/*.(test|spec).(js|jsx|ts|tsx)'],
      testPathIgnorePatterns: [
        '<rootDir>/__tests__/e2e/',
        '<rootDir>/__tests__/performance/',
        '<rootDir>/__tests__/accessibility/'
      ]
    },
    {
      displayName: 'Authentication Tests',
      testMatch: ['<rootDir>/__tests__/components/AuthFlow.test.tsx'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js', '<rootDir>/jest.auth.setup.js']
    },
    {
      displayName: 'Accessibility Tests',
      testMatch: ['<rootDir>/__tests__/accessibility/**/*.(test|spec).(js|jsx|ts|tsx)'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js', '<rootDir>/jest.axe.setup.js']
    },
    {
      displayName: 'Performance Tests',
      testMatch: ['<rootDir>/__tests__/performance/**/*.(test|spec).(js|jsx|ts|tsx)'],
      testTimeout: 60000, // Longer timeout for performance tests
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js', '<rootDir>/jest.performance.setup.js']
    },
    {
      displayName: 'Regression Tests',
      testMatch: ['<rootDir>/__tests__/regression/**/*.(test|spec).(js|jsx|ts|tsx)'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
    }
  ],
  
  // Global setup for all tests
  globalSetup: '<rootDir>/jest.global.setup.js',
  globalTeardown: '<rootDir>/jest.global.teardown.js',
  
  // Module mocking
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  
  // Transform configuration
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }]
  },
  
  // Test environment variables
  setupFiles: ['<rootDir>/jest.env.setup.js'],
  
  // Verbose output for CI
  verbose: process.env.CI === 'true',
  
  // Fail fast in CI
  bail: process.env.CI === 'true' ? 1 : 0,
  
  // Cache configuration
  cacheDirectory: '<rootDir>/.jest-cache',
  
  // Watch configuration for development
  watchPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/coverage/',
    '<rootDir>/test-results/'
  ]
}

// Export configuration
module.exports = createJestConfig(customJestConfig)