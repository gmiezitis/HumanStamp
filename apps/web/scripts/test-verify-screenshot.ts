import { chromium } from '@playwright/test';
import { readFileSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testVerifyPage() {
  // Generate a test video that matches v2
  console.log('Generating test video...');
  await execAsync(`ffmpeg -y -f lavfi -i color=c=blue:s=1280x720:d=5 \
    -vf "drawtext=text='Version 2 - Edited':fontsize=60:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2" \
    -c:v libx264 -preset ultrafast -pix_fmt yuv420p /tmp/test-match.mp4`);
  
  // Re-encode it to change the hash but keep fingerprint similar
  await execAsync(`ffmpeg -y -i /tmp/test-match.mp4 -c:v libx264 -crf 28 -preset fast /tmp/test-match-reencoded.mp4`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:3000/verify');
  await page.waitForLoadState('networkidle');

  const fileInput = await page.locator('input[type="file"]');
  await fileInput.setInputFiles('/tmp/test-match-reencoded.mp4');

  await page.click('button[type="submit"]');
  
  // Wait for result
  await page.waitForSelector('text=/Match Found|No Match/', { timeout: 30000 });
  await page.waitForTimeout(1000);

  await page.screenshot({ path: '/opt/cursor/artifacts/06-verify-match.png', fullPage: true });

  console.log('Screenshot saved to /opt/cursor/artifacts/06-verify-match.png');

  await browser.close();
}

testVerifyPage().catch(console.error);
