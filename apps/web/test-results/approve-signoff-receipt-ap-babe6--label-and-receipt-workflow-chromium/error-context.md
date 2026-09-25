# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: approve-signoff-receipt.spec.ts >> approve, signoff, label, and receipt workflow
- Location: e2e/approve-signoff-receipt.spec.ts:5:5

# Error details

```
TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
=========================== logs ===========================
waiting for navigation to "/dashboard" until "load"
  navigated to "http://localhost:3000/api/auth/test-login"
============================================================
```

# Page snapshot

```yaml
- generic [active]:
  - alert [ref=e1]
  - dialog [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - heading "Build Error" [level=1] [ref=e7]
        - paragraph [ref=e8]: Failed to compile
        - generic [ref=e9]:
          - text: Next.js (14.2.35) is outdated
          - link "(learn more)" [ref=e11] [cursor=pointer]:
            - /url: https://nextjs.org/docs/messages/version-staleness
      - generic [ref=e12]:
        - generic [ref=e13]:
          - link "./src/lib/keys.ts:1:1" [ref=e14] [cursor=pointer]
          - generic [ref=e19]:
            - generic [ref=e20]: "Module not found: Can't resolve '@human-stamp/core'"
            - text: ">"
            - generic [ref=e21]: 1 |
            - text: import
            - generic [ref=e22]: "{ generateKeyPair }"
            - text: from '@human-stamp/core';
            - generic [ref=e23]: "|"
            - text: ^
            - generic [ref=e24]: 2 |
            - generic [ref=e25]: 3 |
            - text: let
            - generic [ref=e26]: devPrivateKey
            - text: ":"
            - generic [ref=e27]: string
            - text: "| null = null;"
            - generic [ref=e28]: 4 |
            - text: let
            - generic [ref=e29]: devPublicKey
            - text: ":"
            - generic [ref=e30]: string
            - text: "| null = null;"
            - generic [ref=e31]:
              - link "https://nextjs.org/docs/messages/module-not-found" [ref=e32] [cursor=pointer]:
                - /url: https://nextjs.org/docs/messages/module-not-found
              - text: "Import trace for requested module:"
            - link "./src/lib/receipt.ts" [ref=e33] [cursor=pointer]
            - link "./src/app/api/versions/[versionId]/receipt/route.ts" [ref=e38] [cursor=pointer]
        - contentinfo [ref=e43]:
          - paragraph [ref=e44]: This error occurred during the build process and can only be dismissed by fixing the error.
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { readFileSync, mkdirSync } from 'fs';
  3   | import { join } from 'path';
  4   | 
  5   | test('approve, signoff, label, and receipt workflow', async ({ page, context }) => {
  6   |   const testVideosDir = join(__dirname, 'test-videos');
  7   |   const v2Path = join(testVideosDir, 'v2.mp4');
  8   | 
  9   |   const timestamp = Date.now();
  10  |   const projectName = `E2E Run ${timestamp}`;
  11  | 
  12  |   console.log('Step 1: Login and navigate to project');
  13  |   await page.goto('/api/auth/test-login');
> 14  |   await page.waitForURL('/dashboard', { timeout: 10000 });
      |              ^ TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
  15  | 
  16  |   await page.goto('/dashboard');
  17  |   
  18  |   const workspaceLink = page.locator('a:has-text("Demo Agency")').first();
  19  |   await expect(workspaceLink).toBeVisible();
  20  |   await workspaceLink.click();
  21  |   
  22  |   await page.waitForURL(/\/dashboard\/workspaces\/[^/]+/, { timeout: 10000 });
  23  |   
  24  |   console.log('Step 2: Navigate to client');
  25  |   const clientLink = page.locator('a:has-text("Euronics-like Brand")').first();
  26  |   await expect(clientLink).toBeVisible();
  27  |   await clientLink.click();
  28  |   
  29  |   await page.waitForURL(/\/dashboard\/clients\/[^/]+/, { timeout: 10000 });
  30  |   
  31  |   console.log('Step 3: Navigate to existing project');
  32  |   const projectLink = page.locator('a:has-text("Autumn Campaign")').first();
  33  |   await expect(projectLink).toBeVisible();
  34  |   await projectLink.click();
  35  |   
  36  |   await page.waitForURL(/\/dashboard\/projects\/[^/]+/, { timeout: 10000 });
  37  |   
  38  |   const projectUrl = page.url();
  39  |   const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1];
  40  |   console.log(`Using project: Autumn Campaign (${projectId})`);
  41  | 
  42  |   console.log('Step 4: Upload test video');
  43  |   const fileInput = page.locator('input[type="file"]');
  44  |   await fileInput.setInputFiles(v2Path);
  45  |   
  46  |   const uploadButton = page.locator('button:has-text("Upload Version")');
  47  |   await uploadButton.click();
  48  | 
  49  |   console.log('Step 5: Wait for processing');
  50  |   await page.waitForTimeout(2000);
  51  |   
  52  |   let processed = false;
  53  |   for (let i = 0; i < 30; i++) {
  54  |     await page.reload();
  55  |     const viewDetailsLinks = await page.locator('a:has-text("View Details")').count();
  56  |     if (viewDetailsLinks >= 1) {
  57  |       console.log(`Found version, checking for processing completion...`);
  58  |       processed = true;
  59  |       break;
  60  |     }
  61  |     await page.waitForTimeout(2000);
  62  |   }
  63  | 
  64  |   expect(processed).toBe(true);
  65  | 
  66  |   console.log('Step 6: Open version detail page');
  67  |   const viewDetailsLinks = await page.locator('a:has-text("View Details")').all();
  68  |   await viewDetailsLinks[0].click();
  69  |   
  70  |   await page.waitForURL(/\/dashboard\/projects\/[^/]+\/versions\/[^/]+/, { timeout: 10000 });
  71  |   
  72  |   const versionUrl = page.url();
  73  |   const versionId = versionUrl.match(/\/versions\/([^/]+)/)?.[1];
  74  |   console.log(`Version ID: ${versionId}`);
  75  | 
  76  |   console.log('Step 7: Submit internal approval');
  77  |   const approveButton = page.locator('button:has-text("Approve This Version")');
  78  |   await expect(approveButton).toBeVisible();
  79  |   await approveButton.click();
  80  | 
  81  |   await page.fill('input[placeholder*="Alice Johnson"]', 'John Smith');
  82  |   await page.fill('input[placeholder*="Creative Director"]', 'Senior Producer');
  83  |   await page.fill('input[placeholder*="Demo Agency"]', 'Test Agency');
  84  |   
  85  |   const submitApprovalBtn = page.locator('button:has-text("Submit Approval")');
  86  |   await submitApprovalBtn.click();
  87  | 
  88  |   console.log('Step 8: Verify approval appears');
  89  |   await page.waitForTimeout(1000);
  90  |   await page.reload();
  91  |   
  92  |   const approvalText = page.locator('text=/John Smith.*Senior Producer.*Test Agency/i');
  93  |   await expect(approvalText).toBeVisible({ timeout: 5000 });
  94  | 
  95  |   console.log('Step 9: Create client sign-off link');
  96  |   const createSignOffBtn = page.locator('button:has-text("Create Client Sign-off")');
  97  |   await expect(createSignOffBtn).toBeVisible();
  98  |   await createSignOffBtn.click();
  99  | 
  100 |   await page.fill('input[type="email"]', 'client@test.com');
  101 |   
  102 |   const createLinkBtn = page.locator('button:has-text("Create Sign-off Link")');
  103 |   await createLinkBtn.click();
  104 | 
  105 |   await page.waitForTimeout(1000);
  106 | 
  107 |   const signOffLink = await page.locator('.font-mono.text-xs.break-all').textContent();
  108 |   expect(signOffLink).toBeTruthy();
  109 |   console.log(`Sign-off link: ${signOffLink}`);
  110 | 
  111 |   const signOffToken = signOffLink!.split('/signoff/')[1];
  112 | 
  113 |   console.log('Step 10: Open sign-off in new context (not logged in)');
  114 |   const newPage = await context.newPage();
```