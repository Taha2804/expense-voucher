import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import type { Prisma, Signature, User, Voucher } from '@prisma/client';
import { prisma } from '../../src/lib/prisma.js';
import { nextVoucherNumber } from '../../src/lib/voucherNumber.js';

export const DEFAULT_PASSWORD = 'Password123!';

/**
 * Named make* rather than create* so a test file can import both these and the
 * voucher service's own createVoucher without a collision.
 */
export async function makeUser(
  overrides: Partial<Omit<User, 'id' | 'passwordHash'>> & { password?: string } = {},
): Promise<User> {
  const { password = DEFAULT_PASSWORD, ...rest } = overrides;

  return prisma.user.create({
    data: {
      email: rest.email ?? `user-${randomUUID()}@abc.com`,
      name: rest.name ?? 'Test User',
      role: rest.role ?? 'EMPLOYEE',
      department: rest.department === undefined ? 'Engineering' : rest.department,
      employeeCode: rest.employeeCode ?? null,
      passwordHash: await bcrypt.hash(password, 12),
    },
  });
}

export async function makeSignature(
  ownerId: string,
  overrides: Partial<Omit<Signature, 'id' | 'ownerId'>> = {},
): Promise<Signature> {
  return prisma.signature.create({
    data: {
      ownerId,
      filePath: overrides.filePath ?? `${randomUUID()}.png`,
      mimeType: overrides.mimeType ?? 'image/png',
      sizeBytes: overrides.sizeBytes ?? 792,
    },
  });
}

type VoucherOverrides = { createdById: string } & Partial<
  Omit<Voucher, 'id' | 'createdById' | 'voucherNumber' | 'amount'>
> & { amount?: Prisma.Decimal | string | number };

export async function makeVoucher(overrides: VoucherOverrides): Promise<Voucher> {
  const voucherNumber = overrides.voucherNumber ?? (await nextVoucherNumber(prisma));

  return prisma.voucher.create({
    data: {
      voucherNumber,
      createdById: overrides.createdById,
      voucherDate: overrides.voucherDate ?? new Date('2026-10-01'),
      expenseDate: overrides.expenseDate ?? new Date('2026-09-28'),
      department: overrides.department ?? 'Engineering',
      title: overrides.title ?? 'Client site visit',
      category: overrides.category ?? 'TRAVEL',
      description: overrides.description ?? 'Cab fare to the client office and back.',
      amount: (overrides.amount ?? '1250.00') as Prisma.Decimal,
      status: overrides.status ?? 'DRAFT',
      employeeSignatureId: overrides.employeeSignatureId ?? null,
      directorSignatureId: overrides.directorSignatureId ?? null,
      reviewedById: overrides.reviewedById ?? null,
      submittedAt: overrides.submittedAt ?? null,
      reviewedAt: overrides.reviewedAt ?? null,
      approvalDate: overrides.approvalDate ?? null,
      rejectionReason: overrides.rejectionReason ?? null,
    },
  });
}
