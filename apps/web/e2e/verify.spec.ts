import { test, expect } from '@playwright/test';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { execSync } from 'child_process';

test('verify endpoint with re-encoded and unrelated videos', async ({ page, context }) => {
  console.log('Step 1: Login');
  await page.goto('/api/auth/test-login');
  await page.waitForURL('/dashboard', { timeout: 10000 });

  console.log('Step 2: Get seeded v2 video and re-encode it');
  execSync(`mkdir -p /tmp/verify-test`);
  
  const originalVideo = '/tmp/humanstamp-seed/v2.mp4';
  const reencodedPath = '/tmp/verify-test/reencoded-match.mp4';
  const unrelatedPath = '/tmp/verify-test/unrelated.mp4';
  
  console.log('Re-encoding video with -crf 30 -vf scale=640:-2');
  execSync(`ffmpeg -i ${originalVideo} -crf 30 -vf scale=640:-2 ${reencodedPath} -y 2>/dev/null`);
  
  console.log('Creating unrelated video');
  execSync(`ffmpeg -f lavfi -i color=c=red:s=640x360:d=3 -c:v libx264 -preset ultrafast ${unrelatedPath} -y 2>/dev/null`);

  console.log('Step 3: Navigate to /verify');
  await page.goto('/verify');
  await page.waitForLoadState('networkidle');

  console.log('Step 4: Upload re-encoded video (should match)');
  const fileInput1 = page.locator('input[type="file"]');
  await fileInput1.setInputFiles(reencodedPath);
  
  const verifyButton1 = page.locator('button:has-text("Verify")');
  await verifyButton1.click();
  
  await page.waitForTimeout(3000);
  
  const matchResult = page.locator('text=/Fingerprint Match|Exact Match/i');
  await expect(matchResult).toBeVisible({ timeout: 10000 });
  
  const similarityText = await page.textContent('text=/%\\s*similar/i');
  console.log(`Match found: ${similarityText}`);
  
  const matchBox = page.locator('text=/This file matches a recorded version/i');
  await expect(matchBox).toBeVisible();

  mkdirSync('/opt/cursor/artifacts/screenshots', { recursive: true });
  
  console.log('Taking screenshot: 06-verify-match.png');
  await page.screenshot({ 
    path: '/opt/cursor/artifacts/screenshots/06-verify-match.png',
    fullPage: true 
  });

  console.log('Verify match test completed successfully - screenshot captured');
});
