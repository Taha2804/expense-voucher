/**
 * One table covering every endpoint against every role, asserting the status
 * class from the spec's permission table. This is the test most likely to
 * catch a real regression: a route that loses its requireRole, or a role that
 * silently gains an action.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Signature, User } from '@prisma/client';
import { createApp } from '../src/app.js';
import { resetDb, disconnectDb } from './helpers/db.js';
import { makeUser, makeVoucher, makeSignature, DEFAULT_PASSWORD } from './helpers/factories.js';

const app = createApp();

type Caller = 'EMPLOYEE' | 'DIRECTOR' | 'ACCOUNTS' | 'ANONYMOUS';
type Outcome = 'ALLOWED' | 'FORBIDDEN' | 'UNAUTHENTICATED';

const EMAILS: Record<Exclude<Caller, 'ANONYMOUS'>, string> = {
  EMPLOYEE: 'aarav@abc.com',
  DIRECTOR: 'rohan@abc.com',
  ACCOUNTS: 'priya@abc.com',
};

interface Row {
  method: 'get' | 'post' | 'patch' | 'delete';
  path: string;
  body?: Record<string, unknown>;
  expected: Record<Caller, Outcome>;
}

let employee: User;
let employeeSig: Signature;
let directorSig: Signature;
let draftId: string;
let pendingId: string;

beforeEach(async () => {
  await resetDb();
  employee = await makeUser({ email: EMAILS.EMPLOYEE, department: 'Engineering' });
  const director = await makeUser({ email: EMAILS.DIRECTOR, role: 'DIRECTOR' });
  await makeUser({ email: EMAILS.ACCOUNTS, role: 'ACCOUNTS' });

  employeeSig = await makeSignature(employee.id);
  directorSig = await makeSignature(director.id);

  draftId = (await makeVoucher({ createdById: employee.id, employeeSignatureId: employeeSig.id })).id;
  pendingId = (
    await makeVoucher({
      createdById: employee.id,
      status: 'PENDING_APPROVAL',
      employeeSignatureId: employeeSig.id,
      submittedAt: new Date(),
    })
  ).id;
});

afterAll(async () => {
  await disconnectDb();
});

const ALL_ROLES_ALLOWED: Record<Caller, Outcome> = {
  EMPLOYEE: 'ALLOWED',
  DIRECTOR: 'ALLOWED',
  ACCOUNTS: 'ALLOWED',
  ANONYMOUS: 'UNAUTHENTICATED',
};

const EMPLOYEE_ONLY: Record<Caller, Outcome> = {
  EMPLOYEE: 'ALLOWED',
  DIRECTOR: 'FORBIDDEN',
  ACCOUNTS: 'FORBIDDEN',
  ANONYMOUS: 'UNAUTHENTICATED',
};

const DIRECTOR_ONLY: Record<Caller, Outcome> = {
  EMPLOYEE: 'FORBIDDEN',
  DIRECTOR: 'ALLOWED',
  ACCOUNTS: 'FORBIDDEN',
  ANONYMOUS: 'UNAUTHENTICATED',
};

function rows(): Row[] {
  return [
    { method: 'get', path: '/api/auth/me', expected: ALL_ROLES_ALLOWED },
    { method: 'get', path: '/api/vouchers', expected: ALL_ROLES_ALLOWED },
    { method: 'get', path: `/api/vouchers/${draftId}`, expected: ALL_ROLES_ALLOWED },
    {
      method: 'post',
      path: '/api/vouchers',
      body: { title: 'Probe', expenseDate: '2026-01-01', department: 'Engineering', amount: '10.00', category: 'OTHER' },
      expected: EMPLOYEE_ONLY,
    },
    { method: 'patch', path: `/api/vouchers/${draftId}`, body: { title: 'Probe' }, expected: EMPLOYEE_ONLY },
    { method: 'delete', path: `/api/vouchers/${draftId}`, expected: EMPLOYEE_ONLY },
    { method: 'post', path: `/api/vouchers/${draftId}/submit`, expected: EMPLOYEE_ONLY },
    {
      method: 'post',
      path: `/api/vouchers/${pendingId}/approve`,
      body: { signatureId: directorSig.id },
      expected: DIRECTOR_ONLY,
    },
    {
      method: 'post',
      path: `/api/vouchers/${pendingId}/reject`,
      body: { rejectionReason: 'Not reimbursable under the current expense policy.' },
      expected: DIRECTOR_ONLY,
    },
    {
      method: 'get',
      path: `/api/signatures/${employeeSig.id}/image`,
      expected: ALL_ROLES_ALLOWED,
    },
  ];
}

/** Log in without the shared helper, so an anonymous caller needs no agent. */
async function callerAgent(caller: Caller) {
  if (caller === 'ANONYMOUS') return request(app);
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: EMAILS[caller], password: DEFAULT_PASSWORD });
  return agent;
}

describe('authorization matrix', () => {
  const callers: Caller[] = ['EMPLOYEE', 'DIRECTOR', 'ACCOUNTS', 'ANONYMOUS'];

  for (const caller of callers) {
    it(`enforces the permission table for ${caller}`, async () => {
      const agent = await callerAgent(caller);
      const failures: string[] = [];

      for (const row of rows()) {
        const expected = row.expected[caller];
        const res = await agent[row.method](row.path).send(row.body ?? {});

        const actual: Outcome =
          res.status === 401 ? 'UNAUTHENTICATED' : res.status === 403 ? 'FORBIDDEN' : 'ALLOWED';

        // ALLOWED means "not blocked by the permission layer". A 404 or 409
        // from the business rules still counts as allowed.
        if (actual !== expected) {
          failures.push(
            `${row.method.toUpperCase()} ${row.path} as ${caller}: expected ${expected}, got ${actual} (${res.status})`,
          );
        }
      }

      expect(failures).toEqual([]);
    });
  }
});
