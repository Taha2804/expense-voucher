import { Prisma, type Voucher } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { nextVoucherNumber } from '../../lib/voucherNumber.js';
import { serializeAmount } from '../../lib/money.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors.js';
import type { PublicUser } from '../auth/auth.service.js';
import {
  todayLocalISO,
  toUtcMidnight,
  type CreateVoucherInput,
  type ListVouchersQuery,
} from './vouchers.schemas.js';

const voucherInclude = {
  createdBy: { select: { id: true, name: true, employeeCode: true, department: true } },
  reviewedBy: { select: { id: true, name: true } },
} satisfies Prisma.VoucherInclude;

type VoucherRow = Prisma.VoucherGetPayload<{ include: typeof voucherInclude }>;

export interface VoucherDto {
  id: string;
  voucherNumber: string;
  voucherDate: string;
  expenseDate: string;
  department: string;
  title: string;
  category: Voucher['category'];
  description: string | null;
  amount: string;
  status: Voucher['status'];
  createdBy: { id: string; name: string; employeeCode: string | null; department: string | null };
  reviewedBy: { id: string; name: string } | null;
  employeeSignatureId: string | null;
  directorSignatureId: string | null;
  submittedAt: string | null;
  approvalDate: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toVoucherDto(row: VoucherRow): VoucherDto {
  return {
    id: row.id,
    voucherNumber: row.voucherNumber,
    voucherDate: row.voucherDate.toISOString(),
    expenseDate: row.expenseDate.toISOString(),
    department: row.department,
    title: row.title,
    category: row.category,
    description: row.description,
    amount: serializeAmount(row.amount)!,
    status: row.status,
    createdBy: row.createdBy,
    reviewedBy: row.reviewedBy,
    employeeSignatureId: row.employeeSignatureId,
    directorSignatureId: row.directorSignatureId,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    approvalDate: row.approvalDate?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Employees are confined to their own rows; the other two roles see everything. */
export function scopeFor(user: PublicUser): Prisma.VoucherWhereInput {
  return user.role === 'EMPLOYEE' ? { createdById: user.id } : {};
}

export async function assertSignatureOwnedBy(
  ownerId: string,
  signatureId: string,
): Promise<void> {
  const signature = await prisma.signature.findUnique({
    where: { id: signatureId },
    select: { ownerId: true },
  });

  if (!signature) throw new NotFoundError('Signature not found');
  if (signature.ownerId !== ownerId) {
    throw new ForbiddenError('You can only use your own signature');
  }
}

export async function createVoucher(
  user: PublicUser,
  input: CreateVoucherInput,
): Promise<VoucherDto> {
  // Falls back to the user's own department; an employee with none on their
  // profile must supply one.
  const department = input.department ?? user.department;
  if (!department) {
    throw new ValidationError('Department is required', [
      { path: ['department'], message: 'Department is required' },
    ]);
  }

  if (input.employeeSignatureId) {
    await assertSignatureOwnedBy(user.id, input.employeeSignatureId);
  }

  const row = await prisma.$transaction(async (tx) =>
    tx.voucher.create({
      // Built field by field rather than spread, so an injected status, id or
      // voucherNumber in the request body cannot reach the database.
      data: {
        voucherNumber: await nextVoucherNumber(tx),
        voucherDate: toUtcMidnight(input.voucherDate ?? todayLocalISO()),
        expenseDate: toUtcMidnight(input.expenseDate),
        department,
        title: input.title,
        category: input.category,
        description: input.description ?? null,
        amount: new Prisma.Decimal(input.amount),
        status: 'DRAFT',
        createdById: user.id,
        employeeSignatureId: input.employeeSignatureId ?? null,
      },
      include: voucherInclude,
    }),
  );

  return toVoucherDto(row);
}

export async function getVoucherById(user: PublicUser, id: string): Promise<VoucherDto> {
  const row = await prisma.voucher.findFirst({
    where: { id, ...scopeFor(user) },
    include: voucherInclude,
  });

  // Not found rather than forbidden: the response must not confirm that a
  // voucher belonging to someone else exists.
  if (!row) throw new NotFoundError('Voucher not found');

  return toVoucherDto(row);
}

export interface PaginatedVouchers {
  data: VoucherDto[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function listVouchers(
  user: PublicUser,
  query: ListVouchersQuery,
): Promise<PaginatedVouchers> {
  const where: Prisma.VoucherWhereInput = {};

  if (query.status) where.status = query.status;
  if (query.department) where.department = { equals: query.department, mode: 'insensitive' };
  if (query.category) where.category = query.category;

  if (query.dateFrom || query.dateTo) {
    where.expenseDate = {
      ...(query.dateFrom ? { gte: toUtcMidnight(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: toUtcMidnight(query.dateTo) } : {}),
    };
  }

  if (query.minAmount || query.maxAmount) {
    where.amount = {
      ...(query.minAmount ? { gte: new Prisma.Decimal(query.minAmount) } : {}),
      ...(query.maxAmount ? { lte: new Prisma.Decimal(query.maxAmount) } : {}),
    };
  }

  if (query.q) {
    where.OR = [
      { voucherNumber: { contains: query.q, mode: 'insensitive' } },
      { title: { contains: query.q, mode: 'insensitive' } },
      { createdBy: { name: { contains: query.q, mode: 'insensitive' } } },
    ];
  }

  // Applied last, so nothing a client sent can widen an employee's scope.
  Object.assign(where, scopeFor(user));

  const skip = (query.page - 1) * query.pageSize;
  // id breaks ties, so a sort on a column with duplicate values is still a
  // total order and paging through it cannot repeat or skip a row.
  const orderBy: Prisma.VoucherOrderByWithRelationInput[] = [
    { [query.sortBy]: query.sortOrder },
    { id: query.sortOrder },
  ];

  const [total, rows] = await prisma.$transaction([
    prisma.voucher.count({ where }),
    prisma.voucher.findMany({ where, orderBy, skip, take: query.pageSize, include: voucherInclude }),
  ]);

  return {
    data: rows.map(toVoucherDto),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
}
