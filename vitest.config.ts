import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // `worker/` is the WhatsApp process. It lives outside src/ because Next
    // does not build it, but its pure parts — pacing, reply text — are exactly
    // the kind of logic this suite is for.
    include: ['src/**/*.test.ts', 'worker/**/*.test.ts'],
  },
});
