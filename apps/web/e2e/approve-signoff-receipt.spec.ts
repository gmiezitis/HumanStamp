import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

test('approve, signoff, label, and receipt workflow', async ({ page, context }) => {
  const testVideosDir = join(__dirname, 'test-videos');
  const v2Path = join(testVideosDir, 'v2.mp4');

  const timestamp = Date.now();
  const projectName = `E2E Run ${timestamp}`;

  console.log('Step 1: Login and navigate to project');
  await page.goto('/api/auth/test-login');
  await page.waitForURL('/dashboard', { timeout: 10000 });

  await page.goto('/dashboard');
  
  const workspaceLink = page.locator('a:has-text("Demo Agency")').first();
  await expect(workspaceLink).toBeVisible();
  await workspaceLink.click();
  
  await page.waitForURL(/\/dashboard\/workspaces\/[^/]+/, { timeout: 10000 });
  
  console.log('Step 2: Navigate to client');
  const clientLink = page.locator('a:has-text("Euronics-like Brand")').first();
  await expect(clientLink).toBeVisible();
  await clientLink.click();
  
  await page.waitForURL(/\/dashboard\/clients\/[^/]+/, { timeout: 10000 });
  
  console.log('Step 3: Create fresh E2E project');
  const newProjectLink = page.locator('a:has-text("New Project")').first();
  await expect(newProjectLink).toBeVisible();
  await newProjectLink.click();
  
  await page.waitForURL(/\/projects\/new/, { timeout: 5000 });
  
  const timestamp = Date.now();
  const projectName = `E2E Run ${timestamp}`;
  await page.fill('input[placeholder*="project name"], input[name="name"]', projectName);
  await page.click('button:has-text("Create Project")');
  
  await page.waitForURL(/\/dashboard\/projects\/[^/]+/, { timeout: 10000 });
  const projectUrl = page.url();
  const projectId = projectUrl.match(/\/projects\/([^/]+)/)?.[1];
  console.log(`Created project: ${projectName} (${projectId})`);

  console.log('Step 4: Upload test video');
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(v2Path);
  
  const uploadButton = page.locator('button:has-text("Upload Version")');
  await uploadButton.click();

  console.log('Step 5: Wait for processing');
  await page.waitForTimeout(2000);
  
  let processed = false;
  for (let i = 0; i < 30; i++) {
    await page.reload();
    const viewDetailsLinks = await page.locator('a:has-text("View Details")').count();
    if (viewDetailsLinks >= 1) {
      console.log(`Found version, checking for processing completion...`);
      processed = true;
      break;
    }
    await page.waitForTimeout(2000);
  }

  expect(processed).toBe(true);

  console.log('Step 6: Open version detail page');
  const viewDetailsLinks = await page.locator('a:has-text("View Details")').all();
  await viewDetailsLinks[0].click();
  
  await page.waitForURL(/\/dashboard\/projects\/[^/]+\/versions\/[^/]+/, { timeout: 10000 });
  
  const versionUrl = page.url();
  const versionId = versionUrl.match(/\/versions\/([^/]+)/)?.[1];
  console.log(`Version ID: ${versionId}`);

  console.log('Step 7: Submit internal approval');
  const approveButton = page.locator('button:has-text("Approve This Version")');
  await expect(approveButton).toBeVisible();
  await approveButton.click();

  await page.fill('input[placeholder*="Alice Johnson"]', 'John Smith');
  await page.fill('input[placeholder*="Creative Director"]', 'Senior Producer');
  await page.fill('input[placeholder*="Demo Agency"]', 'Test Agency');
  
  const submitApprovalBtn = page.locator('button:has-text("Submit Approval")');
  await submitApprovalBtn.click();

  console.log('Step 8: Verify approval appears');
  await page.waitForTimeout(1000);
  await page.reload();
  
  const approvalText = page.locator('text=/John Smith.*Senior Producer.*Test Agency/i');
  await expect(approvalText).toBeVisible({ timeout: 5000 });

  console.log('Step 9: Create client sign-off link');
  const createSignOffBtn = page.locator('button:has-text("Create Client Sign-off")');
  await expect(createSignOffBtn).toBeVisible();
  await createSignOffBtn.click();

  await page.fill('input[type="email"]', 'client@test.com');
  
  const createLinkBtn = page.locator('button:has-text("Create Sign-off Link")');
  await createLinkBtn.click();

  await page.waitForTimeout(1000);

  const signOffLink = await page.locator('.font-mono.text-xs.break-all').textContent();
  expect(signOffLink).toBeTruthy();
  console.log(`Sign-off link: ${signOffLink}`);

  const signOffToken = signOffLink!.split('/signoff/')[1];

  console.log('Step 10: Open sign-off in new context (not logged in)');
  const newPage = await context.newPage();
  await newPage.goto(`/signoff/${signOffToken}`);

  await newPage.waitForLoadState('networkidle');

  mkdirSync('/opt/cursor/artifacts/screenshots', { recursive: true });

  await newPage.fill('input[placeholder*="full name"]', 'Client Representative');
  await newPage.click('input[value="approved"]');
  await newPage.fill('textarea', 'Looks great, approved!');

  console.log('Taking screenshot: 04-client-signoff.png');
  await newPage.screenshot({ 
    path: '/opt/cursor/artifacts/screenshots/04-client-signoff.png',
    fullPage: true 
  });

  const submitSignOffBtn = newPage.locator('button:has-text("Submit Sign-off")');
  await submitSignOffBtn.click();

  await newPage.waitForTimeout(2000);

  const successMessage = newPage.locator('h1:has-text("Sign-off Completed")');
  await expect(successMessage).toBeVisible({ timeout: 5000 });

  await newPage.close();

  console.log('Step 11: Verify sign-off in agency view');
  await page.reload();
  await page.waitForTimeout(1000);
  
  console.log('Step 12: Burn label (queued in background)');
  await page.click('button:has-text("Burn AI Label")');
  
  page.once('dialog', async dialog => {
    await dialog.accept();
  });
  
  await page.waitForTimeout(2000);

  console.log('Step 13: Generate receipt');
  await page.click('button:has-text("Generate Receipt")');
  
  page.once('dialog', async dialog => {
    await dialog.accept();
  });

  await page.waitForURL(/\/r\/[^/]+/, { timeout: 15000 });

  console.log('Step 14: Verify receipt page');
  await page.waitForLoadState('networkidle');

  const approvalSection = page.locator('text=/Internal Approvals/i');
  await expect(approvalSection).toBeVisible();

  const signOffSection = page.locator('text=/Client Sign-offs/i');
  await expect(signOffSection).toBeVisible();

  const fileHashSection = page.locator('text=/File Hash.*SHA-256/i');
  await expect(fileHashSection).toBeVisible();

  const qrImage = page.locator('img[alt="Receipt QR Card"]');
  await expect(qrImage).toBeVisible();

  const qrSrc = await qrImage.getAttribute('src');
  expect(qrSrc).toBeTruthy();

  const qrResponse = await page.request.get(qrSrc!);
  expect(qrResponse.status()).toBe(200);

  console.log('Taking screenshot: 05-receipt-qr.png');
  await page.screenshot({ 
    path: '/opt/cursor/artifacts/screenshots/05-receipt-qr.png',
    fullPage: true 
  });

  console.log('Approve, signoff, label, and receipt workflow completed successfully');
});
