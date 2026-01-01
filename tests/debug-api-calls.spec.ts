import { test, expect } from '@playwright/test';

test.describe('Debug API Calls', () => {
  test('should capture actual API requests and responses', async ({ page }) => {
    // Capture all requests and responses
    const requests: any[] = [];
    const responses: any[] = [];

    page.on('request', request => {
      if (request.url().includes('/api/knowledge')) {
        requests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers()
        });
        console.log('📡 API Request captured:', {
          method: request.method(),
          url: request.url(),
          hasAuth: !!request.headers()['authorization']
        });
      }
    });

    page.on('response', async response => {
      if (response.url().includes('/api/knowledge')) {
        try {
          const responseText = await response.text();
          responses.push({
            url: response.url(),
            status: response.status(),
            headers: response.headers(),
            body: responseText
          });
          console.log('📨 API Response captured:', {
            status: response.status(),
            url: response.url(),
            bodyPreview: responseText.substring(0, 200)
          });
        } catch (error) {
          console.log('❌ Error reading response:', error);
        }
      }
    });

    // Enable console logging
    page.on('console', msg => {
      if (msg.text().includes('🔍') || msg.text().includes('📋') || msg.text().includes('📡') || msg.text().includes('❌')) {
        console.log(`[BROWSER]:`, msg.text());
      }
    });

    console.log('🌐 Navigating to homepage...');
    await page.goto('/');
    
    // Wait for auth to initialize
    await page.waitForTimeout(2000);
    
    console.log('📍 Navigating to knowledge page...');
    await page.goto('/knowledge');
    
    // Wait for the page to load and make API calls
    await page.waitForTimeout(5000);
    
    console.log(`\n📊 Summary:`);
    console.log(`- Requests captured: ${requests.length}`);
    console.log(`- Responses captured: ${responses.length}`);
    
    if (requests.length > 0) {
      console.log('\n🔍 Request details:');
      requests.forEach((req, i) => {
        console.log(`  ${i + 1}. ${req.method} ${req.url}`);
        console.log(`     Authorization: ${req.headers.authorization ? 'Present' : 'Missing'}`);
      });
    }
    
    if (responses.length > 0) {
      console.log('\n📨 Response details:');
      responses.forEach((res, i) => {
        console.log(`  ${i + 1}. Status: ${res.status}`);
        console.log(`     Body: ${res.body}`);
      });
    }

    // Take screenshot
    await page.screenshot({ path: 'debug-api-calls.png', fullPage: true });
    console.log('📸 Screenshot saved as debug-api-calls.png');
  });
});