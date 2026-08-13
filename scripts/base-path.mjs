import { readFileSync } from 'node:fs';

/**
 * The app's `basePath`, read out of next.config.ts.
 *
 * Deploying under a sub-path moves every route, so tooling that talks to the
 * running server has to move with it. Reading the real config beats a second
 * copy of the value that silently rots — the failure mode is a 404 on every
 * page, which looks like a broken app rather than a stale constant.
 */
export function basePath() {
  const match = readFileSync('next.config.ts', 'utf8').match(/basePath:\s*['"]([^'"]*)['"]/);
  return match ? match[1] : '';
}

/** Origin plus basePath, with no trailing slash. */
export function appBase(origin) {
  return `${origin.replace(/\/$/, '')}${basePath()}`;
}
