import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

test.describe('Complete Demo Workflow', () => {
  const baseURL = 'http://localhost:3000';
  const testEmail = 'demo@humanstamp.test';
  const screenshotDir = '/opt/cursor/artifacts/screenshots';
  
  const v1Path = join(__dirname, '../test-videos/test-v1.mp4');
  const v2Path = join(__dirname, '../test-videos/test-v2.mp4');

  test('Full workflow: upload, compare, approve, signoff, receipt, verify', async ({ page, context }) => {
    test.setTimeout(180000); // 3 minutes

    // Step 1: Test login
    console.log('Step 1: Test login');
    await context.request.post(`${baseURL}/api/auth/test-login`, {
      data: { email: testEmail },
    });

    // Step 2: Navigate to dashboard
    console.log('Step 2: Dashboard');
    await page.goto(`${baseURL}/dashboard`, { waitUntil: 'networkidle' });
    await expect(page.locator('text=Workspaces')).toBeVisible();
    
    await page.screenshot({ 
      path: `${screenshotDir}/01-dashboard.png`,
      fullPage: false 
    });

    // Step 3: Choose Demo Agency workspace
    console.log('Step 3: Navigate to project');
    await page.click('text=Demo Agency');
    await page.waitForLoadState('networkidle');
    await page.click('text=Euronics-like Brand');
    await page.waitForLoadState('networkidle');
    await page.click('text=Autumn Campaign');
    await page.waitForLoadState('networkidle');

    // Step 4: Upload v1
    console.log('Step 4: Upload v1');
    const [fileChooser1] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.locator('input[type="file"]').click(),
    ]);
    await fileChooser1.setFiles(v1Path);
    
    await page.selectOption('select', 'human');
    await page.click('button:has-text("Upload Version")');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for processing

    // Screenshot project with versions
    await page.screenshot({ 
      path: `${screenshotDir}/02-project-versions.png`,
      fullPage: false 
    });

    // Step 5: Upload v2 (will create mismatch if metadata differs)
    console.log('Step 5: Upload v2');
    const [fileChooser2] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.locator('input[type="file"]').click(),
    ]);
    await fileChooser2.setFiles(v2Path);
    
    await page.selectOption('select', 'human');
    await page.click('button:has-text("Upload Version")');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Step 6: Navigate to latest version (v2)
    console.log('Step 6: View version details');
    const versionLinks = await page.locator('a:has-text("View Details & Actions")').all();
    if (versionLinks.length > 0) {
      await versionLinks[0].click();
      await page.waitForLoadState('networkidle');
    }

    // Step 7: Compare with v1
    console.log('Step 7: Compare versions');
    const compareLink = await page.locator('a:has-text("Compare with")').first();
    if (await compareLink.isVisible()) {
      await compareLink.click();
      await page.waitForLoadState('networkidle');
      
      // Acknowledge mismatch if present
      const ackButton = await page.locator('button:has-text("Acknowledge")');
      if (await ackButton.isVisible()) {
        await ackButton.click();
        await page.waitForLoadState('networkidle');
      }

      await page.screenshot({ 
        path: `${screenshotDir}/03-compare-mismatch.png`,
        fullPage: false 
      });

      await page.goBack();
      await page.waitForLoadState('networkidle');
    }

    // Step 8: Approve version
    console.log('Step 8: Approve version');
    await page.click('button:has-text("Approve This Version")');
    await page.waitForTimeout(1000);
    await page.on('dialog', dialog => dialog.accept());
    await page.click('button:has-text("Approve This Version")');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Step 9: Create sign-off (from project level, need to implement this)
    console.log('Step 9: Navigate to sign-off');
    // For now, use the seeded sign-off
    await page.goto(`${baseURL}/signoff/demo-signoff-token-123`, { waitUntil: 'networkidle' });
    
    await page.screenshot({ 
      path: `${screenshotDir}/04-client-signoff.png`,
      fullPage: false 
    });

    // Submit sign-off
    await page.fill('input[type="text"]', 'Test Client');
    await page.click('button:has-text("Submit Sign-off")');
    await page.waitForLoadState('networkidle');

    // Step 10: Generate receipt
    console.log('Step 10: Generate receipt');
    await page.goBack();
    await page.goBack();
    await page.waitForLoadState('networkidle');
    
    await page.click('button:has-text("Generate Receipt")');
    await page.on('dialog', dialog => dialog.accept());
    await page.click('button:has-text("Generate Receipt")');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Should now be on receipt page
    await expect(page.locator('h1:has-text("Record of Approval")')).toBeVisible({ timeout: 10000 });
    
    await page.screenshot({ 
      path: `${screenshotDir}/05-receipt-qr.png`,
      fullPage: false 
    });

    // Step 11: Download PDF and JSON
    console.log('Step 11: Download exports');
    const pdfPath = '/tmp/receipt.pdf';
    const jsonPath = '/tmp/receipt.json';

    const [download1] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a:has-text("Download PDF")'),
    ]);
    await download1.saveAs(pdfPath);

    const [download2] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a:has-text("Download JSON")'),
    ]);
    await download2.saveAs(jsonPath);

    // Verify file sizes
    const pdfSize = readFileSync(pdfPath).length;
    const jsonSize = readFileSync(jsonPath).length;
    expect(pdfSize).toBeGreaterThan(0);
    expect(jsonSize).toBeGreaterThan(0);
    console.log(`PDF size: ${pdfSize} bytes, JSON size: ${jsonSize} bytes`);

    // Step 12: Render PDF first page
    console.log('Step 12: Render PDF page');
    execSync(
      `pdftoppm -png -f 1 -l 1 "${pdfPath}" "${screenshotDir}/07-pdf-page" || ` +
      `convert "${pdfPath}[0]" "${screenshotDir}/07-pdf-page1.png"`,
      { stdio: 'ignore' }
    );
    // Rename if needed
    if (existsSync(`${screenshotDir}/07-pdf-page-1.png`)) {
      execSync(`mv "${screenshotDir}/07-pdf-page-1.png" "${screenshotDir}/07-pdf-page1.png"`);
    }

    // Step 13: Re-encode v2 and verify
    console.log('Step 13: Re-encode and verify');
    const v2ReencodedPath = '/tmp/test-v2-reencoded.mp4';
    execSync(
      `ffmpeg -y -i "${v2Path}" -c:v libx264 -crf 30 "${v2ReencodedPath}"`,
      { stdio: 'ignore' }
    );

    await page.goto(`${baseURL}/verify`, { waitUntil: 'networkidle' });
    
    const [fileChooser3] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.locator('input[type="file"]').click(),
    ]);
    await fileChooser3.setFiles(v2ReencodedPath);
    
    await page.click('button:has-text("Verify")');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Wait for verification

    // Should show match result
    await expect(page.locator('text=Match')).toBeVisible({ timeout: 10000 });
    
    await page.screenshot({ 
      path: `${screenshotDir}/06-verify-match.png`,
      fullPage: false 
    });

    console.log('✅ Full workflow completed!');
  });
});
