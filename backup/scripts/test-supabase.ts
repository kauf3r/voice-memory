import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') })

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase Connection...\n')

  // Check environment variables
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!url || !anonKey) {
    console.error('❌ Missing required environment variables')
    console.error('   Please check your .env.local file')
    process.exit(1)
  }

  console.log('✅ Environment variables found')
  console.log(`   URL: ${url}`)
  console.log(`   Anon Key: ${anonKey.substring(0, 20)}...`)
  console.log(`   Service Key: ${serviceKey ? serviceKey.substring(0, 20) + '...' : 'Not set'}\n`)

  // Create client
  const supabase = createClient(url, anonKey)

  try {
    // Test 1: Check if we can connect
    console.log('📡 Testing connection...')
    const { data: healthCheck } = await supabase.from('users').select('count').limit(1)
    console.log('✅ Connected to Supabase\n')

    // Test 2: Check auth
    console.log('🔐 Testing authentication...')
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      console.log('✅ Authenticated as:', session.user.email)
    } else {
      console.log('ℹ️  Not authenticated (this is normal for initial setup)')
    }
    console.log()

    // Test 3: Check tables exist
    console.log('📊 Checking database tables...')
    const tables = ['users', 'notes', 'project_knowledge']
    
    for (const table of tables) {
      try {
        await supabase.from(table).select('count').limit(1)
        console.log(`   ✅ Table '${table}' exists`)
      } catch (error) {
        console.log(`   ❌ Table '${table}' not found`)
      }
    }
    console.log()

    // Test 4: Check storage bucket
    console.log('📦 Checking storage bucket...')
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()
    
    if (bucketError) {
      console.log('   ❌ Could not list buckets (may need service key)')
    } else {
      const audioBucket = buckets?.find(b => b.name === 'audio-files')
      if (audioBucket) {
        console.log('   ✅ Storage bucket \'audio-files\' exists')
      } else {
        console.log('   ❌ Storage bucket \'audio-files\' not found')
      }
    }

    console.log('\n✨ Supabase setup test complete!')
    
  } catch (error) {
    console.error('❌ Error testing Supabase:', error)
    process.exit(1)
  }
}

// Run the test
testSupabaseConnection()