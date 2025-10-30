/**
 * Task Completion E2E Tests
 * Complete user journey validation, error scenarios, and mobile interaction testing
 */

import { test, expect, Page, BrowserContext } from '@playwright/test'

// Test data
const mockUser = {
  email: 'test@example.com',
  password: 'testpassword123'
}

const mockTask = {
  id: 'test-task-123',
  text: 'Complete project documentation',
  type: 'myTasks',
  date: new Date().toISOString(),
  completed: false
}

test.describe('Task Completion E2E Tests', () => {
  let context: BrowserContext
  let page: Page

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      // Mock viewport for mobile testing
      viewport: { width: 390, height: 844 }
    })
  })

  test.beforeEach(async () => {
    page = await context.newPage()
    
    // Mock authentication and API responses
    await page.route('/api/auth/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'user123', email: mockUser.email },
          session: { access_token: 'mock-token' }
        })
      })
    })

    await page.route('/api/tasks', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tasks: [mockTask],
          total: 1,
          completed: 0,
          pending: 1,
          pinned: 0
        })
      })
    })
  })

  test.afterEach(async () => {
    await page.close()
  })

  test.afterAll(async () => {
    await context.close()
  })

  test.describe('Complete User Journey', () => {
    test('should complete full task completion flow', async () => {
      // Navigate to app
      await page.goto('/')
      
      // Wait for authentication
      await expect(page.locator('[data-testid="main-content"]')).toBeVisible()
      
      // Open task panel
      await page.click('[data-testid="tasks-button"]')
      await expect(page.locator('[data-testid="task-panel"]')).toBeVisible()
      
      // Find task in list
      const taskCard = page.locator(`[data-testid="task-${mockTask.id}"]`)
      await expect(taskCard).toBeVisible()
      
      // Verify task is not completed initially
      const checkbox = taskCard.locator('input[type="checkbox"]')
      await expect(checkbox).not.toBeChecked()
      
      // Complete the task
      await checkbox.click()
      
      // Verify completion state change
      await expect(checkbox).toBeChecked()
      
      // Verify success feedback
      await expect(page.locator('.toast-success')).toBeVisible()
      await expect(page.locator('.toast-success')).toContainText('marked as completed')
    })

    test('should handle task unchecking flow', async () => {
      // Mock completed task
      const completedTask = { ...mockTask, completed: true }
      
      await page.route('/api/tasks', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            tasks: [completedTask],
            total: 1,
            completed: 1,
            pending: 0
          })
        })
      })
      
      await page.goto('/')
      await page.click('[data-testid="tasks-button"]')
      
      const taskCard = page.locator(`[data-testid="task-${mockTask.id}"]`)
      const checkbox = taskCard.locator('input[type="checkbox"]')
      
      // Verify task is completed initially
      await expect(checkbox).toBeChecked()
      
      // Uncheck the task
      await checkbox.click()
      
      // Verify uncompleted state
      await expect(checkbox).not.toBeChecked()
      await expect(page.locator('.toast-success')).toContainText('marked as incomplete')
    })
  })

  test.describe('Error Scenarios', () => {
    test('should handle API failure gracefully', async () => {
      // Mock API failure
      await page.route('/api/tasks/**/complete', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Internal server error',
            success: false
          })
        })
      })
      
      await page.goto('/')
      await page.click('[data-testid="tasks-button"]')
      
      const taskCard = page.locator(`[data-testid="task-${mockTask.id}"]`)
      const checkbox = taskCard.locator('input[type="checkbox"]')
      
      // Attempt to complete task
      await checkbox.click()
      
      // Should show error feedback
      await expect(page.locator('.toast-error')).toBeVisible()
      await expect(page.locator('.toast-error')).toContainText('Failed to update task')
      
      // Checkbox should revert to original state
      await expect(checkbox).not.toBeChecked()
    })

    test('should handle authentication failure', async () => {
      // Mock auth failure
      await page.route('/api/tasks/**/complete', async route => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Authentication required'
          })
        })
      })
      
      await page.goto('/')
      await page.click('[data-testid="tasks-button"]')
      
      const checkbox = page.locator(`[data-testid="task-${mockTask.id}"] input[type="checkbox"]`)
      await checkbox.click()
      
      // Should show auth error
      await expect(page.locator('.toast-error')).toContainText('Authentication')
    })

    test('should handle network timeout', async () => {
      // Mock slow network
      await page.route('/api/tasks/**/complete', async route => {
        await new Promise(resolve => setTimeout(resolve, 10000)) // 10s timeout
        await route.fulfill({ status: 200, body: '{}' })
      })
      
      await page.goto('/')
      await page.click('[data-testid="tasks-button"]')
      
      const checkbox = page.locator(`[data-testid="task-${mockTask.id}"] input[type="checkbox"]`)
      
      // Start the operation
      await checkbox.click()
      
      // Should show loading state
      await expect(page.locator('[data-testid="task-loading"]')).toBeVisible()
      
      // Wait for timeout (should handle gracefully)
      await page.waitForTimeout(5000)
      
      // Should eventually show error or recover
      await expect(page.locator('.toast')).toBeVisible()
    })
  })

  test.describe('Mobile Interaction Testing', () => {
    test('should handle touch interactions on mobile', async () => {
      await page.goto('/')
      
      // Test swipe to open task panel (if implemented)
      await page.touchscreen.tap(50, 400) // Left edge
      await page.touchscreen.tap(350, 400) // Swipe right
      
      // Verify panel opens
      await expect(page.locator('[data-testid="task-panel"]')).toBeVisible()
      
      // Test touch on checkbox
      const checkbox = page.locator(`[data-testid="task-${mockTask.id}"] input[type="checkbox"]`)
      await checkbox.tap()
      
      // Verify touch feedback
      await expect(checkbox).toBeChecked()
    })

    test('should have proper touch targets (44px minimum)', async () => {
      await page.goto('/')
      await page.click('[data-testid="tasks-button"]')
      
      // Check checkbox touch target size
      const checkbox = page.locator(`[data-testid="task-${mockTask.id}"] input[type="checkbox"]`)
      const checkboxBox = await checkbox.boundingBox()
      
      // WCAG 2.5.5 - touch targets should be at least 44x44px
      expect(checkboxBox?.width).toBeGreaterThanOrEqual(44)
      expect(checkboxBox?.height).toBeGreaterThanOrEqual(44)
      
      // Check pin button touch target
      const pinButton = page.locator(`[data-testid="pin-${mockTask.id}"]`)
      const pinBox = await pinButton.boundingBox()
      
      expect(pinBox?.width).toBeGreaterThanOrEqual(44)
      expect(pinBox?.height).toBeGreaterThanOrEqual(44)
    })

    test('should handle rapid taps without issues', async () => {
      await page.goto('/')
      await page.click('[data-testid="tasks-button"]')
      
      const checkbox = page.locator(`[data-testid="task-${mockTask.id}"] input[type="checkbox"]`)
      
      // Rapid taps should not cause issues
      await checkbox.tap()
      await checkbox.tap()
      await checkbox.tap()
      
      // Should handle gracefully without multiple API calls
      await expect(page.locator('.toast')).toHaveCount(1) // Only one toast
    })
  })

  test.describe('Accessibility Compliance', () => {
    test('should be keyboard navigable', async () => {
      await page.goto('/')
      
      // Tab through interface
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      await page.keyboard.press('Enter') // Open tasks
      
      await expect(page.locator('[data-testid="task-panel"]')).toBeVisible()
      
      // Tab to task checkbox
      await page.keyboard.press('Tab')
      await page.keyboard.press('Space') // Toggle checkbox
      
      // Verify completion
      const checkbox = page.locator(`[data-testid="task-${mockTask.id}"] input[type="checkbox"]`)
      await expect(checkbox).toBeChecked()
    })

    test('should have proper ARIA labels', async () => {
      await page.goto('/')
      await page.click('[data-testid="tasks-button"]')
      
      const checkbox = page.locator(`[data-testid="task-${mockTask.id}"] input[type="checkbox"]`)
      
      // Should have aria-label
      const ariaLabel = await checkbox.getAttribute('aria-label')
      expect(ariaLabel).toContain('Complete project documentation')
      expect(ariaLabel).toContain('Mark')
    })

    test('should announce state changes to screen readers', async () => {
      await page.goto('/')
      await page.click('[data-testid="tasks-button"]')
      
      const checkbox = page.locator(`[data-testid="task-${mockTask.id}"] input[type="checkbox"]`)
      
      // Check for proper ARIA attributes
      expect(await checkbox.getAttribute('role')).toBe('checkbox')
      expect(await checkbox.getAttribute('aria-checked')).toBe('false')
      
      await checkbox.click()
      
      // After completion
      expect(await checkbox.getAttribute('aria-checked')).toBe('true')
    })
  })

  test.describe('Performance Tests', () => {
    test('should complete task operation within 500ms', async () => {
      await page.goto('/')
      await page.click('[data-testid="tasks-button"]')
      
      const checkbox = page.locator(`[data-testid="task-${mockTask.id}"] input[type="checkbox"]`)
      
      const startTime = Date.now()
      await checkbox.click()
      
      // Wait for completion indicator
      await expect(page.locator('.toast-success')).toBeVisible()
      const endTime = Date.now()
      
      // Should complete within 500ms
      expect(endTime - startTime).toBeLessThan(500)
    })

    test('should not cause memory leaks during rapid operations', async () => {
      await page.goto('/')
      await page.click('[data-testid="tasks-button"]')
      
      const checkbox = page.locator(`[data-testid="task-${mockTask.id}"] input[type="checkbox"]`)
      
      // Perform multiple operations
      for (let i = 0; i < 10; i++) {
        await checkbox.click()
        await page.waitForTimeout(100)
      }
      
      // Check for excessive DOM nodes or event listeners
      const nodeCount = await page.evaluate(() => document.querySelectorAll('*').length)
      expect(nodeCount).toBeLessThan(1000) // Reasonable DOM size
    })
  })
})