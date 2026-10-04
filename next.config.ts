import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  basePath: '/seder',
  // The public directory URL keeps its slash for Search Console and sitemap;
  // middleware retains the existing slash-free app/auth routes.
  skipTrailingSlashRedirect: true,
  // Keep verification and canonical metadata in the initial HTML head, including
  // Search Console's verifier and crawlers that do not execute JavaScript.
  htmlLimitedBots: /.*/,
  distDir: process.env.NEXT_DIST_DIR ?? '.next',

  // argon2 is a native module — keep it out of the server bundle.
  serverExternalPackages: ['@node-rs/argon2'],

  // The dev indicator is pinned to the bottom-left, which in an RTL layout is
  // the inline-end corner where this app stacks its toasts — it sits on top of
  // the undo button and swallows the click.
  devIndicators: false,
};

export default nextConfig;
