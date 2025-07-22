#!/usr/bin/env tsx
/**
 * Quick Auth Setup for Voice Memory Auto-Uploader
 * 
 * This script helps you quickly set up authentication for the auto-uploader
 * by using your existing login credentials.
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const EMAIL = 'andy@andykaufman.net' // Your known email

async function main() {
  console.log('🔐 Quick Auth Setup for Voice Memory\n')
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  
  console.log('Sending magic link to:', EMAIL)
  
  const { error } = await supabase.auth.signInWithOtp({
    email: EMAIL,
    options: {
      emailRedirectTo: 'http://localhost:3000/auth/callback'
    }
  })
  
  if (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
  
  console.log('\n✅ Magic link sent to your email!')
  console.log('\n📧 Please check your email and click the link')
  console.log('🌐 After logging in, go to: http://localhost:3000')
  console.log('🔍 Open browser DevTools (F12) → Application → Local Storage')
  console.log('📋 Find the key containing "auth-token" and copy the access_token value')
  console.log('\n💡 Then save it to .voice-memory-auth file or set VOICE_MEMORY_AUTH_TOKEN in .env.local')
  
  // Alternative: Direct password login (if you know your password)
  console.log('\n--- OR ---\n')
  console.log('If you know your password, create .voice-memory-auth file manually with your token')
  console.log('You can get it from the production site at https://voice-memory-tau.vercel.app')
}

main().catch(console.error)