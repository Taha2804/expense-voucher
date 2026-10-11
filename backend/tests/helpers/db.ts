import { prisma } from '../../src/lib/prisma.js';

/**
 * Empty every table and rewind the voucher sequence, so each test file starts
 * from a known state. CASCADE because vouchers reference users and signatures.
 */
export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Voucher", "Signature", "User" RESTART IDENTITY CASCADE',
  );
  await prisma.$executeRawUnsafe('ALTER SEQUENCE voucher_number_seq RESTART WITH 1');
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}
