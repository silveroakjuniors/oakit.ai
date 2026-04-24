import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 45000,
  retries: 1,
  workers: 1,
  fullyParallel: false,

  reporter: [
    // ── 1. Rich HTML report — opens in browser, full navigation ──
    ['html', {
      outputFolder: 'playwright-report',
      open: 'never',
      host: 'localhost',
      port: 9323,
    }],
    // ── 2. Console output while running ──
    ['list'],
    // ── 3. JSON — used by our custom summary generator ──
    ['json', { outputFile: 'playwright-report/results.json' }],
    // ── 4. JUnit XML — for CI integration ──
    ['junit', { outputFile: 'playwright-report/results.xml' }],
  ],

  use: {
    baseURL: 'http://localhost:3000',
    channel: 'chrome',
    launchOptions: {
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: false,
    },
    viewport: { width: 1280, height: 800 },
    // Screenshot on EVERY test (pass + fail) — visible in HTML report
    screenshot: 'on',
    // Video only on failure — saves disk space
    video: 'retain-on-failure',
    // Full trace only on failure — timeline + network + DOM snapshots
    trace: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 20000,
  },

  outputDir: 'test-results',

  projects: [
    // ── REGRESSION ────────────────────────────────────────────
    { name: 'Regression:Admin',     testMatch: '**/e2e/admin.spec.ts' },
    { name: 'Regression:Principal', testMatch: '**/e2e/principal.spec.ts' },
    { name: 'Regression:Teacher',   testMatch: '**/e2e/teacher.spec.ts' },
    { name: 'Regression:Parent',    testMatch: '**/e2e/parent.spec.ts' },
    // ── FUNCTIONAL ────────────────────────────────────────────
    { name: 'Functional:Admin',     testMatch: '**/functional/admin.functional.spec.ts' },
    { name: 'Functional:Principal', testMatch: '**/functional/principal.functional.spec.ts' },
    { name: 'Functional:Teacher',   testMatch: '**/functional/teacher.functional.spec.ts' },
    { name: 'Functional:Parent',    testMatch: '**/functional/parent.functional.spec.ts' },
  ],
});
