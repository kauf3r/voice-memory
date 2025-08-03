import { test, expect } from '@playwright/test';

test.describe('Authentication and Knowledge Flow', () => {
  test('should check authentication state and knowledge loading', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'log' || msg.type() === 'error') {
        console.log(`[BROWSER ${msg.type().toUpperCase()}]:`, msg.text());
      }
    });

    // Go to homepage first
    await page.goto('/');
    
    // Check if user is already logged in
    console.log('🔍 Checking initial authentication state...');
    
    const isLoggedIn = await page.evaluate(async () => {
      // Check if Supabase client is available
      if (typeof window !== 'undefined' && (window as any).supabase) {
        const { data: { session } } = await (window as any).supabase.auth.getSession();
        return {
          hasSession: !!session,
          user: session?.user?.email || null
        };
      }
      return { hasSession: false, user: null };
    });

    console.log('📋 Authentication state:', isLoggedIn);

    // Check current page content
    const pageTitle = await page.title();
    const pageContent = await page.textContent('body');
    
    console.log('📄 Page title:', pageTitle);
    console.log('🔍 Looking for authentication indicators...');

    // Check for login form or authenticated content
    const hasLoginForm = await page.locator('button:has-text("Send Magic Link")').count() > 0;
    const hasLogoutButton = await page.locator('button:has-text("Sign Out")').count() > 0;
    const hasFileUpload = await page.locator('input[type="file"]').count() > 0;

    console.log('🔐 Authentication indicators:', {
      hasLoginForm,
      hasLogoutButton,
      hasFileUpload
    });

    if (hasLoginForm) {
      console.log('❌ User appears to be logged out');
    } else if (hasLogoutButton || hasFileUpload) {
      console.log('✅ User appears to be logged in');
    }

    // Navigate to knowledge page
    console.log('📍 Navigating to knowledge page...');
    await page.goto('/knowledge');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check knowledge page content
    const knowledgePageContent = await page.textContent('body');
    
    // Check for specific elements
    const hasNoKnowledgeMessage = knowledgePageContent?.includes('No Knowledge Available');
    const hasKnowledgeStats = await page.locator('text=/Total Notes|Key Insights/').count() > 0;
    const hasErrorMessage = knowledgePageContent?.includes('Failed to load knowledge');
    const hasLoadingSpinner = await page.locator('.animate-spin').count() > 0;

    console.log('📊 Knowledge page state:', {
      hasNoKnowledgeMessage,
      hasKnowledgeStats,
      hasErrorMessage,
      hasLoadingSpinner
    });

    // Wait a bit for any async operations
    await page.waitForTimeout(2000);

    // Check if there are any network requests to /api/knowledge
    const requests = [];
    page.on('request', request => {
      if (request.url().includes('/api/knowledge')) {
        requests.push({
          url: request.url(),
          method: request.method(),
          headers: Object.fromEntries(request.allHeaders())
        });
        console.log('📡 API Request:', request.method(), request.url());
      }
    });

    page.on('response', response => {
      if (response.url().includes('/api/knowledge')) {
        console.log('📨 API Response:', response.status(), response.url());
      }
    });

    // Refresh the knowledge page to trigger API calls
    console.log('🔄 Refreshing knowledge page to trigger API calls...');
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Check console for our debug logs
    console.log('🔍 Waiting for debug logs...');
    await page.waitForTimeout(3000);

    // Final check of page state
    const finalContent = await page.textContent('body');
    console.log('📋 Final page content includes:');
    console.log('  - No Knowledge Available:', finalContent?.includes('No Knowledge Available'));
    console.log('  - Total Notes:', finalContent?.includes('Total Notes'));
    console.log('  - Failed to load:', finalContent?.includes('Failed to load'));

    // Take a screenshot for debugging
    await page.screenshot({ path: 'debug-knowledge-page.png', fullPage: true });
    console.log('📸 Screenshot saved as debug-knowledge-page.png');
  });

  test('should check authentication context and session', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      console.log(`[BROWSER]:`, msg.text());
    });

    await page.goto('/');
    
    // Inject debugging code to check authentication state
    const authState = await page.evaluate(async () => {
      // Wait for the page to load
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        // Check if we can access the Supabase client
        const supabaseClient = (window as any).supabase;
        if (!supabaseClient) {
          return { error: 'Supabase client not found' };
        }

        // Get session
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        
        // Get user
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        
        return {
          hasSession: !!session,
          hasUser: !!user,
          userEmail: user?.email || null,
          sessionError: sessionError?.message || null,
          userError: userError?.message || null,
          accessToken: session?.access_token ? 'present' : 'missing'
        };
      } catch (error) {
        return { error: (error as Error).message };
      }
    });

    console.log('🔐 Authentication state check:', authState);

    // Check localStorage and sessionStorage for auth data
    const storageData = await page.evaluate(() => {
      return {
        localStorage: Object.keys(localStorage).filter(key => key.includes('supabase')),
        sessionStorage: Object.keys(sessionStorage).filter(key => key.includes('supabase'))
      };
    });

    console.log('💾 Storage data:', storageData);
  });
});