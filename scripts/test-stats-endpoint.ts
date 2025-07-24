#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function testStatsEndpoint() {
  console.log('🧪 Testing the new /api/stats endpoint...\n')

  try {
    // Test without authentication (should fail)
    console.log('1. Testing without authentication...')
    const unauthResponse = await fetch('http://localhost:3000/api/stats')
    console.log(`   Status: ${unauthResponse.status}`)
    if (unauthResponse.status === 401) {
      console.log('   ✅ Correctly requires authentication\n')
    } else {
      console.log('   ❌ Should require authentication\n')
    }

    // Test endpoint structure by checking if it's accessible
    console.log('2. Testing endpoint availability...')
    try {
      const response = await fetch('http://localhost:3000/api/stats', {
        method: 'OPTIONS'
      })
      console.log(`   OPTIONS request status: ${response.status}`)
    } catch (error) {
      console.log(`   ❌ Endpoint not accessible: ${error}`)
    }

    // Test cache clearing endpoint
    console.log('3. Testing cache clearing endpoint...')
    const deleteResponse = await fetch('http://localhost:3000/api/stats', {
      method: 'DELETE'
    })
    console.log(`   DELETE status: ${deleteResponse.status}`)
    if (deleteResponse.status === 401) {
      console.log('   ✅ Cache clearing correctly requires authentication\n')
    } else {
      console.log('   ❌ Cache clearing should require authentication\n')
    }

    console.log('📊 Stats endpoint tests completed!')
    console.log('\nTo test with authentication, you\'ll need to:')
    console.log('1. Start the development server: npm run dev')
    console.log('2. Log in through the UI to get a valid session')
    console.log('3. Use the browser\'s network tab to see the stats endpoint in action')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testStatsEndpoint()
}

export { testStatsEndpoint } 