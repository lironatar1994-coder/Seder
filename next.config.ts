import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  basePath: '/seder',
  distDir: process.env.NEXT_DIST_DIR ?? '.next',

  // argon2 is a native module — keep it out of the server bundle.
  serverExternalPackages: ['@node-rs/argon2'],

  // The dev indicator is pinned to the bottom-left, which in an RTL layout is
  // the inline-end corner where this app stacks its toasts — it sits on top of
  // the undo button and swallows the click.
  devIndicators: false,
};

export default nextConfig;
