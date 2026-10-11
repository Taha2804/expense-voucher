import { Prisma } from '@prisma/client';

/**
 * Amounts cross the API as strings, never as JavaScript numbers. A voucher
 * total is summed and displayed, and binary floating point would produce
 * visible rounding errors on exactly the values that matter.
 */
export function serializeAmount(value: Prisma.Decimal | null): string | null {
  return value === null ? null : value.toFixed(2);
}

export function parseAmount(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}
