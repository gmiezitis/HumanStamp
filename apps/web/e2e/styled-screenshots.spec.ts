import { test, expect } from '@playwright/test';

test.describe('Capture styled screenshots', () => {
  const baseURL = 'http://localhost:3000';
  const testEmail = 'demo@humanstamp.test';

  test('capture all styled pages', async ({ page, context }) => {
    // Authenticate
    await context.request.post(`${baseURL}/api/auth/test-login`, {
      data: { email: testEmail },
    });

    // 1. Dashboard with workspaces
    await page.goto(`${baseURL}/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ 
      path: '/opt/cursor/artifacts/screenshots/final-01-dashboard.png',
      fullPage: true 
    });
    console.log('✓ Captured: Dashboard');

    // 2. Landing page
    await page.goto(`${baseURL}/`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ 
      path: '/opt/cursor/artifacts/screenshots/final-02-landing.png',
      fullPage: true 
    });
    console.log('✓ Captured: Landing page');

    // 3. Sign-in page
    await page.goto(`${baseURL}/auth/signin`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ 
      path: '/opt/cursor/artifacts/screenshots/final-03-signin.png',
      fullPage: true 
    });
    console.log('✓ Captured: Sign-in page');

    // 4. Verify page
    await page.goto(`${baseURL}/verify`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ 
      path: '/opt/cursor/artifacts/screenshots/final-04-verify.png',
      fullPage: true 
    });
    console.log('✓ Captured: Verify page');

    // 5. Sign-off page
    await page.goto(`${baseURL}/signoff/demo-signoff-token-123`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ 
      path: '/opt/cursor/artifacts/screenshots/final-05-signoff.png',
      fullPage: true 
    });
    console.log('✓ Captured: Sign-off page');

    // 6. Check if we can navigate to project (if seeded)
    try {
      await page.goto(`${baseURL}/dashboard`);
      await page.waitForLoadState('networkidle');
      
      // Try to click through to project if it exists
      const demoAgency = page.locator('text=Demo Agency').first();
      if (await demoAgency.isVisible({ timeout: 2000 })) {
        await demoAgency.click();
        await page.waitForLoadState('networkidle');
        
        const client = page.locator('text=Euronics-like Brand').first();
        if (await client.isVisible({ timeout: 2000 })) {
          await client.click();
          await page.waitForLoadState('networkidle');
          
          const project = page.locator('text=Autumn Campaign').first();
          if (await project.isVisible({ timeout: 2000 })) {
            await project.click();
            await page.waitForLoadState('networkidle');
            
            await page.screenshot({ 
              path: '/opt/cursor/artifacts/screenshots/final-06-project.png',
              fullPage: true 
            });
            console.log('✓ Captured: Project page with versions');
          }
        }
      }
    } catch (e) {
      console.log('Could not navigate to project page (no seeded data?)');
    }

    console.log('\n✅ All styled screenshots captured!');
  });
});
