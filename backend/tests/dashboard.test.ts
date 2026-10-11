import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import type { User } from '@prisma/client';
import { createApp } from '../src/app.js';
import { resetDb, disconnectDb } from './helpers/db.js';
import { makeUser, makeVoucher } from './helpers/factories.js';
import { loginAs } from './helpers/agent.js';

const app = createApp();

let aarav: User;
let sneha: User;
let rohan: User;

/**
 * A Date at the given wall-clock time in Asia/Kolkata (UTC+5:30), expressed in
 * UTC. 23:30 IST is 18:00 UTC the same day; a naive UTC date comparison would
 * put it on the wrong day only for times past 18:30 IST, which is exactly the
 * boundary these tests pin.
 */
function istTime(daysAgo: number, hours: number, minutes: number): Date {
  const now = new Date();
  const local = new Date(now.getTime() + 5.5 * 3_600_000);
  local.setUTCDate(local.getUTCDate() - daysAgo);
  local.setUTCHours(hours, minutes, 0, 0);
  return new Date(local.getTime() - 5.5 * 3_600_000);
}

beforeEach(async () => {
  await resetDb();
  aarav = await makeUser({ email: 'aarav@abc.com', department: 'Engineering' });
  sneha = await makeUser({ email: 'sneha@abc.com', department: 'Sales' });
  rohan = await makeUser({ email: 'rohan@abc.com', role: 'DIRECTOR' });
  await makeUser({ email: 'priya@abc.com', role: 'ACCOUNTS' });

  // Aarav: 1 draft, 2 pending, 3 approved, 1 rejected.
  await makeVoucher({ createdById: aarav.id, status: 'DRAFT', amount: '100.00' });
  await makeVoucher({ createdById: aarav.id, status: 'PENDING_APPROVAL', amount: '200.00' });
  await makeVoucher({ createdById: aarav.id, status: 'PENDING_APPROVAL', amount: '300.00' });
  await makeVoucher({ createdById: aarav.id, status: 'APPROVED', amount: '400.00', reviewedById: rohan.id, approvalDate: istTime(5, 12, 0) });
  await makeVoucher({ createdById: aarav.id, status: 'APPROVED', amount: '500.00', reviewedById: rohan.id, approvalDate: istTime(4, 12, 0) });
  await makeVoucher({ createdById: aarav.id, status: 'APPROVED', amount: '600.00', reviewedById: rohan.id, approvalDate: istTime(3, 12, 0) });
  await makeVoucher({ createdById: aarav.id, status: 'REJECTED', amount: '700.00', reviewedById: rohan.id, rejectionReason: 'Not reimbursable under policy.' });

  // Sneha: 5 approved.
  for (let i = 1; i <= 5; i++) {
    await makeVoucher({
      createdById: sneha.id, status: 'APPROVED', amount: `${i * 10}.00`,
      reviewedById: rohan.id, approvalDate: istTime(6, 12, 0),
    });
  }
});

afterAll(async () => {
  await disconnectDb();
});

describe('GET /api/dashboard/stats — employee', () => {
  it("counts only the caller's vouchers and sums only their amounts", async () => {
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent.get('/api/dashboard/stats');

    expect(res.status).toBe(200);
    expect(res.body.stats).toMatchObject({
      role: 'EMPLOYEE', total: 7, draft: 1, pending: 2, approved: 3, rejected: 1,
    });
    // 100 + 200 + 300 + 400 + 500 + 600 + 700, none of Sneha's.
    expect(res.body.stats.totalAmountClaimed).toBe('2800.00');
  });

  it('totalAmountClaimed is a string and sums with decimal precision', async () => {
    await resetDb();
    const solo = await makeUser({ email: 'solo@abc.com' });
    await makeVoucher({ createdById: solo.id, amount: '0.10' });
    await makeVoucher({ createdById: solo.id, amount: '0.20' });
    const agent = await loginAs(app, 'solo@abc.com');

    const res = await agent.get('/api/dashboard/stats');

    expect(res.body.stats.totalAmountClaimed).toBe('0.30');
    expect(typeof res.body.stats.totalAmountClaimed).toBe('string');
  });
});

