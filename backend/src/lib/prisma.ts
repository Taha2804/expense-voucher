import { PrismaClient } from '@prisma/client';

/**
 * One client for the process. Prisma pools connections itself, so a second
 * instance only duplicates the pool.
 */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
