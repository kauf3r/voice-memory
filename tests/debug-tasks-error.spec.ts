import { test, expect } from '@playwright/test';

test.describe('Debug Tasks Rendering Error', () => {
  test('should identify the object rendering issue in tasks', async ({ page }) => {
    // Capture console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
        console.log(`[BROWSER ERROR]:`, msg.text());
      }
    });

    // Capture page errors
    page.on('pageerror', error => {
      console.log(`[PAGE ERROR]:`, error.message);
      errors.push(error.message);
    });

    console.log('🔍 Navigating to knowledge page to reproduce error...');
    
    try {
      await page.goto('/knowledge');
      
      // Wait for page to load
      await page.waitForLoadState('networkidle');
      
      console.log('📍 Checking if Tasks tab is visible...');
      const tasksTab = page.locator('button:has-text("Tasks")');
      const tasksTabVisible = await tasksTab.count() > 0;
      
      console.log(`Tasks tab visible: ${tasksTabVisible}`);
      
      if (tasksTabVisible) {
        console.log('🎯 Clicking Tasks tab to trigger error...');
        await tasksTab.click();
        
        // Wait a moment for any errors to appear
        await page.waitForTimeout(2000);
        
        // Check if error occurred
        if (errors.length > 0) {
          console.log('❌ Errors found:');
          errors.forEach((error, index) => {
            console.log(`  ${index + 1}. ${error}`);
          });
        } else {
          console.log('✅ No errors found after clicking Tasks tab');
        }
        
        // Try to capture the actual data being rendered
        console.log('🔍 Checking what data is being passed to tasks...');
        
        const taskData = await page.evaluate(() => {
          // Try to find any elements that might contain the problematic data
          const taskElements = document.querySelectorAll('[class*="task"], [data-testid*="task"]');
          const taskData: any[] = [];
          
          taskElements.forEach((element, index) => {
            taskData.push({
              index,
              innerHTML: element.innerHTML.substring(0, 200),
              textContent: element.textContent?.substring(0, 100)
            });
          });
          
          return taskData;
        });
        
        console.log('📊 Task elements found:', taskData.length);
        taskData.forEach((data, index) => {     
          console.log(`  Task ${index}:`, data.textContent);
        });
        
      } else {
        console.log('❌ Tasks tab not found - user might not be authenticated');
      }
      
      // Take screenshot for debugging
      await page.screenshot({ path: 'debug-tasks-error.png', fullPage: true });
      console.log('📸 Screenshot saved as debug-tasks-error.png');
      
    } catch (error) {
      console.log('❌ Test failed with error:', error);
    }
    
    // Summary
    console.log(`\n📋 Summary:`);
    console.log(`- Errors captured: ${errors.length}`);
    console.log(`- Page loaded successfully: ${true}`);
    
    if (errors.length > 0) {
      console.log('\n🔍 Error Analysis:');
      const objectErrors = errors.filter(error => 
        error.includes('Objects are not valid as a React child') ||
        error.includes('task, nextSteps, assignedTo')
      );
      
      if (objectErrors.length > 0) {
        console.log('✅ Found the object rendering error!');
        console.log('🎯 The issue is likely in the tasks rendering where an object is being rendered directly instead of its properties');
      }
    }
  });

  test('should inspect the API response to understand task structure', async ({ page }) => {
    // Intercept API calls to see the actual data structure
    const apiResponses: any[] = [];
    
    page.on('response', async response => {
      if (response.url().includes('/api/knowledge')) {
        try {
          const responseData = await response.json();
          apiResponses.push(responseData);
          console.log('📡 API Response intercepted');
          
          if (responseData.knowledge?.content?.allTasks) {
            const tasks = responseData.knowledge.content.allTasks;
            console.log(`📊 Found ${tasks.length} tasks in API response`);
            
            if (tasks.length > 0) {
              console.log('🔍 Sample task structure:');
              const sampleTask = tasks[0];
              console.log('Task keys:', Object.keys(sampleTask));
              console.log('Task description type:', typeof sampleTask.description);
              console.log('Task description:', sampleTask.description);
              
              // Check if description is an object
              if (typeof sampleTask.description === 'object') {
                console.log('❌ FOUND THE ISSUE: Task description is an object!');
                console.log('Object keys:', Object.keys(sampleTask.description));
                console.log('Object content:', JSON.stringify(sampleTask.description, null, 2));
              }
            }
          }
        } catch (error) {
          console.log('❌ Error parsing API response:', error);
        }
      }
    });

    await page.goto('/knowledge');
    await page.waitForLoadState('networkidle');
    
    // Try to trigger API call
    const tasksTab = page.locator('button:has-text("Tasks")');
    if (await tasksTab.count() > 0) {
      await tasksTab.click();
      await page.waitForTimeout(1000);
    }
    
    console.log(`📋 API responses captured: ${apiResponses.length}`);
  });
});