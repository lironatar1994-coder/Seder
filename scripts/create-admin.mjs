/** Operator-only provisioning. Run on the server with its production DATABASE_URL.
 * Generates the password in memory and prints it once; never updates an existing user.
 */
import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';

const email = (process.argv[2] ?? '').trim().toLowerCase();
const name = (process.argv[3] ?? 'מנהל סדר').trim();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !name || name.length > 60) {
  throw new Error('Usage: node scripts/create-admin.mjs <email> [name]');
}
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL explicitly before provisioning.');
const db = new PrismaClient();
try {
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) throw new Error('Account already exists; no password or permissions changed.');
  const password = `Sd!${randomBytes(15).toString('base64url')}`;
  const passwordHash = await hash(password, { memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 });
  const user = await db.user.create({ data: { email, name, role: 'admin', passwordHash }, select: { id: true, email: true, role: true } });
  console.log(JSON.stringify({ ...user, password }));
} finally { await db.$disconnect(); }
