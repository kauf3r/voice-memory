#!/usr/bin/env npx tsx

/**
 * Manually trigger processing for stuck notes
 * This bypasses the cron job and directly calls the processing service
 */

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { config } from '../lib/config.js';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function triggerProcessing() {
  console.log('🔍 Checking for unprocessed notes...\n');

  // Get unprocessed notes
  const { data: unprocessedNotes, error } = await supabase
    .from('notes')
    .select('id, audio_url, processed_at, processing_started_at, error_message')
    .is('processed_at', null)
    .order('recorded_at', { ascending: true })
    .limit(10);

  if (error) {
    console.error('❌ Error fetching notes:', error);
    return;
  }

  if (!unprocessedNotes || unprocessedNotes.length === 0) {
    console.log('✅ No unprocessed notes found');
    return;
  }

  console.log(`📋 Found ${unprocessedNotes.length} unprocessed notes:\n`);
  
  unprocessedNotes.forEach((note, index) => {
    console.log(`${index + 1}. Note ${note.id}`);
    console.log(`   Audio URL: ${note.audio_url}`);
    console.log(`   Processing started: ${note.processing_started_at || 'Never'}`);
    console.log(`   Error: ${note.error_message || 'None'}`);
    console.log();
  });

  console.log('\n🚀 Triggering manual processing via production API...\n');

  const PRODUCTION_URL = config.baseUrl;
  
  // Get auth token from Supabase for API calls
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    console.log('⚠️  No auth session found, trying service role auth...');
  }

  // Process each note
  for (const note of unprocessedNotes) {
    console.log(`\n🔄 Processing note ${note.id}...`);
    
    try {
      const response = await fetch(`${PRODUCTION_URL}/api/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': session ? `Bearer ${session.access_token}` : `Bearer ${supabaseServiceKey}`,
          'X-Service-Auth': 'true'
        },
        body: JSON.stringify({
          noteId: note.id,
          forceReprocess: true
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log(`✅ Processing triggered successfully`);
        console.log(`   Response:`, result);
      } else {
        console.log(`❌ Failed to trigger processing`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Error:`, result);
      }
    } catch (error) {
      console.error(`❌ Network error:`, error);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n✅ Manual processing trigger completed');
  console.log('\n📊 Check your app to see if notes are now being transcribed');
}

// Run the trigger
triggerProcessing().catch(console.error);