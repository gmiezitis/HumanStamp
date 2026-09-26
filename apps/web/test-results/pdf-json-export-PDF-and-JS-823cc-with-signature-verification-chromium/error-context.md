# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: pdf-json-export.spec.ts >> PDF and JSON export with signature verification
- Location: e2e/pdf-json-export.spec.ts:5:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('a:has-text("Euronics-like Brand")')

```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - generic [ref=f1e2]:
    - banner [ref=f1e3]:
      - generic [ref=f1e4]:
        - heading "Human Stamp" [level=1] [ref=f1e5]
        - generic [ref=f1e6]:
          - generic [ref=f1e7]: demo@humanstamp.test
          - button "Sign out" [ref=f1e9] [cursor=pointer]
    - main [ref=f1e10]:
      - generic [ref=f1e11]:
        - heading "Workspaces" [level=2] [ref=f1e12]
        - link "New Workspace" [ref=f1e13] [cursor=pointer]:
          - /url: /dashboard/workspaces/new
      - link [ref=f1e15] [cursor=pointer]:
        - /url: /dashboard/workspaces/cmuhjg4oc00011b9hqrec0rm2
        - heading "Demo Agency" [level=3] [ref=f1e16]
        - paragraph [ref=f1e17]: "Role: owner"
  - alert [ref=f1e18]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
  3  | import { execSync } from 'child_process';
  4  | 
  5  | test('PDF and JSON export with signature verification', async ({ page, request }) => {
  6  |   console.log('Step 1: Login and generate receipt for seeded Autumn Campaign v2');
  7  |   
  8  |   await page.goto('/api/auth/test-login');
  9  |   await page.waitForURL('/dashboard', { timeout: 10000 });
  10 |   
  11 |   await page.goto('/dashboard');
> 12 |   await page.click('a:has-text("Euronics-like Brand")');
     |              ^ Error: page.click: Test timeout of 30000ms exceeded.
  13 |   await page.waitForTimeout(1000);
  14 |   await page.click('a:has-text("Autumn Campaign")');
  15 |   await page.waitForURL(/\/projects\//, { timeout: 10000 });
  16 |   
  17 |   const viewDetailsLinks = await page.locator('a:has-text("View Details")').all();
  18 |   if (viewDetailsLinks.length > 1) {
  19 |     await viewDetailsLinks[1].click();  // v2
  20 |   } else {
  21 |     await viewDetailsLinks[0].click();
  22 |   }
  23 |   await page.waitForTimeout(1000);
  24 |   
  25 |   await page.click('button:has-text("Generate Receipt")');
  26 |   page.once('dialog', dialog => dialog.accept());
  27 |   await page.waitForURL(/\/r\//, { timeout: 15000 });
  28 |   
  29 |   const url = page.url();
  30 |   const receiptId = url.match(/\/r\/([^/]+)/)?.[1];
  31 |   console.log(`Receipt generated: ${receiptId}`);
  32 |   
  33 |   console.log('Step 2: Download JSON export');
  34 |   const jsonResponse = await request.get(`http://localhost:3000/api/receipts/${receiptId}/export?format=json`);
  35 |   expect(jsonResponse.ok()).toBeTruthy();
  36 |   
  37 |   const jsonData = await jsonResponse.json();
  38 |   const jsonSize = JSON.stringify(jsonData).length;
  39 |   console.log(`JSON export size: ${jsonSize} bytes`);
  40 |   expect(jsonSize).toBeGreaterThan(0);
  41 |   
  42 |   mkdirSync('/tmp/export-test', { recursive: true });
  43 |   writeFileSync('/tmp/export-test/receipt.json', JSON.stringify(jsonData, null, 2));
  44 |   
  45 |   console.log('Step 3: Verify JSON signature against published public key');
  46 |   const keysResponse = await request.get('http://localhost:3000/.well-known/humanstamp-keys');
  47 |   expect(keysResponse.ok()).toBeTruthy();
  48 |   
  49 |   const keysData = await keysResponse.json();
  50 |   console.log(`Found ${keysData.keys.length} public keys`);
  51 |   
  52 |   const matchingKey = keysData.keys.find((k: any) => k.keyId === jsonData.keyId);
  53 |   expect(matchingKey).toBeTruthy();
  54 |   console.log(`Matching key found: ${matchingKey.keyId}`);
  55 |   
  56 |   const { verify } = require('@human-stamp/core');
  57 |   const payloadStr = JSON.stringify(jsonData.data);
  58 |   const isValid = await verify(payloadStr, jsonData.signature, matchingKey.publicKey);
  59 |   
  60 |   expect(isValid).toBe(true);
  61 |   console.log('✓ Signature verified successfully');
  62 |   
  63 |   console.log('Step 4: Download PDF export');
  64 |   const pdfResponse = await request.get(`http://localhost:3000/api/receipts/${receiptId}/export?format=pdf`);
  65 |   expect(pdfResponse.ok()).toBeTruthy();
  66 |   
  67 |   const pdfBuffer = await pdfResponse.body();
  68 |   const pdfSize = pdfBuffer?.length || 0;
  69 |   console.log(`PDF export size: ${pdfSize} bytes`);
  70 |   expect(pdfSize).toBeGreaterThan(0);
  71 |   
  72 |   writeFileSync('/tmp/export-test/receipt.pdf', pdfBuffer!);
  73 |   
  74 |   console.log('Step 5: Render PDF page 1 as PNG');
  75 |   mkdirSync('/opt/cursor/artifacts/screenshots', { recursive: true });
  76 |   
  77 |   execSync(`pdftoppm -png -f 1 -l 1 -scale-to 800 /tmp/export-test/receipt.pdf /tmp/export-test/page 2>/dev/null`);
  78 |   
  79 |   if (existsSync('/tmp/export-test/page-1.png')) {
  80 |     execSync(`cp /tmp/export-test/page-1.png /opt/cursor/artifacts/screenshots/07-pdf-page1.png`);
  81 |     console.log('PDF page 1 rendered to 07-pdf-page1.png');
  82 |   }
  83 |   
  84 |   console.log('PDF and JSON export test completed successfully');
  85 | });
  86 | 
```