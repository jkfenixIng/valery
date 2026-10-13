import { defineConfig } from '@playwright/test';

import { config, requireEndToEndConfig } from './src/config/env';

const { baseUrl } = requireEndToEndConfig(config);

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: baseUrl },
  webServer: {
    command: 'corepack pnpm dev',
    reuseExistingServer: false,
    url: baseUrl,
  },
});
