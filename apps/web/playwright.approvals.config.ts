import { defineConfig, devices } from '@playwright/test';

// Dedicated smoke suite: no global video-generation dependency, no external mail.
export default defineConfig({
  testDir: './e2e',
  testMatch: [
    'approval-communications.spec.ts',
    'agency-value.spec.ts',
    'agency-onboarding.spec.ts',
  ],
  workers: 1,
  timeout: 60_000,
  use: {
    ...devices['Desktop Chrome'],
    channel: process.platform === 'darwin' ? 'chrome' : undefined,
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm exec next dev -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    env: {
      JWT_SECRET:
        process.env.JWT_SECRET || 'humanstamp-local-verification-only',
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: '2525',
      SMTP_FROM: 'review@example.test',
      NEXT_PUBLIC_BASE_URL: 'http://localhost:3100',
    },
  },
});
