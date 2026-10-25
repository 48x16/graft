import { defineConfig, devices } from '@playwright/test';

// End-to-end and accessibility tests against the production build (`npm run build` first).
// Uses the Edge already installed on Windows (no Playwright browser download needed).
export default defineConfig({
  testDir: 'e2e',
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173/',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'msedge' } },
    { name: 'phone', use: { ...devices['Pixel 7'], channel: 'msedge' } },
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: true,
  },
});
