module.exports = {
  apps: [
    {
      name: 'seder-live',
      cwd: '/root/Seder',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 127.0.0.1 -p 3107',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '600M',
      autorestart: true,
      time: true,
    },
  ],
};
