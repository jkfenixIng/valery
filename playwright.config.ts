import { defineConfig } from '@playwright/test';

const requiredEnvironment = [
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'BETTER_AUTH_URL',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
];

if (requiredEnvironment.some((name) => !process.env[name])) {
  throw new Error(`test:e2e requires ${requiredEnvironment.join(', ')}.`);
}

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: process.env.BETTER_AUTH_URL },
  webServer: {
    command: 'corepack pnpm dev',
    reuseExistingServer: false,
    url: process.env.BETTER_AUTH_URL,
  },
});
