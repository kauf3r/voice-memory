/**
 * Security validation script for debug endpoints
 * Tests that debug endpoints return 404 in production
 */

const originalEnv = process.env.NODE_ENV

async function testEndpoint(url, description) {
  try {
    console.log(`\n🔍 Testing ${description}...`)
    
    const response = await fetch(url)
    console.log(`Status: ${response.status}`)
    
    if (response.status === 404) {
      console.log(`✅ SECURE: ${description} properly returns 404 in production`)
      return true
    } else {
      console.log(`❌ VULNERABILITY: ${description} is accessible in production!`)
      const text = await response.text()
      console.log(`Response: ${text.substring(0, 200)}...`)
      return false
    }
  } catch (error) {
    console.log(`❌ ERROR testing ${description}: ${error.message}`)
    return false
  }
}

async function runSecurityTest() {
  console.log('🔐 Security Test: Debug Endpoints in Production')
  console.log('================================================')
  
  // Set environment to production for testing
  process.env.NODE_ENV = 'production'
  
  // Test if server is running
  try {
    const healthResponse = await fetch('http://localhost:3000/api/health')
    if (!healthResponse.ok) {
      console.log('❌ Server not running. Please start with: npm run dev')
      return
    }
  } catch (error) {
    console.log('❌ Cannot connect to server. Please start with: npm run dev')
    return
  }
  
  console.log('✅ Server is running')
  
  const results = []
  
  // Test debug endpoints
  results.push(await testEndpoint(
    'http://localhost:3000/api/debug-auth-production',
    'Debug Auth Production endpoint'
  ))
  
  results.push(await testEndpoint(
    'http://localhost:3000/api/auth-test',
    'Auth Test endpoint'
  ))
  
  results.push(await testEndpoint(
    'http://localhost:3000/api/debug-supabase',
    'Debug Supabase endpoint'
  ))
  
  results.push(await testEndpoint(
    'http://localhost:3000/api/debug-env',
    'Debug Environment endpoint'
  ))
  
  // Restore original environment
  process.env.NODE_ENV = originalEnv
  
  console.log('\n📊 Security Test Results:')
  console.log('========================')
  
  const passed = results.filter(r => r).length
  const total = results.length
  
  if (passed === total) {
    console.log(`✅ ALL TESTS PASSED (${passed}/${total})`)
    console.log('🔐 Debug endpoints are properly secured in production')
  } else {
    console.log(`❌ SECURITY ISSUES FOUND (${passed}/${total} passed)`)
    console.log('🚨 Debug endpoints are exposing information in production!')
  }
}

// Run if called directly
if (require.main === module) {
  runSecurityTest()
}

module.exports = { runSecurityTest }