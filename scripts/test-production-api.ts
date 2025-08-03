#!/usr/bin/env npx tsx

/**
 * Script to test production API endpoints and environment configuration
 * This helps diagnose issues with the deployed application
 */

import fetch from 'node-fetch';
import { config } from '../lib/config.js';

const PRODUCTION_URL = config.baseUrl;

async function testEndpoint(endpoint: string, method = 'GET', body?: any, headers?: any) {
  const url = `${PRODUCTION_URL}${endpoint}`;
  
  console.log(`\n🔍 Testing ${method} ${endpoint}`);
  
  try {
    const options: any = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    const responseText = await response.text();
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }
    
    const status = response.status >= 200 && response.status < 300 ? '✅' : '❌';
    console.log(`${status} Status: ${response.status}`);
    
    if (typeof responseData === 'object') {
      console.log(`📝 Response:`, JSON.stringify(responseData, null, 2));
    } else {
      console.log(`📝 Response: ${responseData}`);
    }
    
    return { success: response.ok, status: response.status, data: responseData };
    
  } catch (error) {
    console.log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function testProductionAPI() {
  console.log('🚀 Testing Voice Memory Production API');
  console.log(`🌐 Base URL: ${PRODUCTION_URL}`);
  console.log('=' .repeat(60));
  
  // Test basic health endpoints
  await testEndpoint('/health');
  await testEndpoint('/api/health');
  
  // Test unified batch endpoint
  await testEndpoint('/api/process/batch');
  
  // Test stats endpoint
  await testEndpoint('/api/stats');
  
  console.log('\n' + '=' .repeat(60));
  console.log('\n🎯 Key Diagnostics:');
  console.log('1. If /health or /api/health return errors, basic routing is broken');
  console.log('2. If /api/process/batch returns 401, CRON_SECRET is not set properly');
  console.log('3. If /api/stats returns errors, Supabase connection issues');
  console.log('4. Check Vercel dashboard → Functions → Logs for detailed error messages');
  console.log('\n📊 Next Steps:');
  console.log('- If endpoints return 500 errors, check environment variables');
  console.log('- If authentication fails, verify CRON_SECRET and Supabase keys');
  console.log('- If 404 errors, check Vercel deployment and routing');
  console.log('\n🔗 Vercel Dashboard: https://vercel.com/dashboard');
  console.log('Go to your project → Functions tab → View logs for detailed errors');
}

// Run the tests
testProductionAPI().catch(console.error);