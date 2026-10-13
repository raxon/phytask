import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:3001', trace: 'retain-on-failure' },
  reporter: 'list',
  webServer: {
    command: 'node apps/api/dist/index.js',
    url: 'http://127.0.0.1:3001',
    env: { REP_COUNTER_PORT: '3001', REP_COUNTER_DB: ':memory:' },
    reuseExistingServer: false,
  },
});
