#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config as appConfig } from '../lib/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '..', '.env.local') });

interface TestScenario {
  name: string;
  description: string;
  headers: Record<string, string>;
  expectedStatus: number[];
  critical: boolean;
}

interface TestResult {
  scenario: string;
  endpoint: string;
  status: number;
  success: boolean;
  responseTime: number;
  headers: Record<string, string>;
  body: any;
  error?: string;
}

interface ComparisonReport {
  timestamp: string;
  environment: string;
  cronSecret: string;
  cronAuth: {
    url: string;
    results: TestResult[];
    working: boolean;
  };
  userAuth: {
    url: string;
    results: TestResult[];
    working: boolean;
  };
  rootCause: string;
  recommendations: string[];
}

async function testCronEndpoint(
  url: string,
  scenario: TestScenario
): Promise<TestResult> {
  const startTime = Date.now();
  
  console.log(`\n🧪 Testing: ${scenario.name}`);
  console.log(`   Endpoint: ${url}`);
  console.log(`   Description: ${scenario.description}`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...scenario.headers
      },
      body: JSON.stringify({
        test: true,
        timestamp: new Date().toISOString()
      })
    });

    const responseTime = Date.now() - startTime;
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    let body: any;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      try {
        body = await response.json();
      } catch {
        body = await response.text();
      }
    } else {
      body = await response.text();
    }

    const success = scenario.expectedStatus.includes(response.status);
    
    console.log(`   Status: ${response.status} ${response.statusText} ${success ? '✅' : '❌'}`);
    console.log(`   Response Time: ${responseTime}ms`);
    
    if (!success && scenario.critical) {
      console.log(`   ⚠️  CRITICAL: Expected ${scenario.expectedStatus.join(' or ')}, got ${response.status}`);
    }

    return {
      scenario: scenario.name,
      endpoint: url,
      status: response.status,
      success,
      responseTime,
      headers: responseHeaders,
      body
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`   ❌ Error: ${errorMessage}`);
    
    return {
      scenario: scenario.name,
      endpoint: url,
      status: 0,
      success: false,
      responseTime: Date.now() - startTime,
      headers: {},
      body: null,
      error: errorMessage
    };
  }
}

