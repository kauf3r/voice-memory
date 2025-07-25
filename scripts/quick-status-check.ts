#!/usr/bin/env npx tsx

/**
 * Quick status check of unprocessed notes
 */

import * as dotenv from 'dotenv';
import { config } from '../lib/config.js';
dotenv.config({ path: '.env.local' });

async function quickCheck() {
  const PRODUCTION_URL = config.baseUrl;
  
  console.log('🔍 Quick Voice Memory Status Check\n');
  
  // Check if the problem is with the batch processing endpoint specifically
  console.log('Testing endpoint variations...\n');
  
  // Test different variations of the unified batch endpoint
  const endpoints = [
    '/api/process/batch',
    '/api/process/batch/',
    '/_next/api/process/batch'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${PRODUCTION_URL}${endpoint}`);
      console.log(`${endpoint}: ${response.status} ${response.statusText}`);
    } catch (error) {
      console.log(`${endpoint}: Network error`);
    }
  }
  
  console.log('\n🔑 Key Issue: The unified batch endpoint is returning 404');
  console.log('\n🚀 Quick Workaround:');
  console.log('1. Go to your Voice Memory app');
  console.log('2. Upload a voice note');
  console.log('3. Open browser DevTools (F12)');
  console.log('4. Go to Console tab');
  console.log('5. Paste this code and press Enter:\n');
  
  console.log(`fetch('/api/process', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + (await (await fetch('/api/auth/session')).json()).access_token
  },
  body: JSON.stringify({
    noteId: 'YOUR_NOTE_ID_HERE',
    forceReprocess: true
  })
}).then(r => r.json()).then(console.log)`);
  
  console.log('\n6. Replace YOUR_NOTE_ID_HERE with the actual note ID from your database');
  console.log('\nThis will manually trigger processing for that specific note.');
}

quickCheck().catch(console.error);