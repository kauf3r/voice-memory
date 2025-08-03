#!/usr/bin/env npx tsx

/**
 * Script to verify OpenAI API key configuration
 * This helps diagnose authentication issues with the OpenAI API
 */

import * as dotenv from 'dotenv';
import { OpenAI } from 'openai';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function verifyOpenAIKey() {
  console.log('🔍 Verifying OpenAI API Key Configuration\n');

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY is not set in environment variables');
    console.log('\n📝 To fix this:');
    console.log('1. Create a .env.local file in your project root');
    console.log('2. Add: OPENAI_API_KEY=your-actual-api-key');
    console.log('3. Get your API key from: https://platform.openai.com/api-keys');
    return;
  }

  // Mask the API key for security
  const maskedKey = apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 4);
  console.log(`✅ OPENAI_API_KEY found: ${maskedKey}`);
  console.log(`📏 Key length: ${apiKey.length} characters`);

  // Check key format
  if (!apiKey.startsWith('sk-')) {
    console.error('\n❌ API key format appears incorrect (should start with "sk-")');
    return;
  }

  console.log('\n🔄 Testing API connection...');

  try {
    const openai = new OpenAI({ apiKey });
    
    // Make a minimal API call to verify the key works
    const response = await openai.models.list();
    
    console.log('✅ API key is valid and working!');
    console.log(`📊 Available models: ${response.data.length}`);
    
    // Test whisper model specifically
    const whisperModel = response.data.find(m => m.id === 'whisper-1');
    if (whisperModel) {
      console.log('✅ Whisper model is available for transcription');
    } else {
      console.log('⚠️  Whisper model not found in available models');
    }

  } catch (error: any) {
    console.error('\n❌ API key verification failed:');
    console.error(error.message);
    
    if (error.message.includes('401')) {
      console.log('\n🔧 This is an authentication error. Possible causes:');
      console.log('1. The API key is incorrect or has been revoked');
      console.log('2. The API key has incorrect permissions');
      console.log('3. Your OpenAI account may have billing issues');
      console.log('\n📝 To fix:');
      console.log('1. Go to https://platform.openai.com/api-keys');
      console.log('2. Create a new API key');
      console.log('3. Update your .env.local file with the new key');
      console.log('4. Update the key in Vercel environment variables');
    }
  }

  console.log('\n🌐 For Vercel deployment:');
  console.log('1. Go to your Vercel project settings');
  console.log('2. Navigate to Environment Variables');
  console.log('3. Update OPENAI_API_KEY with your working key');
  console.log('4. Redeploy your application');
}

// Run the verification
verifyOpenAIKey().catch(console.error);