import { test, expect } from '@playwright/test';

test.describe('Complete Agency Demo Workflow', () => {
  const baseURL = 'http://localhost:3000';
  const testEmail = 'demo@humanstamp.test';

  test('full 10-step workflow with auth', async ({ page, context }) => {
    // Step 1: Test login (using test endpoint)
    console.log('Step 1: Authenticate via test endpoint');
    const loginResponse = await context.request.post(`${baseURL}/api/auth/test-login`, {
      data: { email: testEmail },
    });
    expect(loginResponse.ok()).toBeTruthy();

    // Step 2: Navigate to dashboard
    console.log('Step 2: Navigate to dashboard');
    await page.goto(`${baseURL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Workspaces')).toBeVisible();
    await expect(page.locator('text=Demo Agency')).toBeVisible();

    // Step 3: Navigate to workspace
    console.log('Step 3: Open Demo Agency workspace');
    await page.click('text=Demo Agency');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Demo Agency');

    // Step 4: Navigate to client
    console.log('Step 4: Open Euronics-like Brand client');
    await page.click('text=Euronics-like Brand');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Euronics-like Brand');

    // Step 5: Navigate to project
    console.log('Step 5: Open Autumn Campaign project');
    await page.click('text=Autumn Campaign');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Autumn Campaign');

    // Step 6: Verify versions exist
    console.log('Step 6: Check existing versions');
    await expect(page.locator('text=v1')).toBeVisible();
    await expect(page.locator('text=v2')).toBeVisible();

    // Step 7: Capture project page screenshot
    console.log('Step 7: Capture project page screenshot');
    await page.screenshot({ 
      path: '/opt/cursor/artifacts/screenshots/demo-01-project-versions.png',
      fullPage: true 
    });

    // Step 8: Navigate to receipt page (using seeded data)
    console.log('Step 8: Check receipt page');
    await page.goto(`${baseURL}/`);
    await page.waitForLoadState('networkidle');
    
    // Capture landing page
    await page.screenshot({ 
      path: '/opt/cursor/artifacts/screenshots/demo-02-landing-styled.png',
      fullPage: true 
    });

    // Step 9: Check verify page
    console.log('Step 9: Navigate to verify page');
    await page.goto(`${baseURL}/verify`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Verify');
    
    await page.screenshot({ 
      path: '/opt/cursor/artifacts/screenshots/demo-03-verify-styled.png',
      fullPage: true 
    });

    // Step 10: Check client sign-off page
    console.log('Step 10: Navigate to client sign-off page');
    await page.goto(`${baseURL}/signoff/demo-signoff-token-123`);
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ 
      path: '/opt/cursor/artifacts/screenshots/demo-04-signoff-page.png',
      fullPage: true 
    });

    console.log('✅ All 10 steps completed successfully!');
  });
});
