/**
 * A date that matches YYYY-MM-DD is not necessarily a date. "2026-00-10" and
 * "2026-02-30" both pass a shape check; the first is not a real instant and the
 * second is a different day from the one the user typed.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createApp } from '../src/app.js';
import { resetDb, disconnectDb } from './helpers/db.js';
import { makeUser } from './helpers/factories.js';
import { loginAs } from './helpers/agent.js';

const app = createApp();

const basePayload = {
  expenseDate: '2026-01-10',
  department: 'Engineering',
  title: 'Client site visit',
  category: 'TRAVEL',
  amount: '1250.00',
};

beforeEach(async () => {
  await resetDb();
  await makeUser({ email: 'aarav@abc.com', department: 'Engineering' });
});

afterAll(async () => {
  await disconnectDb();
});

describe('calendar validity on create', () => {
  it.each(['2026-00-10', '2026-13-45', '2026-02-30', '2026-04-31', '0000-01-01'])(
    'rejects expenseDate %s with 400, never a 500',
    async (expenseDate) => {
      const agent = await loginAs(app, 'aarav@abc.com');

      const res = await agent.post('/api/vouchers').send({ ...basePayload, expenseDate });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    },
  );

  it('rejects an impossible voucherDate rather than returning 500', async () => {
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent.post('/api/vouchers').send({ ...basePayload, voucherDate: '2026-00-10' });

    expect(res.status).toBe(400);
  });

  it('does not silently shift 2026-02-30 to 2026-03-02', async () => {
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent.post('/api/vouchers').send({ ...basePayload, expenseDate: '2026-02-30' });

    expect(res.status).toBe(400);
  });
});

describe('calendar validity on the list filters', () => {
  it.each(['2026-00-10', '2026-13-45', '2026-02-30'])(
    'rejects dateFrom %s with 400, never a 500',
    async (dateFrom) => {
      const agent = await loginAs(app, 'aarav@abc.com');

      const res = await agent.get('/api/vouchers').query({ dateFrom });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    },
  );

  it('rejects an impossible dateTo with 400, never a 500', async () => {
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent.get('/api/vouchers').query({ dateTo: '2026-00-31' });

    expect(res.status).toBe(400);
  });
});
