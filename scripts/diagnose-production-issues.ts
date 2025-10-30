#!/usr/bin/env npx tsx

/**
 * Comprehensive production diagnostics for Voice Memory
 * Checks API endpoints, environment variables, and processing pipeline
 */

import fetch from 'node-fetch';
import { config } from '../lib/config.js';

const PRODUCTION_URL = config.baseUrl;

async function testEndpoint(endpoint: string, method = 'GET', body?: any, headers?: any, description?: string) {
  const url = `${PRODUCTION_URL}${endpoint}`;
  
  console.log(`\n🔍 ${description || `Testing ${method} ${endpoint}`}`);
  
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
      responseData = responseText.substring(0, 200) + (responseText.length > 200 ? '...' : '');
    }
    
    const isSuccess = response.status >= 200 && response.status < 300;
    const status = isSuccess ? '✅' : response.status === 404 ? '❓' : '❌';
    
    console.log(`${status} Status: ${response.status}`);
    
    if (typeof responseData === 'object' && responseData !== null) {
      console.log(`📝 Response:`, JSON.stringify(responseData, null, 2));
    } else {
      console.log(`📝 Response: ${responseData}`);
    }
    
    return { success: isSuccess, status: response.status, data: responseData };
    
  } catch (error) {
    console.log(`❌ Network Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function diagnoseProduction() {
  console.log('🔧 Voice Memory Production Diagnostics');
  console.log(`🌐 Production URL: ${PRODUCTION_URL}`);
  console.log('=' .repeat(60));
  
  const diagnostics = {
    healthEndpoint: false,
    processEndpoint: false,
    cronEndpoint: false,
    authenticationWorking: false,
    environmentVariables: {
      openai: false,
      supabase: false,
      cron: false
    }
  };
  
  // Test 1: Basic health check
  console.log('\n📋 STEP 1: Testing Basic Health...');
  const healthResult = await testEndpoint('/api/health', 'GET', null, null, 'Health endpoint check');
  diagnostics.healthEndpoint = healthResult.success;
  
  // Test 2: Process endpoint (should return 401 Unauthorized, not 404)
  console.log('\n📋 STEP 2: Testing Process Endpoint...');
  const processResult = await testEndpoint('/api/process', 'POST', { test: 'ping' }, null, 'Process endpoint availability');
  diagnostics.processEndpoint = processResult.status === 401; // 401 is expected without auth
  
  // Test 3: Unified batch endpoint (should return 401 or proper response, not 404)
  console.log('\n📋 STEP 3: Testing Unified Batch Endpoint...');
  const cronResult = await testEndpoint('/api/process/batch', 'GET', null, null, 'Unified batch endpoint availability');
  diagnostics.cronEndpoint = cronResult.status !== 404;
  
  // Test 4: Check environment variable hints from responses
  console.log('\n📋 STEP 4: Analyzing Environment Variable Configuration...');
  
  // Try to infer environment issues from error messages
  if (healthResult.data && typeof healthResult.data === 'object') {
    const healthData = healthResult.data as any;
    diagnostics.environmentVariables.supabase = healthData.checks?.database === 'ok';
  }
  
  // Test with CRON_SECRET if we can guess it's missing
  if (cronResult.status === 401) {
    console.log('🔑 Testing CRON_SECRET configuration...');
    const cronSecretTest = await testEndpoint('/api/process/batch', 'GET', null, 
      { 'Authorization': 'Bearer test' }, 'CRON_SECRET test');
    diagnostics.environmentVariables.cron = cronSecretTest.status !== 500;
  }
  
  // Test 5: Specific error scenarios
  console.log('\n📋 STEP 5: Testing Error Scenarios...');
  
  // Test upload endpoint
  await testEndpoint('/api/upload', 'POST', { test: 'data' }, null, 'Upload endpoint check');
  
  // Test notes endpoint
  await testEndpoint('/api/notes', 'GET', null, null, 'Notes endpoint check');
  
  console.log('\n' + '=' .repeat(60));
  console.log('\n📊 DIAGNOSTIC SUMMARY:');
  console.log(`✅ Health Endpoint: ${diagnostics.healthEndpoint ? 'Working' : 'Failed'}`);
  console.log(`✅ Process Endpoint: ${diagnostics.processEndpoint ? 'Available (needs auth)' : 'Missing/Broken'}`);
  console.log(`✅ Unified Batch Endpoint: ${diagnostics.cronEndpoint ? 'Available' : 'Missing (404)'}`);
  
  console.log('\n🔧 Environment Variables:');
  console.log(`  📊 Supabase: ${diagnostics.environmentVariables.supabase ? '✅ Connected' : '❌ Connection Failed'}`);
  console.log(`  🤖 OpenAI: ${diagnostics.environmentVariables.openai ? '✅ Configured' : '❓ Unknown'}`);
  console.log(`  ⏰ CRON_SECRET: ${diagnostics.environmentVariables.cron ? '✅ Set' : '❓ Possibly Missing'}`);
  
  console.log('\n🎯 LIKELY ISSUES:');
  
  if (!diagnostics.processEndpoint) {
    console.log('❌ Process endpoint missing - API routes may not be deployed properly');
  }
  
  if (!diagnostics.cronEndpoint) {
    console.log('❌ Unified batch endpoint missing - automated processing will not work');
    console.log('   Check: app/api/process/batch/route.ts is deployed');
  }
  
  if (!diagnostics.environmentVariables.supabase) {
    console.log('❌ Supabase connection failed - check database credentials');
    console.log('   Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY');
  }
  
  console.log('\n🔍 NEXT STEPS:');
  console.log('1. Check Vercel deployment logs for build errors');
  console.log('2. Verify all environment variables are set in Vercel dashboard');  
  console.log('3. Ensure API route files are included in deployment');
  console.log('4. Check function timeout settings in vercel.json');
  
  console.log('\n🔗 Useful Links:');
  console.log(`- Vercel Dashboard: https://vercel.com/andy-kaufmans-projects/voice-memory`);
  console.log(`- Production App: ${PRODUCTION_URL}`);
  console.log(`- Functions Logs: https://vercel.com/andy-kaufmans-projects/voice-memory/functions`);
  
  return diagnostics;
}

// Run diagnostics
diagnoseProduction().catch(console.error);