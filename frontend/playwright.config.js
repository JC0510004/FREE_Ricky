import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.e2e' })

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,       // un solo worker: un solo login, sin chocar con el límite
  retries: 0,       // un reintento = otro login = gastar el límite de 5/min
  timeout: 30_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://192.168.18.50:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
   expect: { timeout: 10_000 },
})