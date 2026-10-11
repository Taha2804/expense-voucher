import type { Prisma, PrismaClient } from '@prisma/client';

const SEQUENCE_WIDTH = 6;

/**
 * Draw the next voucher number from the Postgres sequence.
 *
 * Deliberately not `count() + 1`: two employees creating a voucher at the same
 * moment would read the same count and collide on the unique constraint.
 * `nextval` is atomic, so every caller gets a distinct value even inside
 * concurrent transactions.
 */
export async function nextVoucherNumber(
  tx: Prisma.TransactionClient | PrismaClient,
  now: Date = new Date(),
): Promise<string> {
  const rows = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('voucher_number_seq')`;
  const value = rows[0]?.nextval;

  if (value === undefined) {
    throw new Error('voucher_number_seq returned no value');
  }

  const sequence = value.toString().padStart(SEQUENCE_WIDTH, '0');
  return `VCH-${now.getFullYear()}-${sequence}`;
}
