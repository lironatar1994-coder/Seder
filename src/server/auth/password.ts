import 'server-only';
import { hash, verify } from '@node-rs/argon2';

/** OWASP's argon2id baseline: 19 MiB, 2 passes, 1 lane. */
const OPTS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTS);
}

export async function verifyPassword(digest: string, plain: string): Promise<boolean> {
  try {
    return await verify(digest, plain, OPTS);
  } catch {
    // A malformed digest is a failed login, not a crash.
    return false;
  }
}
