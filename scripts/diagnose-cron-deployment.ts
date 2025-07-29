#!/usr/bin/env node

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config as appConfig } from '../lib/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '..', '.env.local') });

interface EndpointTestResult {
  endpoint: string;
  method: string;
  authentication: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;
  error?: string;
  duration: number;
}

interface DeploymentReport {
  timestamp: string;
  environment: string;
  endpoints: {
    old: EndpointTestResult[];
    new: EndpointTestResult[];
  };
  comparison: {
    oldEndpointAccessible: boolean;
    newEndpointAccessible: boolean;
    authenticationWorking: boolean;
    recommendations: string[];
  };
}

async function testEndpoint(
  url: string,
  method: string,
  headers: Record<string, string>,
  authType: string
): Promise<EndpointTestResult> {
  const startTime = Date.now();
  const result: EndpointTestResult = {
    endpoint: url,
    method,
    authentication: authType,
    status: 0,
    statusText: '',
    headers: {},
    body: null,
    duration: 0
  };

  try {
    console.log(`\nTesting ${method} ${url} with ${authType} authentication...`);
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    });

    result.status = response.status;
    result.statusText = response.statusText;
    result.duration = Date.now() - startTime;
    
    // Capture response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    result.headers = responseHeaders;

    // Try to parse the response body
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      try {
        result.body = await response.json();
      } catch {
        result.body = await response.text();
      }
    } else {
      result.body = await response.text();
    }

    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Duration: ${result.duration}ms`);
    
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    result.duration = Date.now() - startTime;
    console.error(`Error: ${result.error}`);
  }

  return result;
}

async function generateDeploymentReport(baseUrl: string): Promise<DeploymentReport> {
  const cronSecret = process.env.CRON_SECRET || process.env.NEXT_PUBLIC_CRON_SECRET;
  
  if (!cronSecret) {
    console.error('❌ CRON_SECRET not found in environment variables');
    process.exit(1);
  }

  console.log(`\n🔍 Diagnosing Cron Deployment Issues`);
  console.log(`Environment: ${baseUrl.includes('localhost') ? 'Local' : 'Production'}`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const report: DeploymentReport = {
    timestamp: new Date().toISOString(),
    environment: baseUrl.includes('localhost') ? 'local' : 'production',
    endpoints: {
      old: [],
      new: []
    },
    comparison: {
      oldEndpointAccessible: false,
      newEndpointAccessible: false,
      authenticationWorking: false,
      recommendations: []
    }
  };

  // Test configuration - unified endpoint only
  const unifiedEndpoint = `${baseUrl}/api/process/batch`;

  // Authentication headers for different scenarios
  const authScenarios = [
    {
      name: 'Vercel Cron Headers',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'x-vercel-signature': 'mock-signature',
        'x-vercel-cron': '1'
      }
    },
    {
      name: 'Bearer Token Only',
      headers: {
        'Authorization': `Bearer ${cronSecret}`
      }
    },
    {
      name: 'No Authentication',
      headers: {}
    }
  ];

  // Test unified endpoint with cron authentication
  console.log('\n📌 Testing Unified Endpoint (Cron Auth): /api/process/batch');
  console.log('=' .repeat(50));
  
  for (const scenario of authScenarios) {
    // Filter out undefined values from headers
    const headers: Record<string, string> = {}
    for (const [key, value] of Object.entries(scenario.headers)) {
      if (value !== undefined) {
        headers[key] = value
      }
    }
    
    const result = await testEndpoint(
      unifiedEndpoint,
      'POST',
      headers,
      scenario.name
    );
    report.endpoints.old.push(result);
  }

  // Test unified endpoint with different authentication patterns
  console.log('\n📌 Testing Unified Endpoint (Additional Auth Patterns): /api/process/batch');
  console.log('=' .repeat(50));
  
  // Additional scenarios for comprehensive testing
  const additionalScenarios = [
    {
      name: 'Invalid Token',
      headers: {
        'Authorization': 'Bearer invalid-token-12345'
      }
    },
    {
      name: 'Partial Vercel Headers',
      headers: {
        'x-vercel-cron': '1'
      }
    }
  ];
  
  for (const scenario of additionalScenarios) {
    // Filter out undefined values from headers
    const headers: Record<string, string> = {}
    for (const [key, value] of Object.entries(scenario.headers)) {
      if (value !== undefined) {
        headers[key] = value
      }
    }
    
    const result = await testEndpoint(
      unifiedEndpoint,
      'POST',
      headers,
      scenario.name
    );
    report.endpoints.new.push(result);
  }

  // Also test GET method for the unified endpoint (to check if it exists at all)
  console.log('\n📌 Testing GET Request (Endpoint Existence Check)');
  console.log('=' .repeat(50));
  
  const getResult = await testEndpoint(unifiedEndpoint, 'GET', {}, 'No Authentication');

  // Analyze results
  report.comparison.oldEndpointAccessible = report.endpoints.old.some(r => r.status !== 404);
  report.comparison.newEndpointAccessible = report.endpoints.new.some(r => r.status !== 404) || getResult.status !== 404;
  report.comparison.authenticationWorking = 
    report.endpoints.old.some(r => r.status === 200 || r.status === 201) ||
    report.endpoints.new.some(r => r.status === 200 || r.status === 201);

  // Generate recommendations
  generateRecommendations(report, getResult);

  // Print comprehensive report
  printReport(report);

  return report;
}

function generateRecommendations(report: DeploymentReport, getResult: EndpointTestResult) {
  const { comparison, endpoints } = report;
  const { recommendations } = comparison;

  // Check if unified endpoint exists
  if (!comparison.newEndpointAccessible && getResult.status === 404) {
    recommendations.push('❌ Unified endpoint (/api/process/batch) returns 404 - File may not be deployed or route not properly configured');
  } else if (comparison.newEndpointAccessible) {
    recommendations.push('✅ Unified endpoint (/api/process/batch) is accessible');
  }

  // Check authentication issues
  const authFailures = [...endpoints.old, ...endpoints.new].filter(r => r.status === 401);
  if (authFailures.length > 0 && !comparison.authenticationWorking) {
    recommendations.push('🔐 Authentication failing on all requests - Check CRON_SECRET environment variable in Vercel');
  }

  // Check for method not allowed
  const methodNotAllowed = [...endpoints.old, ...endpoints.new].filter(r => r.status === 405);
  if (methodNotAllowed.length > 0) {
    recommendations.push('⚠️  Some endpoints return 405 Method Not Allowed - Check that POST method is properly exported');
  }

  // Check Vercel deployment specific issues
  if (report.environment === 'production') {
    if (!comparison.newEndpointAccessible) {
      recommendations.push('🚨 Unified endpoint is inaccessible in production - Possible deployment failure');
      recommendations.push('📦 Check Vercel deployment logs for build errors');
      recommendations.push('🔄 Try redeploying the application');
      recommendations.push('📁 Verify that API routes are included in the build output');
    }

    if (comparison.newEndpointAccessible && !comparison.authenticationWorking) {
      recommendations.push('🔑 Endpoint accessible but authentication failing - Verify CRON_SECRET is set in Vercel environment variables');
    }
  }

  // Check cron configuration
  if (comparison.newEndpointAccessible && comparison.authenticationWorking) {
    recommendations.push('✅ Unified endpoint is working correctly - cron jobs should function properly');
  }

  // File structure recommendations
  if (!comparison.newEndpointAccessible && report.environment === 'production') {
    recommendations.push('📂 Verify file exists at: app/api/process/batch/route.ts');
    recommendations.push('🏗️  Ensure Next.js app directory structure is properly configured');
  }
}

function printReport(report: DeploymentReport) {
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 DEPLOYMENT DIAGNOSIS REPORT');
  console.log('='.repeat(70));
  
  console.log(`\n📅 Timestamp: ${report.timestamp}`);
  console.log(`🌐 Environment: ${report.environment.toUpperCase()}`);
  
  console.log('\n🔍 ENDPOINT ACCESSIBILITY:');
  console.log(`  Unified Endpoint (/api/process/batch): ${report.comparison.newEndpointAccessible ? '✅ Accessible' : '❌ Not Accessible'}`);
  console.log(`  Authentication Working: ${report.comparison.authenticationWorking ? '✅ Yes' : '❌ No'}`);
  
  console.log('\n📋 DETAILED RESULTS:');
  
  // Cron authentication results
  console.log('\n  Cron Authentication Results:');
  for (const result of report.endpoints.old) {
    console.log(`    ${result.authentication}: ${result.status} ${result.statusText} (${result.duration}ms)`);
    if (result.error) {
      console.log(`      Error: ${result.error}`);
    }
  }
  
  // Additional authentication pattern results
  console.log('\n  Additional Authentication Pattern Results:');
  for (const result of report.endpoints.new) {
    console.log(`    ${result.authentication}: ${result.status} ${result.statusText} (${result.duration}ms)`);
    if (result.error) {
      console.log(`      Error: ${result.error}`);
    }
  }
  
  console.log('\n💡 RECOMMENDATIONS:');
  if (report.comparison.recommendations.length === 0) {
    console.log('  ✅ No issues detected - endpoints are working correctly');
  } else {
    for (const recommendation of report.comparison.recommendations) {
      console.log(`  ${recommendation}`);
    }
  }
  
  console.log('\n🔧 NEXT STEPS:');
  console.log('  1. Review the recommendations above');
  console.log('  2. Check Vercel deployment logs if endpoints return 404');
  console.log('  3. Verify environment variables are properly set');
  console.log('  4. Run test-cron-endpoint-direct.ts for more detailed testing');
  console.log('  5. Run verify-vercel-deployment.ts to check configuration');
  
  console.log('\n' + '='.repeat(70) + '\n');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const isProduction = args.includes('--production') || args.includes('-p');
  
  const baseUrl = isProduction 
    ? appConfig.baseUrl
    : 'http://localhost:3000';
  
  console.log(`\n🚀 Voice Memory Cron Deployment Diagnostics`);
  console.log(`Running diagnostics against: ${baseUrl}`);
  
  try {
    await generateDeploymentReport(baseUrl);
  } catch (error) {
    console.error('\n❌ Fatal error during diagnostics:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export { testEndpoint, generateDeploymentReport };