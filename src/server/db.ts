import { PrismaClient } from '@prisma/client';

/** Dev hot-reload creates a fresh module instance on every save; without the
 *  global cache that means a new connection pool each time. */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
