#!/usr/bin/env tsx

/**
 * Test the date filter API with real authentication
 * This script creates a debug session to test the exact flow
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function testWithRealAuth() {
  console.log('🔐 Testing Date Filter with Real Authentication')
  console.log('=' .repeat(60))
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  
  console.log('📋 Instructions for manual testing:')
  console.log()
  console.log('1. Open your browser to: http://localhost:3000/knowledge')
  console.log('2. Log in to your account')
  console.log('3. Go to the Tasks tab')
  console.log('4. Click on a task from 2025-07-29 to "View source note"')
  console.log('5. Open browser DevTools → Network tab')
  console.log('6. Look for the request to: /api/notes/filter?type=date&value=2025-07-29')
  console.log()
  console.log('Expected behavior:')
  console.log('✅ Should show 2 notes from 2025-07-29')
  console.log('❌ If it shows 0 results, the issue is in the frontend auth')
  console.log()
  
  console.log('🔍 What to check in DevTools Network tab:')
  console.log('   - Request URL: Should be /api/notes/filter?type=date&value=2025-07-29')
  console.log('   - Request Method: GET')
  console.log('   - Authorization header: Should be present with Bearer token')
  console.log('   - Response status: Should be 200 (not 401)')
  console.log('   - Response body: Should contain notes array with 2 items')
  console.log()
  
  console.log('🚨 Common issues to look for:')
  console.log('   1. Missing Authorization header = Frontend auth problem')
  console.log('   2. 401 Unauthorized = Token expired or invalid')
  console.log('   3. 200 but empty notes array = Date format mismatch')
  console.log('   4. Network error = API not running')
  console.log()
  
  // Let's also create a simple test HTML page for manual testing
  const testHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Date Filter Debug Test</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
        .success { background-color: #d4edda; border-color: #c3e6cb; }
        .error { background-color: #f8d7da; border-color: #f5c6cb; }
        .info { background-color: #d1ecf1; border-color: #bee5eb; }
        button { padding: 10px 20px; margin: 5px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto; }
        .status { font-weight: bold; }
    </style>
</head>
<body>
    <h1>Date Filter API Debug Test</h1>
    
    <div class="section info">
        <h2>Test for Date: 2025-07-29</h2>
        <p>This page tests the exact API call that happens when you click "View source note" on a task.</p>
        <p><strong>Expected Result:</strong> 2 notes should be found for this date.</p>
    </div>
    
    <div class="section">
        <h3>Step 1: Check Authentication</h3>
        <button onclick="checkAuth()">Check Current Auth Status</button>
        <div id="authResult"></div>
    </div>
    
    <div class="section">
        <h3>Step 2: Test Date Filter API</h3>
        <button onclick="testDateFilter()">Test Date Filter for 2025-07-29</button>
        <div id="filterResult"></div>
    </div>
    
    <div class="section">
        <h3>Step 3: Debug Information</h3>
        <div id="debugInfo"></div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script>
        // Initialize Supabase client (you'll need to replace these with your actual values)
        const supabaseUrl = '${SUPABASE_URL}';
        const supabaseAnonKey = '${SUPABASE_ANON_KEY}';
        const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
        
        async function checkAuth() {
            const authResult = document.getElementById('authResult');
            authResult.innerHTML = '<p>Checking authentication...</p>';
            
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                
                if (error) {
                    authResult.innerHTML = \`<div class="error"><h4>Auth Error</h4><pre>\${JSON.stringify(error, null, 2)}</pre></div>\`;
                    return;
                }
                
                if (session) {
                    authResult.innerHTML = \`
                        <div class="success">
                            <h4>✅ Authenticated</h4>
                            <p><strong>User:</strong> \${session.user.email}</p>
                            <p><strong>Token Preview:</strong> \${session.access_token.substring(0, 20)}...</p>
                            <p><strong>Expires:</strong> \${new Date(session.expires_at * 1000).toLocaleString()}</p>
                        </div>
                    \`;
                } else {
                    authResult.innerHTML = \`
                        <div class="error">
                            <h4>❌ Not Authenticated</h4>
                            <p>Please log in first at <a href="/auth" target="_blank">/auth</a></p>
                        </div>
                    \`;
                }
            } catch (err) {
                authResult.innerHTML = \`<div class="error"><h4>Error checking auth</h4><pre>\${err.message}</pre></div>\`;
            }
        }
        
        async function testDateFilter() {
            const filterResult = document.getElementById('filterResult');
            const debugInfo = document.getElementById('debugInfo');
            
            filterResult.innerHTML = '<p>Testing date filter...</p>';
            debugInfo.innerHTML = '';
            
            try {
                // Get current session
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                
                if (sessionError || !session) {
                    filterResult.innerHTML = \`
                        <div class="error">
                            <h4>❌ No Authentication</h4>
                            <p>Please check authentication first.</p>
                        </div>
                    \`;
                    return;
                }
                
                // Make the API request
                const testDate = '2025-07-29';
                const url = \`/api/notes/filter?type=date&value=\${encodeURIComponent(testDate)}\`;
                
                debugInfo.innerHTML = \`
                    <h4>🔍 Debug Information</h4>
                    <p><strong>Request URL:</strong> \${url}</p>
                    <p><strong>User ID:</strong> \${session.user.id}</p>
                    <p><strong>Token (first 20 chars):</strong> \${session.access_token.substring(0, 20)}...</p>
                    <p><strong>Request Time:</strong> \${new Date().toISOString()}</p>
                \`;
                
                const response = await fetch(url, {
                    headers: {
                        'Authorization': \`Bearer \${session.access_token}\`,
                        'Content-Type': 'application/json'
                    }
                });
                
                const responseData = await response.json();
                
                if (response.ok) {
                    const notesCount = responseData.notes?.length || 0;
                    const expectedCount = 2; // We know there should be 2 notes
                    
                    if (notesCount === expectedCount) {
                        filterResult.innerHTML = \`
                            <div class="success">
                                <h4>✅ Success!</h4>
                                <p>Found \${notesCount} notes for \${testDate} (expected \${expectedCount})</p>
                                <h5>Notes Found:</h5>
                                <ul>
                                    \${responseData.notes.map(note => 
                                        \`<li>Note \${note.id} - \${new Date(note.recorded_at).toLocaleString()}</li>\`
                                    ).join('')}
                                </ul>
                            </div>
                        \`;
                    } else {
                        filterResult.innerHTML = \`
                            <div class="error">
                                <h4>⚠️ Unexpected Result</h4>
                                <p>Found \${notesCount} notes, but expected \${expectedCount}</p>
                                <p>This suggests a date format or filtering issue.</p>
                            </div>
                        \`;
                    }
                } else {
                    filterResult.innerHTML = \`
                        <div class="error">
                            <h4>❌ API Error</h4>
                            <p><strong>Status:</strong> \${response.status}</p>
                            <p><strong>Error:</strong> \${responseData.error || 'Unknown error'}</p>
                            <pre>\${JSON.stringify(responseData, null, 2)}</pre>
                        </div>
                    \`;
                }
                
                // Add response details to debug info
                debugInfo.innerHTML += \`
                    <p><strong>Response Status:</strong> \${response.status}</p>
                    <p><strong>Response Headers:</strong></p>
                    <pre>\${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}</pre>
                    <p><strong>Response Body:</strong></p>
                    <pre>\${JSON.stringify(responseData, null, 2)}</pre>
                \`;
                
            } catch (err) {
                filterResult.innerHTML = \`
                    <div class="error">
                        <h4>❌ Request Failed</h4>
                        <pre>\${err.message}</pre>
                    </div>
                \`;
                
                debugInfo.innerHTML += \`
                    <p><strong>Fetch Error:</strong></p>
                    <pre>\${err.message}</pre>
                \`;
            }
        }
        
        // Auto-check auth on page load
        window.addEventListener('load', checkAuth);
    </script>
</body>
</html>
`;

  // Save the test HTML file
  const fs = await import('fs/promises')
  await fs.writeFile('/Users/andykaufman/Desktop/Projects/voice-memory/debug-date-filter.html', testHTML)
  
  console.log('📄 Created debug test page: debug-date-filter.html')
  console.log('   Open this file in your browser after starting the dev server')
  console.log()
  
  console.log('🚀 Next steps:')
  console.log('1. Start your dev server: npm run dev')
  console.log('2. Open: http://localhost:3000/debug-date-filter.html')
  console.log('3. Follow the test steps in the browser')
  console.log('4. This will show you exactly what\'s happening with the API call')
  console.log()
  
  console.log('🔧 If the test shows the API works correctly:')
  console.log('   → The issue is in the FilteredNotes.tsx component')
  console.log('   → Check the date format being passed to the API')
  console.log('   → Check the authentication token handling')
  console.log()
  
  console.log('🔧 If the test shows 401 Unauthorized:')
  console.log('   → The issue is in the authentication flow')
  console.log('   → Check if the user session is valid')
  console.log('   → Check if the token is being passed correctly')
}

async function main() {
  await testWithRealAuth()
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}