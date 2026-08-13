const { readFileSync } = require('node:fs');
const { join } = require('node:path');

/**
 * `.env.production` is written by deploy_linux.sh and read by Next on its own.
 * pm2 does not read it, and the WhatsApp worker is a plain Node process with
 * no framework to load it — so it is parsed here instead of having the
 * database path written out a second time and drifting.
 */
function productionEnv() {
  try {
    const raw = readFileSync(join(__dirname, '.env.production'), 'utf8');
    return Object.fromEntries(
      raw
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => {
          const at = line.indexOf('=');
          const key = line.slice(0, at).trim();
          const value = line.slice(at + 1).trim().replace(/^"(.*)"$/s, '$1');
          return [key, value];
        })
        .filter(([key]) => key),
    );
  } catch {
    return {};
  }
}

const shared = productionEnv();

module.exports = {
  apps: [
    {
      name: 'seder-live',
      cwd: '/root/Seder',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 127.0.0.1 -p 3107',
      env: {
        NODE_ENV: 'production',
        ...shared,
      },
      max_memory_restart: '600M',
      autorestart: true,
      time: true,
    },
    {
      name: 'seder-whatsapp',
      cwd: '/root/Seder',
      script: 'node_modules/tsx/dist/cli.mjs',
      /* `--conditions=react-server` is not decoration. The authorization layer
         the worker shares with the app imports `server-only`, whose package
         exports throw under every condition except this one — which is exactly
         the assertion being made: this process is a server, not a bundle
         heading for a browser. */
      args: '--conditions=react-server worker/whatsapp.ts',
      env: {
        NODE_ENV: 'production',
        ...shared,
      },
      /* Baileys keeps message and app-state caches; well under this in
         practice, and a restart only costs a reconnect, never the pairing. */
      max_memory_restart: '400M',
      autorestart: true,
      /* A crash loop against WhatsApp's servers is how a number gets blocked,
         so back off hard rather than restarting instantly. */
      restart_delay: 10_000,
      exp_backoff_restart_delay: 5_000,
      time: true,
    },
  ],
};
