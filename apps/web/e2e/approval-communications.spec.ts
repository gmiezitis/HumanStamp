import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'net';
import { randomUUID } from 'crypto';
import { prisma } from '../src/lib/prisma';
import { createSessionToken } from '../src/lib/session';
import { processEmailOutbox } from '../src/lib/email-outbox';

let smtp: Server;
const captured: string[] = [];
let workspaceId: string;
let userId: string;

test.beforeAll(async () => {
  process.env.SMTP_HOST = '127.0.0.1';
  process.env.SMTP_PORT = '2525';
  process.env.SMTP_FROM = 'review@example.test';
  process.env.SMTP_SECURE = 'false';
  delete process.env.SMTP_USER;
  smtp = createServer((socket) => {
    socket.on('error', () => {});
    socket.write('220 localhost HumanStamp test SMTP\r\n');
    let buffer = '';
    let data = false;
    let message = '';
    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      let index: number;
      while ((index = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        if (data) {
          if (line === '.') {
            captured.push(message);
            message = '';
            data = false;
            socket.write('250 accepted\r\n');
          } else message += line + '\n';
        } else if (/^EHLO|^HELO/.test(line))
          socket.write('250-localhost\r\n250 SIZE 10485760\r\n');
        else if (/^DATA/.test(line)) {
          data = true;
          socket.write('354 Send data\r\n');
        } else if (/^QUIT/.test(line)) socket.end('221 bye\r\n');
        else socket.write('250 OK\r\n');
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    smtp.once('error', reject);
    smtp.listen(2525, '127.0.0.1', resolve);
  });
});
test.afterAll(async () => {
  if (workspaceId)
    await prisma.workspace.delete({ where: { id: workspaceId } });
  if (userId) await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
  if (smtp) await new Promise<void>((resolve) => smtp.close(() => resolve()));
});

test('real browser: invite, SMTP acceptance, decision, receipt and replacement', async ({
  page,
  context,
  browser,
}, testInfo) => {
  const ownerEmail = `agency-${randomUUID()}@example.test`;
  const user = await prisma.user.create({ data: { email: ownerEmail } });
  userId = user.id;
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Approval smoke test',
      memberships: { create: { userId, role: 'owner' } },
      clients: {
        create: {
          name: 'Smoke client',
          projects: { create: { name: 'Delivery approval' } },
        },
      },
    },
    include: { clients: { include: { projects: true } } },
  });
  workspaceId = workspace.id;
  const projectId = workspace.clients[0].projects[0].id;
  const version = await prisma.version.create({
    data: {
      projectId,
      versionNumber: 1,
      filename: 'campaign-v1.mp4',
      sha256: 'smoke-original-file',
      fileSize: 10,
      storageKey: 'smoke-no-media',
      aiClaim: 'ai-assisted',
    },
  });
  await context.addCookies([
    {
      name: 'humanstamp_session',
      value: createSessionToken(userId, ownerEmail),
      url: 'http://localhost:3100',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
  const detail = `/dashboard/projects/${projectId}/versions/${version.id}`;
  await page.goto(detail);
  await expect(page.getByText('Draft', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Generate Receipt' })
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Approve This Version' }).click();
  await page.getByPlaceholder('e.g. Alice Johnson').fill('Agency producer');
  await page.getByPlaceholder('e.g. Creative Director').fill('Producer');
  await page.getByPlaceholder('e.g. Demo Agency').fill('Smoke agency');
  await page.getByRole('button', { name: 'Submit Approval' }).click();
  await page.getByRole('button', { name: 'Create Client Sign-off' }).click();
  await page.getByPlaceholder('client@example.com').fill('client@example.test');
  await page.getByRole('button', { name: 'Create Sign-off Link' }).click();
  await expect(
    page.getByText('Sign-off Link Created', { exact: true })
  ).toBeVisible();
  const review = await prisma.clientSignOff.findFirstOrThrow({
    where: { versionId: version.id },
  });
  await processEmailOutbox();
  expect(captured).toHaveLength(1);
  expect(captured[0].replace(/=\n/g, '')).toContain(`/signoff/${review.token}`);
  await page.reload();
  await expect(
    page.getByText('Awaiting review', { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText(/Invitation:.*Accepted by email provider/)
  ).toBeVisible();

  const clientContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const clientPage = await clientContext.newPage();
  await clientPage.goto(`http://localhost:3100/signoff/${review.token}`);
  await expect(
    clientPage.getByText('campaign-v1.mp4', { exact: false })
  ).toBeVisible();
  await expect(
    clientPage.getByRole('button', { name: 'Submit decision' })
  ).toBeDisabled();
  await clientPage
    .getByLabel('Your name', { exact: true })
    .fill('Client reviewer');
  await clientPage.getByLabel('Approve this version', { exact: true }).check();
  await clientPage.screenshot({
    path: testInfo.outputPath('client-review-mobile.png'),
    fullPage: true,
  });
  await clientPage.getByRole('button', { name: 'Submit decision' }).click();
  await expect(
    clientPage.getByRole('heading', { name: 'Decision recorded' })
  ).toBeVisible();
  await processEmailOutbox();
  expect(captured).toHaveLength(2);
  expect(captured[1]).toContain(ownerEmail);
  expect(captured[1].replace(/=\n/g, '')).toContain('Client reviewer');
  await clientPage.reload();
  await expect(clientPage.getByText('Approved', { exact: true })).toBeVisible();
  await expect(
    clientPage.getByText(/agency notification was accepted/)
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText('Approved', { exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('agency-approved.png'),
    fullPage: true,
  });
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Generate Receipt' }).click();
  await page.waitForURL(/\/r\//);
  await expect(
    page.getByText('Valid signature', { exact: true })
  ).toBeVisible();
  const receiptUrl = page.url();

  // A replacement is a separate file, not an inherited approval.
  const replacement = await prisma.version.create({
    data: {
      projectId,
      versionNumber: 2,
      filename: 'campaign-v2.mp4',
      sha256: 'smoke-replacement-file',
      fileSize: 10,
      storageKey: 'smoke-new-media',
      aiClaim: 'ai-assisted',
    },
  });
  await page.goto(
    `/dashboard/projects/${projectId}/versions/${replacement.id}`
  );
  await expect(page.getByText('Draft', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Generate Receipt' })
  ).toBeDisabled();
  await clientPage.reload();
  await expect(clientPage.getByText(/newer file has replaced/)).toBeVisible();
  await expect(
    clientPage.getByText('campaign-v1.mp4', { exact: false })
  ).toBeVisible();
  await page.goto(receiptUrl);
  await expect(page.getByText('Superseded', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Valid signature', { exact: true })
  ).toBeVisible();
  await clientContext.close();
});
