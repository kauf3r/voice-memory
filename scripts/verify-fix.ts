#!/usr/bin/env npx tsx

/**
 * Script to verify that Vercel authentication has been disabled
 * and that the Voice Memory API is working properly
 */

import fetch from 'node-fetch';
import { config } from '../lib/config.js';

const PRODUCTION_URL = config.baseUrl;

async function testEndpoint(endpoint: string, expectedStatus = 200, description?: string) {
  const url = `${PRODUCTION_URL}${endpoint}`;
  
  console.log(`\n🔍 Testing: ${endpoint}`);
  if (description) console.log(`   Purpose: ${description}`);
  
  try {
    const response = await fetch(url);
    const responseText = await response.text();
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText.substring(0, 200) + (responseText.length > 200 ? '...' : '');
    }
    
    const isSuccess = response.status === expectedStatus;
    const status = isSuccess ? '✅' : '❌';
    
    console.log(`${status} Status: ${response.status} (expected: ${expectedStatus})`);
    
    if (response.status === 401 && responseText.includes('Authentication Required')) {
      console.log('🚨 STILL BLOCKED: Vercel Authentication is still enabled!');
      return { success: false, blocked: true };
    }
    
    if (typeof responseData === 'object' && responseData !== null) {
      console.log(`📝 Response:`, JSON.stringify(responseData, null, 2));
    } else {
      console.log(`📝 Response: ${responseData}`);
    }
    
    return { success: isSuccess, status: response.status, data: responseData, blocked: false };
    
  } catch (error) {
    console.log(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error', blocked: false };
  }
}

async function verifyFix() {
  console.log('🔐 Voice Memory - Vercel Authentication Fix Verification');
  console.log(`🌐 Testing URL: ${PRODUCTION_URL}`);
  console.log('=' .repeat(70));
  
  const results = {
    authenticationDisabled: false,
    healthEndpointWorking: false,
    cronEndpointWorking: false,
    apiEndpointsAccessible: false
  };
  
  // Test 1: Check if authentication wall is gone
  console.log('\n📋 STEP 1: Checking if Vercel Authentication is disabled...');
  const healthTest = await testEndpoint('/health', 404, 'Should return 404 (not auth wall)');
  
  if (healthTest.blocked) {
    console.log('\n🚨 AUTHENTICATION STILL ENABLED!');
    console.log('   Please go back to Vercel Dashboard and disable authentication.');
    console.log('   Then redeploy your application.');
    return results;
  }
  
  results.authenticationDisabled = true;
  console.log('✅ Authentication wall removed!');
  
  // Test 2: Check API health endpoint
  console.log('\n📋 STEP 2: Testing API endpoints...');
  const apiHealthTest = await testEndpoint('/api/health', 404, 'API routing check');
  results.healthEndpointWorking = !apiHealthTest.blocked;
  
  // Test 3: Check unified batch endpoint (should return 401 for auth, not Vercel auth wall)
  const cronTest = await testEndpoint('/api/process/batch', 401, 'Unified batch endpoint authentication check');
  results.cronEndpointWorking = !cronTest.blocked && cronTest.status === 401;
  
  // Test 4: Check stats endpoint
  const statsTest = await testEndpoint('/api/stats', 401, 'Stats endpoint check');
  results.apiEndpointsAccessible = !statsTest.blocked;
  
  console.log('\n' + '=' .repeat(70));
  console.log('\n📊 VERIFICATION RESULTS:');
  console.log(`✅ Vercel Authentication Disabled: ${results.authenticationDisabled ? 'YES' : 'NO'}`);
  console.log(`✅ API Endpoints Accessible: ${results.apiEndpointsAccessible ? 'YES' : 'NO'}`);
  console.log(`✅ Unified Batch Endpoint Working: ${results.cronEndpointWorking ? 'YES' : 'NO'}`);
  
  if (results.authenticationDisabled && results.apiEndpointsAccessible) {
    console.log('\n🎉 SUCCESS! Your Voice Memory app should now work properly!');
    console.log('\n📝 Next Steps:');
    console.log('1. Try uploading a voice note in your app');
    console.log('2. Check if transcription and analysis work');
    console.log('3. Monitor the processing queue');
    
    console.log('\n🔧 If processing still fails, check:');
    console.log('- Vercel environment variables are set correctly');
    console.log('- OpenAI API key is valid');
    console.log('- Supabase connection is working');
  } else {
    console.log('\n⚠️  Some issues remain. Please:');
    console.log('1. Ensure Vercel Authentication is fully disabled');
    console.log('2. Redeploy your application');
    console.log('3. Run this script again to verify');
  }
  
  return results;
}

// Run the verification
verifyFix().catch(console.error);