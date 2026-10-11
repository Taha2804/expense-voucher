import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import type { User, Voucher } from '@prisma/client';
import { createApp } from '../src/app.js';
import { resetDb, disconnectDb } from './helpers/db.js';
import { makeUser, makeVoucher } from './helpers/factories.js';
import { loginAs } from './helpers/agent.js';

const app = createApp();

let aarav: User;
let sneha: User;
let aaravVouchers: Voucher[];

beforeEach(async () => {
  await resetDb();

  aarav = await makeUser({ email: 'aarav@abc.com', name: 'Aarav Sharma', department: 'Engineering' });
  sneha = await makeUser({ email: 'sneha@abc.com', name: 'Sneha Iyer', department: 'Sales' });
  await makeUser({ email: 'rohan@abc.com', name: 'Rohan Mehta', role: 'DIRECTOR' });
  await makeUser({ email: 'priya@abc.com', name: 'Priya Nair', role: 'ACCOUNTS' });

  aaravVouchers = [
    await makeVoucher({
      createdById: aarav.id, title: 'Train to Pune', department: 'Engineering',
      category: 'TRAVEL', status: 'DRAFT', amount: '9.00', expenseDate: new Date('2026-01-10'),
    }),
    await makeVoucher({
      createdById: aarav.id, title: 'Team lunch', department: 'Engineering',
      category: 'MEALS', status: 'PENDING_APPROVAL', amount: '10.00', expenseDate: new Date('2026-02-10'),
    }),
    await makeVoucher({
      createdById: aarav.id, title: 'Conference pass', department: 'Engineering',
      category: 'TRAINING', status: 'APPROVED', amount: '100.00', expenseDate: new Date('2026-03-10'),
    }),
    await makeVoucher({
      createdById: aarav.id, title: 'Headphones', department: 'Engineering',
      category: 'OFFICE_SUPPLIES', status: 'REJECTED', amount: '1000.00', expenseDate: new Date('2026-04-10'),
    }),
  ];

  await makeVoucher({
    createdById: sneha.id, title: 'Customer dinner', department: 'Sales',
    category: 'CLIENT_ENTERTAINMENT', status: 'APPROVED', amount: '500.00', expenseDate: new Date('2026-02-20'),
  });
});

afterAll(async () => {
  await disconnectDb();
});

