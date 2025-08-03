#!/usr/bin/env tsx

/**
 * Performance Testing Script
 * 
 * This script helps test and validate the performance monitoring system
 * in the Voice Memory application.
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface PerformanceTest {
  name: string
  command: string
  expected: {
    buildTime: number // seconds
    bundleSize: number // KB
    firstLoadJS: number // KB
  }
}

const tests: PerformanceTest[] = [
  {
    name: 'Production Build',
    command: 'npm run build',
    expected: {
      buildTime: 12,
      bundleSize: 600,
      firstLoadJS: 250
    }
  },
  {
    name: 'Bundle Analysis',
    command: 'npm run build:analyze',
    expected: {
      buildTime: 12,
      bundleSize: 600,
      firstLoadJS: 250
    }
  }
]

async function runPerformanceTest(test: PerformanceTest): Promise<{
  passed: boolean
  results: {
    buildTime?: number
    bundleSize?: number
    firstLoadJS?: number
  }
  output: string
}> {
  console.log(`\n🧪 Running test: ${test.name}`)
  console.log(`📋 Command: ${test.command}`)
  
  const startTime = Date.now()
  
  try {
    const { stdout, stderr } = await execAsync(test.command)
    const buildTime = (Date.now() - startTime) / 1000
    
    // Parse build output for bundle information
    const output = stdout + stderr
    const results = {
      buildTime,
      bundleSize: parseBundleSize(output),
      firstLoadJS: parseFirstLoadJS(output)
    }
    
    // Check if results meet expectations
    const passed = (
      results.buildTime <= test.expected.buildTime &&
      (results.bundleSize || 0) <= test.expected.bundleSize &&
      (results.firstLoadJS || 0) <= test.expected.firstLoadJS
    )
    
    return { passed, results, output }
  } catch (error: any) {
    console.error(`❌ Test failed: ${error.message}`)
    return {
      passed: false,
      results: { buildTime: (Date.now() - startTime) / 1000 },
      output: error.toString()
    }
  }
}

function parseBundleSize(output: string): number | undefined {
  // Look for "First Load JS shared by all X kB" pattern
  const match = output.match(/First Load JS shared by all\s+(\d+(?:\.\d+)?)\s*kB/i)
  return match ? parseFloat(match[1]) : undefined
}

function parseFirstLoadJS(output: string): number | undefined {
  // Look for the main page first load JS size
  const match = output.match(/○\s*\/\s+[\d.]+\s*kB\s+(\d+(?:\.\d+)?)\s*kB/i)
  return match ? parseFloat(match[1]) : undefined
}

function formatResults(results: any): string {
  const items = []
  if (results.buildTime) {
    items.push(`Build Time: ${results.buildTime.toFixed(1)}s`)
  }
  if (results.bundleSize) {
    items.push(`Bundle Size: ${results.bundleSize}KB`)
  }
  if (results.firstLoadJS) {
    items.push(`First Load JS: ${results.firstLoadJS}KB`)
  }
  return items.join(', ')
}

async function runAllTests() {
  console.log('🚀 Starting Voice Memory Performance Tests')
  console.log('=' .repeat(50))
  
  let totalPassed = 0
  let totalTests = 0
  
  for (const test of tests) {
    totalTests++
    const result = await runPerformanceTest(test)
    
    if (result.passed) {
      console.log(`✅ ${test.name} - PASSED`)
      console.log(`   📊 Results: ${formatResults(result.results)}`)
      totalPassed++
    } else {
      console.log(`❌ ${test.name} - FAILED`)
      console.log(`   📊 Results: ${formatResults(result.results)}`)
      console.log(`   🎯 Expected: Build Time ≤ ${test.expected.buildTime}s, Bundle ≤ ${test.expected.bundleSize}KB, First Load ≤ ${test.expected.firstLoadJS}KB`)
    }
  }
  
  console.log('\n' + '=' .repeat(50))
  console.log(`📈 Performance Test Summary: ${totalPassed}/${totalTests} tests passed`)
  
  if (totalPassed === totalTests) {
    console.log('🎉 All performance tests passed! The application meets performance standards.')
  } else {
    console.log('⚠️  Some performance tests failed. Review the results above.')
    process.exit(1)
  }
}

// Performance recommendations based on test results
function generateRecommendations(results: any[]): string[] {
  const recommendations: string[] = []
  
  // Check build time
  const slowBuilds = results.filter(r => r.results.buildTime > 5)
  if (slowBuilds.length > 0) {
    recommendations.push('Consider optimizing build process - builds are taking longer than expected')
  }
  
  // Check bundle size
  const largeBundles = results.filter(r => (r.results.bundleSize || 0) > 200)
  if (largeBundles.length > 0) {
    recommendations.push('Bundle size is large - consider code splitting or removing unused dependencies')
  }
  
  return recommendations
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('💥 Performance testing failed:', error)
    process.exit(1)
  })
}

export { runPerformanceTest, runAllTests }