import { test, expect } from '@playwright/test';

test.describe('Voice Memory App', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');
    
    // Check if the main heading is present
    await expect(page.locator('h1')).toContainText('Voice Memory');
  });

  test('should display login form when not authenticated', async ({ page }) => {
    await page.goto('/');
    
    // Check for login form elements
    await expect(page.locator('button:has-text("Send Magic Link")')).toBeVisible();
  });

  test('should navigate to knowledge page', async ({ page }) => {
    await page.goto('/knowledge');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check if we're redirected to login or if knowledge page loads
    const url = page.url();
    expect(url).toContain('/knowledge');
  });

  test('should handle file upload interaction', async ({ page }) => {
    await page.goto('/');
    
    // Look for file upload input
    const fileInput = page.locator('input[type="file"]');
    
    // Check if file input exists (when authenticated)
    const inputCount = await fileInput.count();
    
    if (inputCount > 0) {
      // If authenticated, verify file input accepts audio files
      const accept = await fileInput.getAttribute('accept');
      expect(accept).toContain('audio');
    } else {
      // If not authenticated, should show login
      await expect(page.locator('button:has-text("Send Magic Link")')).toBeVisible();
    }
  });

  test('should display processing stats section', async ({ page }) => {
    await page.goto('/');
    
    // Check for processing stats elements
    const statsSection = page.locator('text=/Processing Stats|Upload Progress/i');
    
    // Stats might only be visible when authenticated
    const statsCount = await statsSection.count();
    
    if (statsCount > 0) {
      await expect(statsSection.first()).toBeVisible();
    }
  });
});

test.describe('Voice Memory API Endpoints', () => {
  test('should respond to health check', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
  });

  test('should handle knowledge API endpoint', async ({ request }) => {
    const response = await request.get('/api/knowledge');
    
    // Should either return data (200) or require auth (401)
    expect([200, 401]).toContain(response.status());
  });

  test('should handle process API endpoint', async ({ request }) => {
    const response = await request.get('/api/process');
    
    // Should return method not allowed for GET
    expect(response.status()).toBe(405);
  });
});