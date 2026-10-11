import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { nextVoucherNumber } from '../src/lib/voucherNumber.js';

describe('nextVoucherNumber', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('formats as VCH-<year>-<6 digits>', async () => {
    const number = await nextVoucherNumber(prisma, new Date('2026-03-01'));

    expect(number).toMatch(/^VCH-2026-\d{6}$/);
  });

  it('never returns the same number twice under concurrency', async () => {
    const results = await Promise.all(
      Array.from({ length: 25 }, () => nextVoucherNumber(prisma)),
    );

    expect(new Set(results).size).toBe(25);
  });
});