describe('GET /api/dashboard/stats — director', () => {
  it('reports the pending count and total pending amount across all employees', async () => {
    const agent = await loginAs(app, 'rohan@abc.com');

    const res = await agent.get('/api/dashboard/stats');

    expect(res.status).toBe(200);
    expect(res.body.stats.role).toBe('DIRECTOR');
    expect(res.body.stats.pending).toBe(2);
    expect(res.body.stats.totalPendingAmount).toBe('500.00');
  });

  it('approvedToday counts a voucher approved at 23:30 Asia/Kolkata today and excludes one from yesterday', async () => {
    await makeVoucher({
      createdById: aarav.id, status: 'APPROVED', amount: '11.00',
      reviewedById: rohan.id, approvalDate: istTime(0, 23, 30), reviewedAt: istTime(0, 23, 30),
    });
    await makeVoucher({
      createdById: aarav.id, status: 'APPROVED', amount: '12.00',
      reviewedById: rohan.id, approvalDate: istTime(1, 23, 30), reviewedAt: istTime(1, 23, 30),
    });
    const agent = await loginAs(app, 'rohan@abc.com');

    const res = await agent.get('/api/dashboard/stats');

    expect(res.body.stats.approvedToday).toBe(1);
  });

  it('rejectedToday behaves the same way', async () => {
    await makeVoucher({
      createdById: aarav.id, status: 'REJECTED', amount: '13.00', reviewedById: rohan.id,
      rejectionReason: 'Not reimbursable under policy.', reviewedAt: istTime(0, 23, 30),
    });
    await makeVoucher({
      createdById: aarav.id, status: 'REJECTED', amount: '14.00', reviewedById: rohan.id,
      rejectionReason: 'Not reimbursable under policy.', reviewedAt: istTime(1, 23, 30),
    });
    const agent = await loginAs(app, 'rohan@abc.com');

    const res = await agent.get('/api/dashboard/stats');

    // Only the 23:30 IST one from today; the fixture's own rejection has no
    // reviewedAt, and yesterday's is excluded.
    expect(res.body.stats.rejectedToday).toBe(1);
  });

  it('recentActivity returns at most 10 vouchers, newest first', async () => {
    const agent = await loginAs(app, 'rohan@abc.com');

    const res = await agent.get('/api/dashboard/stats');

    const activity = res.body.stats.recentActivity as { updatedAt: string }[];
    expect(activity.length).toBeLessThanOrEqual(10);
    expect(activity.length).toBeGreaterThan(0);
    const timestamps = activity.map((v) => new Date(v.updatedAt).getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
  });
});

describe('GET /api/dashboard/stats — accounts', () => {
  it('reports org-wide counts and totalApprovedAmount over APPROVED only', async () => {
    const agent = await loginAs(app, 'priya@abc.com');

    const res = await agent.get('/api/dashboard/stats');

    expect(res.status).toBe(200);
    expect(res.body.stats).toMatchObject({
      role: 'ACCOUNTS', total: 12, pending: 2, approved: 8, rejected: 1,
    });
    // Aarav 400 + 500 + 600, Sneha 10 + 20 + 30 + 40 + 50.
    expect(res.body.stats.totalApprovedAmount).toBe('1650.00');
  });

  it('recentApproved returns only APPROVED vouchers, newest approvalDate first', async () => {
    const agent = await loginAs(app, 'priya@abc.com');

    const res = await agent.get('/api/dashboard/stats');

    const recent = res.body.stats.recentApproved as { status: string; approvalDate: string }[];
    expect(recent.length).toBeGreaterThan(0);
    for (const v of recent) expect(v.status).toBe('APPROVED');
    const timestamps = recent.map((v) => new Date(v.approvalDate).getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
  });
});

describe('GET /api/dashboard/stats — access', () => {
  it('returns 401 without a cookie', async () => {
    const res = await request(app).get('/api/dashboard/stats');

    expect(res.status).toBe(401);
  });
});
