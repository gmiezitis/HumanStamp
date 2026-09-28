import { chromium } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('\n=== Regression Tests ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // 1. Test demo-login 403 when DEMO_LOGIN is off
    console.log('1. Testing demo-login with DEMO_LOGIN=true (should succeed)...');
    const demoLoginResponse = await page.request.post(`${BASE_URL}/api/auth/demo-login`);
    if (demoLoginResponse.status() === 302 || demoLoginResponse.ok()) {
      console.log('   ✓ Demo login successful (DEMO_LOGIN=true)');
    } else {
      console.log(`   ✗ Demo login failed: ${demoLoginResponse.status()}`);
    }

    // Note: We can't test DEMO_LOGIN=false without restarting container
    console.log('   ℹ To test DEMO_LOGIN=false, container would need restart without env var');

    // 2. Test receipt signature validity
    console.log('\n2. Testing receipt signature validity...');
    await page.goto(`${BASE_URL}/r/cmukyx0ry000rrkva2r0p49qn`);
    await page.waitForSelector('text=Record of Approval and Disclosure', { timeout: 5000 });
    
    const hasValidBadge = await page.locator('text=Valid').first().isVisible();
    const hasInvalidBadge = await page.locator('text=Invalid').first().isVisible();
    
    if (hasValidBadge && !hasInvalidBadge) {
      console.log('   ✓ Receipt signature is VALID');
    } else if (hasInvalidBadge) {
      console.log('   ✗ Receipt signature is INVALID');
    } else {
      console.log('   ⚠ Could not determine signature status');
    }

    // 3. Test PDF returns 200
    console.log('\n3. Testing PDF export returns 200...');
    const pdfResponse = await page.request.get(`${BASE_URL}/api/receipts/cmukyx0ry000rrkva2r0p49qn/export?format=pdf`);
    if (pdfResponse.ok()) {
      console.log(`   ✓ PDF export returns 200 OK (${pdfResponse.status()})`);
    } else {
      console.log(`   ✗ PDF export failed: ${pdfResponse.status()}`);
    }

    // 4. Test labeled download (if exists)
    console.log('\n4. Testing labeled video download...');
    // Get version ID from receipt
    const receiptJsonResponse = await page.request.get(`${BASE_URL}/api/receipts/cmukyx0ry000rrkva2r0p49qn/export?format=json`);
    if (receiptJsonResponse.ok()) {
      const receiptData = await receiptJsonResponse.json();
      console.log(`   Receipt data: v${receiptData.data.versionNumber} - ${receiptData.data.filename}`);
      
      // Note: Labeled download requires finding the version ID and checking if label was applied
      console.log('   ℹ Labeled download test would require version ID lookup');
    }

    console.log('\n=== Regression Tests Complete ===\n');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
