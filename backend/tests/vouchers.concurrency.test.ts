/**
 * Races on the employee-side writes.
 *
 * Business rule 5 — "once submitted, vouchers become read-only for employees" —
 * is only as strong as the WHERE clause that enforces it. A read-then-write
 * leaves a window in which a submit and an edit both succeed, and the Director
 * then reviews a voucher whose figures changed after it was submitted.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import type { Signature, User } from '@prisma/client';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetDb, disconnectDb } from './helpers/db.js';
import { makeUser, makeSignature, makeVoucher } from './helpers/factories.js';
import { loginAs } from './helpers/agent.js';

const app = createApp();
const ROUNDS = 12;
const ORIGINAL_TITLE = 'Original title';

let aarav: User;
let signature: Signature;

beforeEach(async () => {
  await resetDb();
  aarav = await makeUser({ email: 'aarav@abc.com' });
  signature = await makeSignature(aarav.id);
});

afterAll(async () => {
  await disconnectDb();
});

async function freshDraft() {
  return makeVoucher({
    createdById: aarav.id,
    title: ORIGINAL_TITLE,
    employeeSignatureId: signature.id,
  });
}

describe('concurrent employee writes', () => {
  it('an edit racing a submit never changes a voucher that has left DRAFT', async () => {
    const agent = await loginAs(app, 'aarav@abc.com');
    const violations: string[] = [];

    for (let i = 0; i < ROUNDS; i++) {
      const voucher = await freshDraft();

      const [submit, patch] = await Promise.all([
        agent.post(`/api/vouchers/${voucher.id}/submit`),
        agent.patch(`/api/vouchers/${voucher.id}`).send({ title: 'EDITED AFTER SUBMIT' }),
      ]);

      const after = await prisma.voucher.findUnique({ where: { id: voucher.id } });

      if (submit.status >= 500 || patch.status >= 500) {
        violations.push(`round ${i}: 5xx (submit ${submit.status}, patch ${patch.status})`);
      }
      // The invariant: a voucher awaiting approval carries what was submitted.
      if (after?.status === 'PENDING_APPROVAL' && after.title !== ORIGINAL_TITLE) {
        violations.push(`round ${i}: PENDING_APPROVAL voucher was edited to "${after.title}"`);
      }
      // And an edit that reports success must have left the voucher a draft.
      if (patch.status === 200 && after?.status !== 'DRAFT') {
        violations.push(`round ${i}: patch returned 200 but status is ${after?.status}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('a delete racing a submit never reports both as successful', async () => {
    const agent = await loginAs(app, 'aarav@abc.com');
    const violations: string[] = [];

    for (let i = 0; i < ROUNDS; i++) {
      const voucher = await freshDraft();

      const [submit, remove] = await Promise.all([
        agent.post(`/api/vouchers/${voucher.id}/submit`),
        agent.delete(`/api/vouchers/${voucher.id}`),
      ]);

      const after = await prisma.voucher.findUnique({ where: { id: voucher.id } });

      if (submit.status >= 500 || remove.status >= 500) {
        violations.push(`round ${i}: 5xx (submit ${submit.status}, delete ${remove.status})`);
      }
      if (submit.status === 200 && remove.status === 204) {
        violations.push(`round ${i}: submit and delete both succeeded`);
      }
      if (submit.status === 200 && after === null) {
        violations.push(`round ${i}: submit returned 200 but the voucher is gone`);
      }
      if (remove.status === 204 && after !== null) {
        violations.push(`round ${i}: delete returned 204 but the voucher still exists`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('two concurrent submits produce exactly one success', async () => {
    const agent = await loginAs(app, 'aarav@abc.com');
    const voucher = await freshDraft();

    const results = await Promise.all([
      agent.post(`/api/vouchers/${voucher.id}/submit`),
      agent.post(`/api/vouchers/${voucher.id}/submit`),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });
});