describe('GET /api/vouchers scoping', () => {
  it('an EMPLOYEE sees only their own vouchers', async () => {
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent.get('/api/vouchers');

    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(4);
    for (const v of res.body.data) expect(v.createdBy.id).toBe(aarav.id);
  });

  it('an EMPLOYEE cannot widen the scope by sending createdById or userId in the query', async () => {
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent.get('/api/vouchers').query({ createdById: sneha.id, userId: sneha.id });

    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(4);
    for (const v of res.body.data) expect(v.createdBy.id).toBe(aarav.id);
  });

  it('a DIRECTOR and an ACCOUNTS user see all vouchers', async () => {
    const director = await loginAs(app, 'rohan@abc.com');
    const accounts = await loginAs(app, 'priya@abc.com');

    expect((await director.get('/api/vouchers')).body.pagination.total).toBe(5);
    expect((await accounts.get('/api/vouchers')).body.pagination.total).toBe(5);
  });

  it("GET /api/vouchers/:id returns 404 for another employee's voucher", async () => {
    const snehaVoucher = await makeVoucher({ createdById: sneha.id, title: 'Private' });
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent.get(`/api/vouchers/${snehaVoucher.id}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/vouchers filtering', () => {
  it('filters by status, department, category', async () => {
    const director = await loginAs(app, 'rohan@abc.com');

    expect((await director.get('/api/vouchers').query({ status: 'APPROVED' })).body.pagination.total).toBe(2);
    expect((await director.get('/api/vouchers').query({ department: 'Sales' })).body.pagination.total).toBe(1);
    expect((await director.get('/api/vouchers').query({ category: 'TRAVEL' })).body.pagination.total).toBe(1);
  });

  it('filters by q against voucher number, title, and employee name', async () => {
    const director = await loginAs(app, 'rohan@abc.com');
    const first = aaravVouchers[0]!;

    const byNumber = await director.get('/api/vouchers').query({ q: first.voucherNumber });
    expect(byNumber.body.pagination.total).toBe(1);

    const byTitle = await director.get('/api/vouchers').query({ q: 'lunch' });
    expect(byTitle.body.pagination.total).toBe(1);

    const byEmployee = await director.get('/api/vouchers').query({ q: 'Sneha' });
    expect(byEmployee.body.pagination.total).toBe(1);
  });

  it('filters by dateFrom/dateTo on expenseDate, inclusive on both ends', async () => {
    const director = await loginAs(app, 'rohan@abc.com');

    const res = await director
      .get('/api/vouchers')
      .query({ dateFrom: '2026-01-10', dateTo: '2026-03-10' });

    // 2026-01-10, 2026-02-10, 2026-02-20, 2026-03-10 — both ends included.
    expect(res.body.pagination.total).toBe(4);
  });

  it('filters by minAmount/maxAmount, inclusive, comparing as decimals not strings', async () => {
    const director = await loginAs(app, 'rohan@abc.com');

    // String comparison would place "9.00" above "10.00"; decimal does not.
    const res = await director.get('/api/vouchers').query({ minAmount: '10', maxAmount: '100' });

    expect(res.body.pagination.total).toBe(2);
    const amounts = (res.body.data as { amount: string }[]).map((v) => v.amount).sort();
    expect(amounts).toEqual(['10.00', '100.00']);
  });

  it('returns 400 when dateFrom is later than dateTo', async () => {
    const director = await loginAs(app, 'rohan@abc.com');

    const res = await director
      .get('/api/vouchers')
      .query({ dateFrom: '2026-05-01', dateTo: '2026-01-01' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/vouchers sorting and pagination', () => {
  it.each(['voucherDate', 'expenseDate', 'amount', 'voucherNumber', 'status', 'createdAt'] as const)(
    'sorts by %s ascending and descending',
    async (sortBy) => {
      const agent = await loginAs(app, 'aarav@abc.com');

      const asc = await agent.get('/api/vouchers').query({ sortBy, sortOrder: 'asc' });
      const desc = await agent.get('/api/vouchers').query({ sortBy, sortOrder: 'desc' });

      expect(asc.status).toBe(200);
      expect(desc.status).toBe(200);
      const ascIds = (asc.body.data as { id: string }[]).map((v) => v.id);
      const descIds = (desc.body.data as { id: string }[]).map((v) => v.id);
      expect(ascIds).toEqual([...descIds].reverse());
    },
  );

  it('paginates: page 2 of pageSize 2 returns the third and fourth rows and total stays the full count', async () => {
    const agent = await loginAs(app, 'aarav@abc.com');

    const all = await agent.get('/api/vouchers').query({ sortBy: 'amount', sortOrder: 'asc', pageSize: 100 });
    const page2 = await agent.get('/api/vouchers').query({ sortBy: 'amount', sortOrder: 'asc', page: 2, pageSize: 2 });

    expect(page2.body.pagination).toMatchObject({ page: 2, pageSize: 2, total: 4, totalPages: 2 });
    const expected = (all.body.data as { id: string }[]).slice(2, 4).map((v) => v.id);
    expect((page2.body.data as { id: string }[]).map((v) => v.id)).toEqual(expected);
  });

  it.each([
    { page: '0' },
    { page: '-1' },
    { pageSize: 'abc' },
    { sortBy: 'passwordHash' },
  ])('returns 400 for %o', async (query) => {
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent.get('/api/vouchers').query(query);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('clamps pageSize=5000 to 100', async () => {
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent.get('/api/vouchers').query({ pageSize: 5000 });

    expect(res.status).toBe(200);
    expect(res.body.pagination.pageSize).toBe(100);
  });
});
