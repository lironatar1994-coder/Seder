import { readFileSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/** The suite runs against a production build on its own port, not `next dev`.
 *  In dev, Fast Refresh recompiles routes on first hit and can land in the
 *  middle of a navigation, which shows up as flaky redirects that have nothing
 *  to do with the app. */
const PORT = 3100;

/** Read from next.config.ts rather than duplicated: deploying under a sub-path
 *  moves every route, and a stale copy here would 404 the whole suite. */
export const BASE_PATH =
  readFileSync('next.config.ts', 'utf8').match(/basePath:\s*['"]([^'"]*)['"]/)?.[1] ?? '';

const ORIGIN = `http://localhost:${PORT}`;

/** With no SMTP configured the mailer writes here, which is how the password
 *  reset tests get hold of the emailed link. */
export const MAIL_LOG = 'e2e-mail.log';

/**
 * The suite builds into its own directory.
 *
 * `.next` belongs to whatever `next dev` is running in this folder, and two
 * Next processes writing one build directory corrupt it — the symptom is a
 * `Cannot find module './611.js'` from a chunk that was deleted mid-build, not
 * anything wrong with the app. Isolating the build also means a test run no
 * longer forces the developer to restart their dev server.
 */
const DIST_DIR = '.next-e2e';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `${ORIGIN}${BASE_PATH}`,
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `${ORIGIN}${BASE_PATH}/login`,
    env: {
      MAIL_LOG_FILE: MAIL_LOG,
      APP_URL: `${ORIGIN}${BASE_PATH}`,
      NEXT_DIST_DIR: DIST_DIR,
    },
    // Never reuse: a server left over from an earlier run serves the previous
    // build, and the suite would quietly pass against stale code.
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
