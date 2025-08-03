#!/usr/bin/env tsx
/**
 * Generate Authentication Token
 * 
 * Helper script to get and save an authentication token for the auto-uploader.
 * This token is needed to authenticate API requests from the auto-uploader script.
 * 
 * Usage: tsx scripts/generate-auth-token.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const question = (query: string): Promise<string> => {
  return new Promise(resolve => {
    rl.question(query, resolve)
  })
}

async function main() {
  console.log('🔐 Voice Memory Authentication Token Generator\n')
  
  // Check for Supabase configuration
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase configuration in .env file')
    console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set')
    process.exit(1)
  }
  
  // Create Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
  
  console.log('Please choose authentication method:\n')
  console.log('1. Email/Password login')
  console.log('2. Magic link (email will be sent)')
  console.log('3. Use existing session (if logged in via browser)\n')
  
  const choice = await question('Enter your choice (1-3): ')
  
  let session = null
  
  switch (choice.trim()) {
    case '1':
      // Email/Password login
      const email = await question('Enter your email: ')
      const password = await question('Enter your password: ')
      
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim()
      })
      
      if (authError) {
        console.error('❌ Authentication failed:', authError.message)
        process.exit(1)
      }
      
      session = authData.session
      break
      
    case '2':
      // Magic link
      const magicEmail = await question('Enter your email for magic link: ')
      
      const { error: magicError } = await supabase.auth.signInWithOtp({
        email: magicEmail.trim(),
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`
        }
      })
      
      if (magicError) {
        console.error('❌ Failed to send magic link:', magicError.message)
        process.exit(1)
      }
      
      console.log('\n✅ Magic link sent to your email!')
      console.log('Please check your email and click the link to authenticate.')
      console.log('After logging in, run this script again and choose option 3.')
      process.exit(0)
      break
      
    case '3':
      // Check existing session
      const { data: sessionData } = await supabase.auth.getSession()
      session = sessionData.session
      
      if (!session) {
        console.error('❌ No existing session found. Please login first.')
        process.exit(1)
      }
      break
      
    default:
      console.error('❌ Invalid choice')
      process.exit(1)
  }
  
  if (!session || !session.access_token) {
    console.error('❌ Failed to get authentication token')
    process.exit(1)
  }
  
  // Save token to file
  const authFilePath = path.join(process.cwd(), '.voice-memory-auth')
  fs.writeFileSync(authFilePath, session.access_token, 'utf-8')
  
  console.log('\n✅ Authentication token saved successfully!')
  console.log(`📁 Token saved to: ${authFilePath}`)
  console.log('\n⚠️  Important:')
  console.log('- Keep this token secure and do not commit it to git')
  console.log('- The token will expire after some time and need to be regenerated')
  console.log('- You can also set VOICE_MEMORY_AUTH_TOKEN in your .env file')
  
  // Verify token works
  console.log('\n🔍 Verifying token...')
  const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notes`, {
    headers: {
      'Authorization': `Bearer ${session.access_token}`
    }
  })
  
  if (verifyResponse.ok) {
    console.log('✅ Token verified successfully!')
    console.log('\nYou can now use the auto-uploader with: npm run watch-uploads')
  } else {
    console.warn('⚠️  Token verification failed. The token might not work with the API.')
  }
  
  rl.close()
}

main().catch(error => {
  console.error('❌ Error:', error)
  rl.close()
  process.exit(1)
})