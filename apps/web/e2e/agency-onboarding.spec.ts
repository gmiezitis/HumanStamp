import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { prisma } from '../src/lib/prisma';
import { createSessionToken } from '../src/lib/session';
import { getStorage } from '../src/lib/storage';

test('new agency reaches its first playable cut through one-form setup and a real upload', async ({
  page,
  context,
}, info) => {
  const email = `first-cut-${randomUUID()}@example.test`;
  const projectName = `Pilot ${randomUUID()}`;
  const user = await prisma.user.create({ data: { email } });
  let workspaceId = '';
  const keys: string[] = [];
  try {
    await context.addCookies([
      {
        name: 'humanstamp_session',
        value: createSessionToken(user.id, email),
        url: 'http://localhost:3100',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Start a handoff' }).click();
    await page.getByLabel('Agency name', { exact: true }).fill('Pilot agency');
    await page
      .getByLabel('New client name', { exact: true })
      .fill('Pilot brand');
    await page
      .getByLabel('Campaign or video name', { exact: true })
      .fill(projectName);
    const creation = page.waitForResponse((response) =>
      response.url().endsWith('/api/onboarding/project')
    );
    await page
      .getByRole('button', { name: 'Create project and upload cut' })
      .click();
    expect((await creation).status()).toBe(201);
    await page.waitForURL(/\/dashboard\/projects\//);
    const project = await prisma.project.findFirstOrThrow({
      where: { name: projectName },
      include: { client: true },
    });
    workspaceId = project.client.workspaceId;
    await page
      .getByLabel('Video File', { exact: true })
      .setInputFiles(join(__dirname, '../public/demo/agency-cut.mp4'));
    await expect(
      page.getByRole('button', { name: 'Upload Version', exact: true })
    ).toBeDisabled();
    await page
      .getByLabel('How was AI used in this cut?', { exact: true })
      .selectOption('human+ai');
    const upload = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/projects/${project.id}/versions`) &&
        response.request().method() === 'POST'
    );
    await page
      .getByRole('button', { name: 'Upload Version', exact: true })
      .click();
    expect((await upload).status()).toBe(200);
    const versions = await prisma.version.findMany({
      where: { projectId: project.id },
    });
    keys.push(...versions.map((version) => version.storageKey));
    await page.getByRole('link', { name: 'Open this cut' }).click();
    await page.waitForURL(/\/versions\//);
    const video = page.getByLabel('Preview agency-cut.mp4', { exact: true });
    await expect
      .poll(() =>
        video.evaluate((element) => (element as HTMLVideoElement).readyState)
      )
      .toBeGreaterThanOrEqual(1);
    await expect(page.getByText('Draft', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Generate Receipt' })
    ).toBeDisabled();
    await page.screenshot({
      path: info.outputPath('first-real-cut.png'),
      fullPage: true,
    });
    expect(
      await prisma.emailDelivery.count({
        where: { signOff: { projectId: project.id } },
      })
    ).toBe(0);
  } finally {
    // Recover cleanup targets even if a later assertion failed.
    const projects = await prisma.project.findMany({
      where: { name: projectName },
      include: { client: true, versions: true },
    });
    workspaceId ||= projects[0]?.client.workspaceId || '';
    for (const key of new Set([
      ...keys,
      ...projects.flatMap((project) =>
        project.versions.map((version) => version.storageKey)
      ),
    ]))
      await getStorage().delete(key);
    if (workspaceId)
      await prisma.workspace.delete({ where: { id: workspaceId } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
});
