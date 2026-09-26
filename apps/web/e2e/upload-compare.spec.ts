import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

test('upload and compare workflow', async ({ page }) => {
  const testVideosDir = join(__dirname, 'test-videos');
  const v1Path = join(testVideosDir, 'v1.mp4');
  const v2Path = join(testVideosDir, 'v2.mp4');

  console.log('Logging in via test-login...');
  await page.goto('/api/auth/test-login');
  await page.waitForURL('/dashboard', { timeout: 10000 });

  console.log('Finding seeded project...');
  await page.goto('/dashboard');
  
  const workspaceLink = page.locator('a:has-text("Demo Agency")').first();
  await expect(workspaceLink).toBeVisible();
  await workspaceLink.click();
  
  await page.waitForURL(/\/dashboard\/workspaces\/[^/]+/, { timeout: 10000 });
  
  const clientLink = page.locator('a:has-text("Euronics-like Brand")').first();
  await expect(clientLink).toBeVisible();
  await clientLink.click();
  
  await page.waitForURL(/\/dashboard\/clients\/[^/]+/, { timeout: 10000 });
  
  const projectLink = page.locator('a:has-text("Autumn Campaign")').first();
  await expect(projectLink).toBeVisible();
  await projectLink.click();
  
  await page.waitForURL(/\/dashboard\/projects\/[^/]+/, { timeout: 10000 });

  const projectUrl = page.url();
  const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1];
  console.log(`Project ID: ${projectId}`);

  console.log('Uploading v1.mp4...');
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(v1Path);
  
  const uploadButton = page.locator('button:has-text("Upload Version")');
  await uploadButton.click();

  console.log('Waiting for v1 to be processed...');
  await page.waitForTimeout(2000);
  
  let processed = false;
  for (let i = 0; i < 30; i++) {
    await page.reload();
    const versions = await page.locator('text=/v\\d+/').count();
    if (versions >= 3) {
      console.log(`Found ${versions} versions, checking for processing completion...`);
      processed = true;
      break;
    }
    await page.waitForTimeout(2000);
  }

  expect(processed).toBe(true);

  console.log('Uploading v2.mp4...');
  await fileInput.setInputFiles(v2Path);
  await uploadButton.click();

  console.log('Waiting for v2 to be processed...');
  await page.waitForTimeout(2000);
  
  processed = false;
  for (let i = 0; i < 30; i++) {
    await page.reload();
    const versions = await page.locator('text=/v\\d+/').count();
    if (versions >= 4) {
      console.log(`Found ${versions} versions, checking for processing completion...`);
      processed = true;
      break;
    }
    await page.waitForTimeout(2000);
  }

  expect(processed).toBe(true);

  mkdirSync('/opt/cursor/artifacts/screenshots', { recursive: true });
  
  console.log('Taking screenshot: 02-project-versions.png');
  await page.screenshot({ 
    path: '/opt/cursor/artifacts/screenshots/02-project-versions.png',
    fullPage: true 
  });

  console.log('Opening latest version detail page...');
  await page.waitForTimeout(1000);
  
  const viewDetailsLinks = await page.locator('a:has-text("View Details")').all();
  expect(viewDetailsLinks.length).toBeGreaterThan(0);
  
  console.log(`Found ${viewDetailsLinks.length} version detail links, clicking the first one...`);
  await viewDetailsLinks[0].click();
  
  await page.waitForURL(/\/dashboard\/projects\/[^/]+\/versions\/[^/]+/, { timeout: 10000 });
  
  console.log('Looking for compare link...');
  await page.waitForTimeout(1000);
  
  const compareLinks = await page.locator('a:has-text("Compare with")').all();
  expect(compareLinks.length).toBeGreaterThan(0);
  
  console.log(`Found ${compareLinks.length} compare links, clicking the first one...`);
  await compareLinks[0].click();

  await page.waitForURL(/\/compare\//, { timeout: 10000 });

  console.log('Waiting for compare page to load...');
  await page.waitForTimeout(2000);

  const mismatchWarning = page.locator('text=/Claim or Metadata Mismatch|Changed Time Spans/i');
  const hasWarning = await mismatchWarning.isVisible().catch(() => false);
  
  if (hasWarning) {
    console.log('Mismatch warning detected, checking for acknowledge button...');
    const ackButton = page.locator('button:has-text("I Acknowledge")');
    const hasAckButton = await ackButton.isVisible().catch(() => false);
    if (hasAckButton) {
      console.log('Acknowledging mismatch...');
      await ackButton.click();
      await page.waitForTimeout(1000);
    }
  }

  const changedSpans = page.locator('text=/Changed Time Spans/i');
  await expect(changedSpans).toBeVisible({ timeout: 10000 });

  const spanText = await page.locator('text=/\\d+\\.\\d+s - \\d+\\.\\d+s/').first().textContent();
  console.log(`Found changed span: ${spanText}`);
  
  if (spanText) {
    const match = spanText.match(/([\d.]+)s\s*-\s*([\d.]+)s/);
    if (match) {
      const start = parseFloat(match[1]);
      const end = parseFloat(match[2]);
      console.log(`Changed span range: ${start}s to ${end}s`);
      
      expect(start).toBeGreaterThanOrEqual(3.0);
      expect(start).toBeLessThanOrEqual(5.0);
      expect(end).toBeGreaterThanOrEqual(5.0);
      expect(end).toBeLessThanOrEqual(7.0);
    }
  }

  console.log('Taking screenshot: 03-compare-mismatch.png');
  await page.screenshot({ 
    path: '/opt/cursor/artifacts/screenshots/03-compare-mismatch.png',
    fullPage: true 
  });

  console.log('Upload and compare workflow completed successfully');
});
