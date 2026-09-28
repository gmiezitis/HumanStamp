import { chromium, Browser, Page } from '@playwright/test';
import { mkdir, writeFile } from 'fs/promises';
import { execSync } from 'child_process';

const BASE_URL = 'http://localhost:3000';
const ARTIFACTS_DIR = '/opt/cursor/artifacts';

async function screenshot(page: Page, name: string, fullPage = false) {
  await mkdir(ARTIFACTS_DIR, { recursive: true });
  await page.screenshot({
    path: `${ARTIFACTS_DIR}/${name}.png`,
    fullPage,
  });
  console.log(`✓ Screenshot: ${name}.png`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  try {
    console.log('\n=== Testing Human Stamp Demo Flow ===\n');

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    // 1. Landing page
    console.log('1. Landing page (full)...');
    await page.goto(BASE_URL);
    await page.waitForSelector('text=Approved, Provable AI Video');
    await screenshot(page, '01-landing-full', true);

    // 2. Demo login
    console.log('2. Demo login...');
    await page.click('button:has-text("Try the Live Demo")');
    await page.waitForURL('**/dashboard');
    await page.waitForTimeout(1000);

    // 3. Dashboard WITH tour
    console.log('3. Dashboard with tour...');
    const tourVisible = await page.locator('text=See What Changed').isVisible().catch(() => false);
    if (tourVisible) {
      await screenshot(page, '03-onboarding-tour');
      await page.click('button:has-text("Skip Tour")');
    }

    // 4. Dashboard WITHOUT tour
    console.log('4. Dashboard (tour dismissed)...');
    await page.waitForTimeout(500);
    await screenshot(page, '02-dashboard', true);

    // 5. Navigate to project
    console.log('5. Navigating to project...');
    await page.locator('a[href*="/dashboard/workspaces/"]').first().click();
    await page.waitForTimeout(1000);
    await page.locator('a[href*="/dashboard/clients/"]').first().click();
    await page.waitForTimeout(1000);
    await page.locator('a[href*="/dashboard/projects/"]').first().click();
    await page.waitForTimeout(2000);
    await screenshot(page, '04-project-page', true);

    // 6. Version detail
    console.log('6. Version detail...');
    await page.locator('a[href*="/versions/"]').first().click();
    await page.waitForTimeout(2000);
    await screenshot(page, '05-version-detail', true);

    // 7. Compare with timeline
    console.log('7. Compare view...');
    const compareLink = await page.locator('a[href*="/compare/"]').first();
    if (await compareLink.isVisible().catch(() => false)) {
      await compareLink.click();
      await page.waitForTimeout(2000);
      await screenshot(page, '06-compare-timeline', true);
      console.log('   Compare view captured');
    } else {
      console.log('   ⚠ No compare link found');
    }

    // 8. Receipt page - dynamically get receipt ID
    console.log('8. Receipt page...');
    const receiptResponse = await page.request.get(`${BASE_URL}/api/health`);
    let receiptId = 'cmukzn0df000r7g3pxeptyhk3'; // fallback
    
    // Try to find receipt link from dashboard or project page
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(1000);
    
    try {
      const workspaceLink = await page.locator('a[href*="/dashboard/workspaces/"]').first();
      await workspaceLink.click();
      await page.waitForTimeout(500);
      
      const clientLink = await page.locator('a[href*="/dashboard/clients/"]').first();
      await clientLink.click();
      await page.waitForTimeout(500);
      
      const projectLink = await page.locator('a[href*="/dashboard/projects/"]').first();
      await projectLink.click();
      await page.waitForTimeout(1000);
      
      // Try to find receipt button
      const receiptButton = page.locator('text=View Receipt').first();
      if (await receiptButton.isVisible().catch(() => false)) {
        await receiptButton.click();
        await page.waitForTimeout(1000);
        receiptId = page.url().split('/r/')[1];
      }
    } catch (e) {
      console.log('   Using fallback receipt ID');
    }
    
    await page.goto(`${BASE_URL}/r/${receiptId}`);
    await page.waitForSelector('text=Record', { timeout: 10000 });
    await page.waitForTimeout(1500);
    await screenshot(page, '07-receipt-full', true);

    // 9. Sign-off page
    console.log('9. Sign-off page...');
    await page.goto(`${BASE_URL}/signoff/demo-signoff-v2-pending`);
    await page.waitForSelector('text=Sign-off', { timeout: 5000 });
    await page.waitForTimeout(1000);
    await screenshot(page, '08-signoff-page', true);

    // 10. Mobile landing
    console.log('10. Mobile landing...');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE_URL);
    await page.waitForSelector('text=Approved, Provable AI Video');
    await screenshot(page, '09-landing-mobile', true);

    // 11. PDF export and conversion
    console.log('11. PDF export...');
    await page.setViewportSize({ width: 1440, height: 900 });
    const pdfResponse = await page.request.get(`${BASE_URL}/api/receipts/${receiptId}/export?format=pdf`);
    if (pdfResponse.ok()) {
      const pdfBuffer = await pdfResponse.body();
      await writeFile(`${ARTIFACTS_DIR}/receipt.pdf`, pdfBuffer);
      console.log(`   ✓ PDF downloaded (${pdfBuffer.length} bytes)`);

      try {
        execSync(`convert -density 150 "${ARTIFACTS_DIR}/receipt.pdf[0]" "${ARTIFACTS_DIR}/10-pdf-first-page.png"`, {
          stdio: 'ignore'
        });
        console.log('   ✓ PDF first page converted to PNG');
      } catch (e) {
        console.log('   ⚠ ImageMagick conversion failed');
      }
    }

    // 12. Evidence pack
    console.log('12. Evidence pack...');
    const evidenceResponse = await page.request.get(`${BASE_URL}/api/receipts/${receiptId}/evidence-pack`);
    if (evidenceResponse.ok()) {
      const evidenceBuffer = await evidenceResponse.body();
      await writeFile(`${ARTIFACTS_DIR}/evidence-pack.zip`, evidenceBuffer);
      console.log(`   ✓ Evidence pack downloaded (${evidenceBuffer.length} bytes)`);

      try {
        const zipContents = execSync(`unzip -l "${ARTIFACTS_DIR}/evidence-pack.zip"`, { encoding: 'utf-8' });
        console.log('\n   Evidence pack contents:');
        console.log(zipContents);
      } catch (e) {
        console.log('   ⚠ Could not list zip contents');
      }
    }

    console.log('\n=== Demo Flow Test Complete ===');
    console.log(`Screenshots saved to: ${ARTIFACTS_DIR}\n`);

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
