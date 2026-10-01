import { test, expect } from '@playwright/test';
import { readFile } from 'fs/promises';

test('anonymous agency can understand and try the handoff without account or API writes', async ({
  page,
}, info) => {
  const writes: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET' && request.method() !== 'HEAD')
      writes.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Ship the exact cut your client approved.'
  );
  await page.screenshot({ path: info.outputPath('agency-hero-desktop.png') });
  await page.screenshot({
    path: info.outputPath('agency-home-desktop.png'),
    fullPage: true,
  });
  await page.getByRole('link', { name: 'Try the approval example' }).click();
  const demo = page.locator('#example');
  const video = demo.getByLabel('Play the original HumanStamp sample video');
  await expect
    .poll(() =>
      video.evaluate((element) => (element as HTMLVideoElement).readyState)
    )
    .toBeGreaterThanOrEqual(1);
  await video.evaluate((element) => (element as HTMLVideoElement).play());
  await expect
    .poll(() =>
      video.evaluate((element) => (element as HTMLVideoElement).currentTime)
    )
    .toBeGreaterThan(0);
  await video.evaluate((element) => (element as HTMLVideoElement).pause());
  await demo
    .getByRole('button', { name: 'Approve this cut', exact: true })
    .click();
  await expect(demo.getByText('Approved', { exact: true })).toBeVisible();
  await demo.getByRole('button', { name: 'Open handoff record' }).click();
  await expect(
    demo.getByText('Unsigned example', { exact: true })
  ).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await demo.getByRole('button', { name: 'Download example record' }).click();
  const download = await downloadPromise;
  const file = await download.path();
  expect(JSON.parse(await readFile(file!, 'utf8'))).toMatchObject({
    example: true,
    signed: false,
    version: 1,
  });
  await demo.getByRole('button', { name: 'Try a replacement cut' }).click();
  await expect(demo.getByText('Draft', { exact: true })).toBeVisible();
  await expect(
    demo.getByText('spring-campaign-v2.mp4', { exact: true })
  ).toBeVisible();
  await expect(
    demo.getByRole('button', { name: 'Download example record' })
  ).toHaveCount(0);
  await demo.getByRole('button', { name: 'Start a fresh review' }).click();
  await demo
    .getByRole('button', { name: 'Request changes', exact: true })
    .click();
  await expect(
    demo.getByRole('heading', { name: 'The revision is not approved.' })
  ).toBeVisible();
  expect(writes).toEqual([]);
  await demo.getByRole('button', { name: 'Reset example' }).click();
  await expect(
    demo.getByText('Awaiting review', { exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Agency sign in' })
  ).toHaveAttribute('href', '/auth/signin');
});

test('mobile demo is readable, keyboard-operable and has no horizontal overflow', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath('agency-home-mobile.png'),
    fullPage: true,
  });
  await page.getByRole('link', { name: 'Try the approval example' }).click();
  const button = page.getByRole('button', {
    name: 'Approve this cut',
    exact: true,
  });
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.locator('#example').getByText('Approved', { exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Open handoff record' }).click();
  await page.screenshot({
    path: info.outputPath('agency-demo-mobile.png'),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
});
