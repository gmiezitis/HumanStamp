import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { execSync } from 'child_process';

test('PDF and JSON export with signature verification', async ({ page, request }) => {
  console.log('Step 1: Login and generate receipt for seeded Autumn Campaign v2');
  
  await page.goto('/api/auth/test-login');
  await page.waitForURL('/dashboard', { timeout: 10000 });
  
  await page.goto('/dashboard');
  await page.click('a:has-text("Euronics-like Brand")');
  await page.waitForTimeout(1000);
  await page.click('a:has-text("Autumn Campaign")');
  await page.waitForURL(/\/projects\//, { timeout: 10000 });
  
  const viewDetailsLinks = await page.locator('a:has-text("View Details")').all();
  if (viewDetailsLinks.length > 1) {
    await viewDetailsLinks[1].click();  // v2
  } else {
    await viewDetailsLinks[0].click();
  }
  await page.waitForTimeout(1000);
  
  await page.click('button:has-text("Generate Receipt")');
  page.once('dialog', dialog => dialog.accept());
  await page.waitForURL(/\/r\//, { timeout: 15000 });
  
  const url = page.url();
  const receiptId = url.match(/\/r\/([^/]+)/)?.[1];
  console.log(`Receipt generated: ${receiptId}`);
  
  console.log('Step 2: Download JSON export');
  const jsonResponse = await request.get(`http://localhost:3000/api/receipts/${receiptId}/export?format=json`);
  expect(jsonResponse.ok()).toBeTruthy();
  
  const jsonData = await jsonResponse.json();
  const jsonSize = JSON.stringify(jsonData).length;
  console.log(`JSON export size: ${jsonSize} bytes`);
  expect(jsonSize).toBeGreaterThan(0);
  
  mkdirSync('/tmp/export-test', { recursive: true });
  writeFileSync('/tmp/export-test/receipt.json', JSON.stringify(jsonData, null, 2));
  
  console.log('Step 3: Verify JSON signature against published public key');
  const keysResponse = await request.get('http://localhost:3000/.well-known/humanstamp-keys');
  expect(keysResponse.ok()).toBeTruthy();
  
  const keysData = await keysResponse.json();
  console.log(`Found ${keysData.keys.length} public keys`);
  
  const matchingKey = keysData.keys.find((k: any) => k.keyId === jsonData.keyId);
  expect(matchingKey).toBeTruthy();
  console.log(`Matching key found: ${matchingKey.keyId}`);
  
  const { verify } = require('@human-stamp/core');
  const payloadStr = JSON.stringify(jsonData.data);
  const isValid = await verify(payloadStr, jsonData.signature, matchingKey.publicKey);
  
  expect(isValid).toBe(true);
  console.log('✓ Signature verified successfully');
  
  console.log('Step 4: Download PDF export');
  const pdfResponse = await request.get(`http://localhost:3000/api/receipts/${receiptId}/export?format=pdf`);
  expect(pdfResponse.ok()).toBeTruthy();
  
  const pdfBuffer = await pdfResponse.body();
  const pdfSize = pdfBuffer?.length || 0;
  console.log(`PDF export size: ${pdfSize} bytes`);
  expect(pdfSize).toBeGreaterThan(0);
  
  writeFileSync('/tmp/export-test/receipt.pdf', pdfBuffer!);
  
  console.log('Step 5: Render PDF page 1 as PNG');
  mkdirSync('/opt/cursor/artifacts/screenshots', { recursive: true });
  
  execSync(`pdftoppm -png -f 1 -l 1 -scale-to 800 /tmp/export-test/receipt.pdf /tmp/export-test/page 2>/dev/null`);
  
  if (existsSync('/tmp/export-test/page-1.png')) {
    execSync(`cp /tmp/export-test/page-1.png /opt/cursor/artifacts/screenshots/07-pdf-page1.png`);
    console.log('PDF page 1 rendered to 07-pdf-page1.png');
  }
  
  console.log('PDF and JSON export test completed successfully');
});