async function runComparisonTests(baseUrl: string): Promise<ComparisonReport> {
  const cronSecret = process.env.CRON_SECRET || process.env.NEXT_PUBLIC_CRON_SECRET;
  
  if (!cronSecret) {
    console.error('❌ CRON_SECRET not found in environment variables');
    console.error('   Please set CRON_SECRET in your .env.local file');
    process.exit(1);
  }

  console.log(`\n🔍 Testing Cron Endpoints Directly`);
  console.log(`Environment: ${baseUrl.includes('localhost') ? 'Local' : 'Production'}`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`CRON_SECRET: ${cronSecret.substring(0, 10)}...${cronSecret.substring(cronSecret.length - 5)}`);
  
  const unifiedEndpoint = `${baseUrl}/api/process/batch`;
  
  // Define test scenarios based on lib/cron-auth.ts patterns
  const testScenarios: TestScenario[] = [
    {
      name: 'Vercel Cron Request (Full)',
      description: 'Simulates a real Vercel cron job request with all headers',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'x-vercel-signature': `${cronSecret}-signature`,
        'x-vercel-cron': '1'
      },
      expectedStatus: [200, 201],
      critical: true
    },
    {
      name: 'Bearer Token Only',
      description: 'Uses only Bearer token authentication (manual trigger)',
      headers: {
        'Authorization': `Bearer ${cronSecret}`
      },
      expectedStatus: [200, 201],
      critical: true
    },
    {
      name: 'Invalid Token',
      description: 'Tests authentication rejection with wrong token',
      headers: {
        'Authorization': 'Bearer invalid-token-12345'
      },
      expectedStatus: [401],
      critical: false
    },
    {
      name: 'No Authentication',
      description: 'Tests endpoint protection without any auth',
      headers: {},
      expectedStatus: [401],
      critical: false
    },
    {
      name: 'Partial Vercel Headers',
      description: 'Tests with only some Vercel headers',
      headers: {
        'x-vercel-cron': '1'
      },
      expectedStatus: [401],
      critical: false
    }
  ];

  const report: ComparisonReport = {
    timestamp: new Date().toISOString(),
    environment: baseUrl.includes('localhost') ? 'local' : 'production',
    cronSecret: `${cronSecret.substring(0, 10)}...`,
    cronAuth: {
      url: unifiedEndpoint,
      results: [],
      working: false
    },
    userAuth: {
      url: unifiedEndpoint,
      results: [],
      working: false
    },
    rootCause: '',
    recommendations: []
  };

  // Test unified endpoint with cron authentication scenarios
  console.log('\n' + '='.repeat(70));
  console.log('📌 Testing CRON Authentication: /api/process/batch');
  console.log('='.repeat(70));
  
  for (const scenario of testScenarios) {
    const result = await testCronEndpoint(unifiedEndpoint, scenario);
    report.cronAuth.results.push(result);
  }

  // Test unified endpoint with invalid user token (to test dual auth)
  console.log('\n' + '='.repeat(70));
  console.log('📌 Testing USER Authentication (Invalid): /api/process/batch');
  console.log('='.repeat(70));
  
  const userScenarios: TestScenario[] = [
    {
      name: 'Invalid User Token',
      description: 'Tests user authentication with invalid token',
      headers: {
        'Authorization': 'Bearer invalid-user-token-12345'
      },
      expectedStatus: [401],
      critical: false
    },
    {
      name: 'No Authentication (User)',
      description: 'Tests endpoint without any authentication as user request',
      headers: {},
      expectedStatus: [401],
      critical: false
    }
  ];
  
  for (const scenario of userScenarios) {
    const result = await testCronEndpoint(unifiedEndpoint, scenario);
    report.userAuth.results.push(result);
  }

  // Analyze results
  analyzeResults(report);
  
  // Print comprehensive report
  printComparisonReport(report);
  
  return report;
}

function analyzeResults(report: ComparisonReport) {
  // Check if authentication methods are working
  report.cronAuth.working = report.cronAuth.results.some(r => 
    r.status === 200 || r.status === 201
  );
  report.userAuth.working = report.userAuth.results.every(r => 
    r.status === 401  // User auth should properly reject invalid tokens
  );

  // Determine root cause
  const endpointExists = !report.cronAuth.results.every(r => r.status === 404);
  
  if (!endpointExists) {
    report.rootCause = 'Unified endpoint returns 404 - Deployment issue or routing problem';
    report.recommendations.push('Check Vercel deployment logs for build errors');
    report.recommendations.push('Verify that app/api/process/batch/route.ts exists');
    report.recommendations.push('Check if app directory is properly configured in next.config.js');
  } else if (!report.cronAuth.working && endpointExists) {
    report.rootCause = 'Unified endpoint exists but cron authentication is failing';
    report.recommendations.push('Check if CRON_SECRET is properly set in Vercel environment');
    report.recommendations.push('Verify the authentication logic in the unified endpoint');
    report.recommendations.push('Check isAuthorizedCronRequest implementation');
  } else if (report.cronAuth.working && report.userAuth.working) {
    report.rootCause = 'Unified endpoint is working correctly with dual authentication';
    report.recommendations.push('Endpoint consolidation successful - both cron and user auth working');
    report.recommendations.push('Monitor cron execution and user requests after deployment');
  } else if (report.cronAuth.working && !report.userAuth.working) {
    report.rootCause = 'Cron authentication working but user authentication logic may have issues';
    report.recommendations.push('Check user authentication flow in the unified endpoint');
  }

  // Check for specific error patterns
  const cronAuthErrors = report.cronAuth.results.filter(r => r.status === 401 && r.scenario.includes('Vercel Cron') || r.scenario.includes('Bearer Token Only'));
  if (cronAuthErrors.length > 0) {
    report.recommendations.push('Critical cron authentication scenarios failing - Check CRON_SECRET configuration');
  }
}

