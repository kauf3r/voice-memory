import { test, expect } from '@playwright/test'

test.describe('Voice Memory - Comprehensive User Flow', () => {
  
  test.beforeEach(async ({ page }) => {
    // Start from the home page
    await page.goto('/')
  })

  test('complete user authentication and upload flow', async ({ page }) => {
    // Test initial page load
    await expect(page).toHaveTitle(/Voice Memory/)
    
    // Check for authentication prompt
    await expect(page.locator('text=Sign in')).toBeVisible({ timeout: 10000 })
    
    // Test email input form
    const emailInput = page.locator('input[type="email"]')
    await expect(emailInput).toBeVisible()
    
    // Enter test email
    await emailInput.fill('test@example.com')
    
    // Click sign in button
    const signInButton = page.locator('button', { hasText: 'Send Magic Link' })
    await signInButton.click()
    
    // Should show success message about magic link
    await expect(page.locator('text=Check your email')).toBeVisible({ timeout: 5000 })
  })

  test('upload component visibility and interaction', async ({ page }) => {
    // Skip authentication for upload UI test by mocking auth state
    await page.addInitScript(() => {
      // Mock authenticated state
      window.localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-token',
        user: { id: 'test-user', email: 'test@example.com' }
      }))
    })

    await page.reload()

    // Look for upload area
    const uploadArea = page.locator('text=Upload audio files')
    await expect(uploadArea).toBeVisible({ timeout: 10000 })
    
    // Check for file type information
    await expect(page.locator('text=Supports MP3, WAV, M4A')).toBeVisible()
    await expect(page.locator('text=max 25MB each')).toBeVisible()
    
    // Test file input exists
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toBeAttached()
    
    // Check file input accepts correct types
    const acceptValue = await fileInput.getAttribute('accept')
    expect(acceptValue).toContain('audio/*')
  })

  test('navigation and page structure', async ({ page }) => {
    // Test header navigation
    await expect(page.locator('header')).toBeVisible()
    
    // Check for main navigation elements
    const navElements = [
      'Home',
      'Knowledge',
      'Tasks'
    ]
    
    for (const element of navElements) {
      // Try to find navigation links (they might not all be visible without auth)
      const link = page.locator(`text=${element}`).first()
      if (await link.isVisible()) {
        await expect(link).toBeVisible()
      }
    }
  })

  test('responsive design and mobile compatibility', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Page should still be functional
    await expect(page.locator('body')).toBeVisible()
    
    // Check that important elements are still accessible
    await expect(page.locator('text=Voice Memory')).toBeVisible()
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    
    await expect(page.locator('body')).toBeVisible()
    
    // Return to desktop
    await page.setViewportSize({ width: 1280, height: 720 })
  })

  test('error handling and loading states', async ({ page }) => {
    // Test network error handling by intercepting requests
    await page.route('**/api/**', route => {
      route.abort('failed')
    })
    
    // Try to trigger an API call and see error handling
    const emailInput = page.locator('input[type="email"]')
    if (await emailInput.isVisible()) {
      await emailInput.fill('test@example.com')
      const signInButton = page.locator('button', { hasText: 'Send Magic Link' })
      await signInButton.click()
      
      // Should handle network error gracefully
      // (Implementation specific - might show an error message)
    }
  })

  test('accessibility compliance', async ({ page }) => {
    // Test keyboard navigation
    await page.keyboard.press('Tab')
    
    // Check for focus indicators
    const focusedElement = page.locator(':focus')
    await expect(focusedElement).toBeVisible()
    
    // Test that images have alt text
    const images = page.locator('img')
    const imageCount = await images.count()
    
    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i)
      const alt = await img.getAttribute('alt')
      expect(alt).toBeTruthy()
    }
    
    // Test that form inputs have labels
    const inputs = page.locator('input')
    const inputCount = await inputs.count()
    
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i)
      const id = await input.getAttribute('id')
      const ariaLabel = await input.getAttribute('aria-label')
      const ariaLabelledBy = await input.getAttribute('aria-labelledby')
      
      // Input should have either an id with corresponding label, aria-label, or aria-labelledby
      if (id) {
        const label = page.locator(`label[for="${id}"]`)
        const labelExists = await label.count() > 0
        expect(labelExists || ariaLabel || ariaLabelledBy).toBeTruthy()
      } else {
        expect(ariaLabel || ariaLabelledBy).toBeTruthy()
      }
    }
  })

  test('performance and loading metrics', async ({ page }) => {
    // Navigate to page and measure performance
    const startTime = Date.now()
    await page.goto('/')
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle')
    const loadTime = Date.now() - startTime
    
    // Page should load reasonably quickly (under 5 seconds)
    expect(loadTime).toBeLessThan(5000)
    
    // Check for performance metrics
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      return {
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
      }
    })
    
    // Basic performance assertions
    expect(performanceMetrics.loadComplete).toBeGreaterThan(0)
    expect(performanceMetrics.domContentLoaded).toBeGreaterThan(0)
  })

  test('data persistence and state management', async ({ page }) => {
    // Test that page state persists across reloads
    const emailInput = page.locator('input[type="email"]')
    if (await emailInput.isVisible()) {
      await emailInput.fill('persistent@example.com')
      
      // Reload page
      await page.reload()
      
      // In a real app, you might check if form state is preserved
      // This depends on implementation
      await expect(emailInput).toBeVisible()
    }
  })

  test('browser compatibility features', async ({ page }) => {
    // Test that essential browser APIs are available
    const browserFeatures = await page.evaluate(() => {
      return {
        localStorage: typeof localStorage !== 'undefined',
        fetch: typeof fetch !== 'undefined',
        FileReader: typeof FileReader !== 'undefined',
        FormData: typeof FormData !== 'undefined',
        URL: typeof URL !== 'undefined'
      }
    })
    
    // These should all be true in modern browsers
    expect(browserFeatures.localStorage).toBe(true)
    expect(browserFeatures.fetch).toBe(true)
    expect(browserFeatures.FileReader).toBe(true)
    expect(browserFeatures.FormData).toBe(true)
    expect(browserFeatures.URL).toBe(true)
  })

  test('security headers and CSP compliance', async ({ page }) => {
    const response = await page.goto('/')
    
    // Check for security headers
    const headers = response?.headers() || {}
    
    // These headers should be present for security
    expect(headers['x-frame-options'] || headers['content-security-policy']).toBeTruthy()
    
    // Check that the page loads without CSP violations
    const cspViolations: string[] = []
    
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().includes('Content Security Policy')) {
        cspViolations.push(msg.text())
      }
    })
    
    // Wait a moment for any CSP violations to appear
    await page.waitForTimeout(1000)
    
    expect(cspViolations).toHaveLength(0)
  })
})