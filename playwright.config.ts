import { defineConfig } from '@playwright/test';

// Expects a ledger API (ledgerd or ledger-nest) at LEDGER_API_URL.
// The console itself is built and started by Playwright.
const PORT = 3100;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: process.env.PW_CHANNEL, // e.g. "chrome" to use a locally installed browser
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `PORT=${PORT} HOSTNAME=127.0.0.1 node .next/standalone/server.js`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: { LEDGER_API_URL: process.env.LEDGER_API_URL ?? 'http://127.0.0.1:8080' },
  },
});