function printComparisonReport(report: ComparisonReport) {
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 ENDPOINT COMPARISON REPORT');
  console.log('='.repeat(70));
  
  console.log(`\n📅 Timestamp: ${report.timestamp}`);
  console.log(`🌐 Environment: ${report.environment.toUpperCase()}`);
  console.log(`🔑 CRON_SECRET: ${report.cronSecret}`);
  
  console.log('\n📈 SUMMARY:');
  console.log(`  Cron Authentication: ${report.cronAuth.working ? '✅ Working' : '❌ Not Working'}`);
  console.log(`  User Authentication: ${report.userAuth.working ? '✅ Working (Properly Rejecting)' : '❌ Not Working'}`);
  
  console.log('\n🔍 ROOT CAUSE:');
  console.log(`  ${report.rootCause}`);
  
  console.log('\n📋 DETAILED RESULTS:');
  
  // Show cron authentication results
  console.log('\n  Cron Authentication Test Results:');
  console.log('  ' + '-'.repeat(50));
  console.log('  Scenario                     | Status | Result');
  console.log('  ' + '-'.repeat(50));
  
  for (const result of report.cronAuth.results) {
    const status = result.status === 0 ? 'ERROR' : `${result.status}`;
    console.log(`  ${result.scenario.padEnd(28)} | ${status.padEnd(6)} | ${result.success ? '✅' : '❌'}`);
  }
  
  // Show user authentication results
  console.log('\n  User Authentication Test Results:');
  console.log('  ' + '-'.repeat(50));
  console.log('  Scenario                     | Status | Result');
  console.log('  ' + '-'.repeat(50));
  
  for (const result of report.userAuth.results) {
    const status = result.status === 0 ? 'ERROR' : `${result.status}`;
    console.log(`  ${result.scenario.padEnd(28)} | ${status.padEnd(6)} | ${result.success ? '✅' : '❌'}`);
  }
  
  console.log('\n💡 RECOMMENDATIONS:');
  for (const recommendation of report.recommendations) {
    console.log(`  • ${recommendation}`);
  }
  
  // Print specific error details if found
  const errors = [...report.cronAuth.results, ...report.userAuth.results].filter(r => r.error);
  if (errors.length > 0) {
    console.log('\n⚠️  ERROR DETAILS:');
    for (const error of errors) {
      console.log(`  ${error.endpoint}: ${error.error}`);
    }
  }
  
  console.log('\n🔧 DEBUGGING TIPS:');
  console.log('  1. If unified endpoint returns 404:');
  console.log('     - Check Vercel Functions tab to see if it\'s deployed');
  console.log('     - Review build logs for any errors');
  console.log('     - Verify file path: app/api/process/batch/route.ts');
  console.log('  2. If cron authentication fails:');
  console.log('     - Verify CRON_SECRET in Vercel dashboard');
  console.log('     - Check isAuthorizedCronRequest implementation');
  console.log('     - Test with manual Bearer token request');
  console.log('  3. If user authentication behaves unexpectedly:');
  console.log('     - Check authenticateRequest function in the unified endpoint');
  console.log('     - Verify dual authentication logic is working correctly');
  console.log('     - Test with valid user tokens if available');
  
  console.log('\n' + '='.repeat(70) + '\n');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const isProduction = args.includes('--production') || args.includes('-p');
  
  const baseUrl = isProduction 
    ? appConfig.baseUrl
    : 'http://localhost:3000';
  
  console.log(`\n🚀 Voice Memory Cron Endpoint Direct Testing`);
  console.log(`Testing against: ${baseUrl}`);
  
  try {
    await runComparisonTests(baseUrl);
    
    console.log('\n✅ Testing completed successfully');
    console.log('   Run with --production flag to test against production deployment');
    
  } catch (error) {
    console.error('\n❌ Fatal error during testing:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export { testCronEndpoint, runComparisonTests };