import { defineConfig } from '@playwright/test';
import { scryptSync } from 'node:crypto';
const hash = `scrypt:test-salt:${scryptSync('e2e-only-password', 'test-salt', 64).toString('hex')}`;
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120000,
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3101',
    channel: process.env.BROWSER_CHANNEL || (process.platform === 'win32' ? 'chrome' : undefined),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `"${process.execPath}" --experimental-sqlite --import tsx server/index.ts`,
    url: 'http://localhost:3101/api/health',
    reuseExistingServer: false,
    env: {
      PORT: '3101',
      HOST: '127.0.0.1',
      NODE_ENV: 'development',
      APP_ORIGIN: 'http://localhost:3101',
      DATABASE_URL: 'sqlite:./data/e2e.db',
      ADMIN_USERNAME: 'e2e-operator',
      ADMIN_PASSWORD_HASH: hash,
      SESSION_SECRET: 'e2e-only-session-secret-32-characters',
    },
  },
});
