import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createApp } from '../src/app.js';
import { resetDb, disconnectDb } from './helpers/db.js';
import { makeUser } from './helpers/factories.js';
import { loginAs } from './helpers/agent.js';

const app = createApp();

/**
 * Dates are evaluated in the server's timezone (Asia/Kolkata), not UTC, so the
 * tests must use the same definition of "today" — between 18:30 and 24:00 IST
 * the two differ by a day.
 */
function localISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

const validPayload = {
  expenseDate: localISO(-3),
  department: 'Engineering',
  title: 'Client site visit',
  category: 'TRAVEL',
  description: 'Return cab fare.',
  amount: '1250.00',
};

describe('POST /api/vouchers', () => {
  beforeEach(async () => {
    await resetDb();
    await makeUser({ email: 'aarav@abc.com', role: 'EMPLOYEE', department: 'Engineering' });
    await makeUser({ email: 'rohan@abc.com', role: 'DIRECTOR' });
    await makeUser({ email: 'priya@abc.com', role: 'ACCOUNTS' });
  });

  afterAll(async () => {
    await disconnectDb();
  });

  it('as an employee returns 201 with status DRAFT and a VCH- number', async () => {
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent.post('/api/vouchers').send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.voucher.status).toBe('DRAFT');
    expect(res.body.voucher.voucherNumber).toMatch(/^VCH-\d{4}-\d{6}$/);
    expect(res.body.voucher.createdBy.name).toBe('Test User');
  });

  it('ignores a client-supplied status and id', async () => {
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent
      .post('/api/vouchers')
      .send({ ...validPayload, status: 'APPROVED', id: 'injected-id', voucherNumber: 'VCH-0000-000001' });

    expect(res.status).toBe(201);
    expect(res.body.voucher.status).toBe('DRAFT');
    expect(res.body.voucher.id).not.toBe('injected-id');
    expect(res.body.voucher.voucherNumber).not.toBe('VCH-0000-000001');
  });

  it('defaults voucherDate to today and department to the user department', async () => {
    const agent = await loginAs(app, 'aarav@abc.com');
    const { department, ...withoutDepartment } = validPayload;

    const res = await agent.post('/api/vouchers').send(withoutDepartment);

    expect(res.status).toBe(201);
    expect(res.body.voucher.department).toBe('Engineering');
    expect(res.body.voucher.voucherDate.slice(0, 10)).toBe(localISO());
  });

  it('returns 403 for DIRECTOR and for ACCOUNTS', async () => {
    const director = await loginAs(app, 'rohan@abc.com');
    const accounts = await loginAs(app, 'priya@abc.com');

    expect((await director.post('/api/vouchers').send(validPayload)).status).toBe(403);
    expect((await accounts.post('/api/vouchers').send(validPayload)).status).toBe(403);
  });

  it.each(['department', 'title', 'expenseDate', 'amount'] as const)(
    'returns 400 when %s is missing',
    async (field) => {
      const agent = await loginAs(app, 'aarav@abc.com');
      const payload: Record<string, unknown> = { ...validPayload };
      delete payload[field];
      // department falls back to the user's department, so blank it explicitly.
      if (field === 'department') payload.department = '';

      const res = await agent.post('/api/vouchers').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(JSON.stringify(res.body.error.details)).toContain(field);
    },
  );

  it.each(['0', '-1', '0.001', '1e5', 'abc', '99999999999.99'])(
    'rejects amount %s',
    async (amount) => {
      const agent = await loginAs(app, 'aarav@abc.com');

      const res = await agent.post('/api/vouchers').send({ ...validPayload, amount });

      expect(res.status).toBe(400);
    },
  );

  it('accepts amount "12.34" and returns it as the string "12.34"', async () => {
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent.post('/api/vouchers').send({ ...validPayload, amount: '12.34' });

    expect(res.status).toBe(201);
    expect(res.body.voucher.amount).toBe('12.34');
    expect(typeof res.body.voucher.amount).toBe('string');
  });

  it('rejects an expenseDate in the future', async () => {
    const agent = await loginAs(app, 'aarav@abc.com');
    const res = await agent
      .post('/api/vouchers')
      .send({ ...validPayload, expenseDate: localISO(1) });

    expect(res.status).toBe(400);
  });

  it('rejects a description longer than 1000 characters', async () => {
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent
      .post('/api/vouchers')
      .send({ ...validPayload, description: 'x'.repeat(1001) });

    expect(res.status).toBe(400);
  });

  it('rejects an unknown category', async () => {
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent.post('/api/vouchers').send({ ...validPayload, category: 'BRIBERY' });

    expect(res.status).toBe(400);
  });
});
