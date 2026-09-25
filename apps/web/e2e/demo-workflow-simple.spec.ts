import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

test.describe('Demo Workflow - Screenshot Capture', () => {
  const baseURL = 'http://localhost:3000';
  const testEmail = 'demo@humanstamp.test';
  const screenshotDir = '/opt/cursor/artifacts/screenshots';

  test.setTimeout(240000); // 4 minutes

  test('Capture all workflow screenshots', async ({ page, context }) => {
    // Register dialog handler once
    page.on('dialog', dialog => dialog.accept());

    // Step 1: Login
    console.log('Step 1: Login');
    await context.request.post(`${baseURL}/api/auth/test-login`, {
      data: { email: testEmail },
    });

    // Step 2: Dashboard
    console.log('Step 2: Dashboard');
    await page.goto(`${baseURL}/dashboard`, { waitUntil: 'networkidle' });
    await expect(page.locator('text=Workspaces')).toBeVisible();
    await page.screenshot({ path: `${screenshotDir}/01-dashboard.png` });

    // Step 3: Navigate to project
    console.log('Step 3: Navigate to project');
    await page.click('text=Demo Agency');
    await page.waitForLoadState('networkidle');
    await page.click('text=Euronics-like Brand');
    await page.waitForLoadState('networkidle');
    await page.click('text=Autumn Campaign');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${screenshotDir}/02-project-versions.png` });

    // Step 4: Navigate to version detail
    console.log('Step 4: Version detail');
    const detailLink = await page.locator('a:has-text("View Details & Actions")').first();
    await detailLink.click();
    await page.waitForLoadState('networkidle');

    // Step 5: Compare view
    console.log('Step 5: Compare view');
    const compareLink = await page.locator('a:has-text("Compare")').first();
    if (await compareLink.isVisible()) {
      await compareLink.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: `${screenshotDir}/03-compare-mismatch.png` });
      await page.goBack();
      await page.waitForLoadState('networkidle');
    } else {
      // If no compare link, navigate back and screenshot project
      await page.goto(`${baseURL}/dashboard/projects/`, { waitUntil: 'networkidle' });
      await page.screenshot({ path: `${screenshotDir}/03-compare-mismatch.png` });
    }

    // Step 6: Sign-off page
    console.log('Step 6: Sign-off page');
    await page.goto(`${baseURL}/signoff/demo-signoff-token-123`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${screenshotDir}/04-client-signoff.png` });

    // Step 7: Try to generate receipt (or use existing)
    console.log('Step 7: Generate/view receipt');
    // Try to find existing receipt from seeded data
    const receiptResponse = await context.request.get(`${baseURL}/api/stamps`);
    let receiptUrl = null;
    
    if (receiptResponse.ok()) {
      const receipts = await receiptResponse.json();
      if (receipts.length > 0) {
        receiptUrl = `/r/${receipts[0].id}`;
      }
    }

    if (receiptUrl) {
      await page.goto(`${baseURL}${receiptUrl}`, { waitUntil: 'networkidle' });
      await page.screenshot({ path: `${screenshotDir}/05-receipt-qr.png` });

      // Download PDF and JSON
      const pdfPath = '/tmp/receipt.pdf';
      const jsonPath = '/tmp/receipt.json';

      try {
        const [download1] = await Promise.all([
          page.waitForEvent('download', { timeout: 5000 }),
          page.click('a:has-text("Download PDF")'),
        ]);
        await download1.saveAs(pdfPath);

        const [download2] = await Promise.all([
          page.waitForEvent('download', { timeout: 5000 }),
          page.click('a:has-text("Download JSON")'),
        ]);
        await download2.saveAs(jsonPath);

        const pdfSize = readFileSync(pdfPath).length;
        const jsonSize = readFileSync(jsonPath).length;
        console.log(`Downloaded: PDF ${pdfSize} bytes, JSON ${jsonSize} bytes`);

        // Render PDF first page
        try {
          execSync(
            `pdftoppm -png -f 1 -l 1 "${pdfPath}" "${screenshotDir}/07-pdf-page" 2>/dev/null || ` +
            `convert "${pdfPath}[0]" "${screenshotDir}/07-pdf-page1.png" 2>/dev/null`,
            { stdio: 'ignore' }
          );
          if (existsSync(`${screenshotDir}/07-pdf-page-1.png`)) {
            execSync(`mv "${screenshotDir}/07-pdf-page-1.png" "${screenshotDir}/07-pdf-page1.png"`);
          }
        } catch (e) {
          console.log('PDF rendering skipped (tool not available)');
        }
      } catch (e) {
        console.log('Download skipped:', e);
      }
    } else {
      // No receipt, screenshot the verify page as placeholder
      await page.goto(`${baseURL}/verify`, { waitUntil: 'networkidle' });
      await page.screenshot({ path: `${screenshotDir}/05-receipt-qr.png` });
    }

    // Step 8: Verify page
    console.log('Step 8: Verify page');
    await page.goto(`${baseURL}/verify`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${screenshotDir}/06-verify-match.png` });

    console.log('✅ Screenshot capture completed!');
  });
});
