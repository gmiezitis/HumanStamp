import { chromium, Browser, Page } from '@playwright/test';
import { mkdir } from 'fs/promises';

const BASE_URL = 'http://localhost:3000';
const ARTIFACTS_DIR = '/workspace/cloud-agent-artifacts/bc-15e53067-c0a6-5369-af8c-d2bd4a77eafe';

async function screenshot(page: Page, name: string, fullPage = false) {
  await mkdir(ARTIFACTS_DIR, { recursive: true });
  await page.screenshot({
    path: `${ARTIFACTS_DIR}/${name}.png`,
    fullPage,
  });
  console.log(`✓ Screenshot: ${name}.png`);
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
  });

  try {
    console.log('\n=== Testing Human Stamp Demo Flow ===\n');

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    // 1. Landing page
    console.log('1. Landing page...');
    await page.goto(BASE_URL);
    await page.waitForSelector('text=Approved, Provable AI Video');
    await screenshot(page, '01-landing-full', true);
    console.log('   Landing page loaded successfully');

    // 2. Click "Try the Live Demo"
    console.log('\n2. Demo login...');
    await page.click('button:has-text("Try the Live Demo")');
    await page.waitForURL('**/dashboard');
    await page.waitForSelector('text=Dashboard');
    await screenshot(page, '02-dashboard', true);
    console.log('   Successfully logged in to dashboard');

    // 3. Onboarding tour (if visible)
    console.log('\n3. Checking for onboarding tour...');
    const tourVisible = await page.locator('text=See What Changed').isVisible().catch(() => false);
    if (tourVisible) {
      await screenshot(page, '03-onboarding-tour');
      await page.click('button:has-text("Skip Tour")');
      console.log('   Onboarding tour captured and dismissed');
    } else {
      console.log('   Onboarding tour not visible (localStorage check)');
    }

    // 4. Navigate to workspace
    console.log('\n4. Navigating to workspace...');
    await page.click('text=Nordic Creative Agency');
    await page.waitForSelector('text=TechNordic AB');
    console.log('   Workspace page loaded');

    // 5. Navigate to client
    console.log('\n5. Navigating to client...');
    await page.locator('a[href*="/dashboard/clients/"]').first().click();
    await page.waitForSelector('text=Winter Product Launch');
    console.log('   Client page loaded');

    // 6. Navigate to project
    console.log('\n6. Navigating to project...');
    await page.locator('a[href*="/dashboard/projects/"]').first().click();
    await page.waitForTimeout(2000);
    await screenshot(page, '04-project-versions', true);
    console.log('   Project page loaded with versions');

    // 7. Compare versions (navigate to version detail first)
    console.log('\n7. Testing version detail and compare...');
    const versionLink = await page.locator('a[href*="/versions/"]').first();
    if (await versionLink.isVisible()) {
      await versionLink.click();
      await page.waitForTimeout(2000);
      await screenshot(page, '05-version-detail', true);
      console.log('   Version detail page captured');

      // Try to find compare link
      const compareLink = await page.locator('a[href*="/compare/"]').first();
      if (await compareLink.isVisible().catch(() => false)) {
        await compareLink.click();
        await page.waitForTimeout(2000);
        await screenshot(page, '06-compare-timeline', true);
        console.log('   Compare view captured');
        await page.goBack();
      } else {
        console.log('   Compare link not visible on this version');
      }
    }

    // 8. Receipt page - use direct link from seed output
    console.log('\n8. Testing receipt page...');
    await page.goto(`${BASE_URL}/r/cmukyx0ry000rrkva2r0p49qn`);
    try {
      await page.waitForSelector('text=Record of Approval and Disclosure', { timeout: 5000 });
      await page.waitForTimeout(1500); // Let QR code render
      await screenshot(page, '07-receipt-full', true);
      console.log('   Receipt page captured');

      // Test evidence pack download availability
      const evidencePackButton = await page.locator('text=Download Evidence Pack').isVisible();
      console.log(`   Evidence pack button visible: ${evidencePackButton}`);
    } catch (e) {
      console.log('   Receipt page not found or timed out');
    }

    // 10. Client sign-off page
    console.log('\n10. Testing client sign-off page...');
    await page.goto(`${BASE_URL}/signoff/demo-signoff-v2-pending`);
    await page.waitForSelector('text=Client Sign-off');
    await page.waitForSelector('text=Review & Sign-off');
    await screenshot(page, '08-signoff-page', true);
    console.log('   Client sign-off page captured');

    // 11. Mobile landing page
    console.log('\n11. Capturing mobile landing page...');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE_URL);
    await page.waitForSelector('text=Approved, Provable AI Video');
    await screenshot(page, '09-landing-mobile', true);
    console.log('   Mobile landing page captured');

    console.log('\n=== Demo Flow Test Complete ===');
    console.log(`\nScreenshots saved to: ${ARTIFACTS_DIR}\n`);

    await context.close();
  } catch (error) {
    console.error('\n❌ Error during test:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
