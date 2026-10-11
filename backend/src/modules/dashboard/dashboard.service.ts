import { Prisma, type VoucherStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { serializeAmount } from '../../lib/money.js';
import type { PublicUser } from '../auth/auth.service.js';
import { toVoucherDto, type VoucherDto } from '../vouchers/vouchers.service.js';

const voucherInclude = {
  createdBy: { select: { id: true, name: true, employeeCode: true, department: true } },
  reviewedBy: { select: { id: true, name: true } },
} satisfies Prisma.VoucherInclude;

export interface EmployeeStats {
  role: 'EMPLOYEE';
  total: number;
  draft: number;
  pending: number;
  approved: number;
  rejected: number;
  totalAmountClaimed: string;
}

export interface DirectorStats {
  role: 'DIRECTOR';
  pending: number;
  approvedToday: number;
  rejectedToday: number;
  totalPendingAmount: string;
  recentActivity: VoucherDto[];
}

export interface AccountsStats {
  role: 'ACCOUNTS';
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  totalApprovedAmount: string;
  recentApproved: VoucherDto[];
}

export type DashboardStats = EmployeeStats | DirectorStats | AccountsStats;

interface StatusTotals {
  counts: Record<VoucherStatus, number>;
  sums: Record<VoucherStatus, Prisma.Decimal>;
  total: number;
  grandTotal: Prisma.Decimal;
}

/** One aggregate round trip, rather than a count query per status. */
async function statusTotals(where: Prisma.VoucherWhereInput): Promise<StatusTotals> {
  const grouped = await prisma.voucher.groupBy({
    by: ['status'],
    where,
    _count: { _all: true },
    _sum: { amount: true },
  });

  const counts = { DRAFT: 0, PENDING_APPROVAL: 0, APPROVED: 0, REJECTED: 0 };
  const sums = {
    DRAFT: new Prisma.Decimal(0),
    PENDING_APPROVAL: new Prisma.Decimal(0),
    APPROVED: new Prisma.Decimal(0),
    REJECTED: new Prisma.Decimal(0),
  };

  for (const row of grouped) {
    counts[row.status] = row._count._all;
    sums[row.status] = row._sum.amount ?? new Prisma.Decimal(0);
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const grandTotal = Object.values(sums).reduce((a, b) => a.add(b), new Prisma.Decimal(0));

  return { counts, sums, total, grandTotal };
}

/**
 * The window covering "today" in the server's configured timezone, as UTC
 * instants. Comparing against `new Date().toISOString().slice(0, 10)` would
 * measure the UTC day and move the boundary by five and a half hours, so a
 * voucher approved at 23:30 IST would land on the following day.
 */
export function todayWindow(now: Date = new Date()): { start: Date; end: Date } {
  const offsetMs = now.getTimezoneOffset() * 60_000;
  const localMidnight = new Date(now.getTime() - offsetMs);
  localMidnight.setUTCHours(0, 0, 0, 0);

  const start = new Date(localMidnight.getTime() + offsetMs);
  const end = new Date(start.getTime() + 86_400_000);
  return { start, end };
}

export async function getStats(user: PublicUser): Promise<DashboardStats> {
  if (user.role === 'EMPLOYEE') {
    const { counts, total, grandTotal } = await statusTotals({ createdById: user.id });

    return {
      role: 'EMPLOYEE',
      total,
      draft: counts.DRAFT,
      pending: counts.PENDING_APPROVAL,
      approved: counts.APPROVED,
      rejected: counts.REJECTED,
      totalAmountClaimed: serializeAmount(grandTotal)!,
    };
  }

  if (user.role === 'DIRECTOR') {
    const { start, end } = todayWindow();
    const [{ counts, sums }, approvedToday, rejectedToday, recentActivity] = await Promise.all([
      statusTotals({}),
      prisma.voucher.count({
        where: { status: 'APPROVED', reviewedAt: { gte: start, lt: end } },
      }),
      prisma.voucher.count({
        where: { status: 'REJECTED', reviewedAt: { gte: start, lt: end } },
      }),
      prisma.voucher.findMany({
        where: { status: { not: 'DRAFT' } },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        include: voucherInclude,
      }),
    ]);

    return {
      role: 'DIRECTOR',
      pending: counts.PENDING_APPROVAL,
      approvedToday,
      rejectedToday,
      totalPendingAmount: serializeAmount(sums.PENDING_APPROVAL)!,
      recentActivity: recentActivity.map(toVoucherDto),
    };
  }

  const [{ counts, sums, total }, recentApproved] = await Promise.all([
    statusTotals({}),
    prisma.voucher.findMany({
      where: { status: 'APPROVED' },
      orderBy: { approvalDate: 'desc' },
      take: 10,
      include: voucherInclude,
    }),
  ]);

  return {
    role: 'ACCOUNTS',
    total,
    pending: counts.PENDING_APPROVAL,
    approved: counts.APPROVED,
    rejected: counts.REJECTED,
    totalApprovedAmount: serializeAmount(sums.APPROVED)!,
    recentApproved: recentApproved.map(toVoucherDto),
  };
}
