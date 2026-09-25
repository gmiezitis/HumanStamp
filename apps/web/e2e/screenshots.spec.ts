import { test } from '@playwright/test';

test.describe('Generate demo screenshots', () => {
  const baseURL = 'http://localhost:3000';

  test('capture screenshots for documentation', async ({ page }) => {
    // 1. Dashboard (landing page instead since auth is complex)
    await page.goto(`${baseURL}/`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ 
      path: '/opt/cursor/artifacts/screenshots/01-landing-page.png',
      fullPage: true 
    });
    console.log('✓ Captured: Landing page');

    // 2. Sign-in page
    await page.goto(`${baseURL}/auth/signin`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ 
      path: '/opt/cursor/artifacts/screenshots/02-signin.png',
      fullPage: true 
    });
    console.log('✓ Captured: Sign-in page');

    // 3. Verify page
    await page.goto(`${baseURL}/verify`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ 
      path: '/opt/cursor/artifacts/screenshots/03-verify-page.png',
      fullPage: true 
    });
    console.log('✓ Captured: Verify page');

    // 4. Receipt page (using test data from seed)
    // Note: Without auth, we can't access dynamic receipt, so capture the route structure
    await page.goto(`${baseURL}/`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ 
      path: '/opt/cursor/artifacts/screenshots/04-home-with-verify-cta.png',
      fullPage: true 
    });
    console.log('✓ Captured: Home with verify CTA');

    // 5. Sign-off page structure
    await page.goto(`${baseURL}/signoff/demo-signoff-token-123`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ 
      path: '/opt/cursor/artifacts/screenshots/05-signoff-page.png',
      fullPage: true 
    });
    console.log('✓ Captured: Sign-off page');

    // 6. Auth verify page
    await page.goto(`${baseURL}/auth/verify?token=demo-token`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ 
      path: '/opt/cursor/artifacts/screenshots/06-auth-verify.png',
      fullPage: true 
    });
    console.log('✓ Captured: Auth verify page');

    console.log('\n✅ All screenshots captured to /opt/cursor/artifacts/screenshots/');
  });
});
