import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import type { Signature, User, VoucherStatus } from '@prisma/client';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetDb, disconnectDb } from './helpers/db.js';
import { makeUser, makeVoucher, makeSignature } from './helpers/factories.js';
import { loginAs } from './helpers/agent.js';

const app = createApp();

const REASON = 'Outside the approved budget for this quarter, please raise an IT asset request.';

let aarav: User;
let rohan: User;
let directorSig: Signature;
let employeeSig: Signature;

beforeEach(async () => {
  await resetDb();
  aarav = await makeUser({ email: 'aarav@abc.com' });
  rohan = await makeUser({ email: 'rohan@abc.com', role: 'DIRECTOR' });
  await makeUser({ email: 'priya@abc.com', role: 'ACCOUNTS' });
  employeeSig = await makeSignature(aarav.id);
  directorSig = await makeSignature(rohan.id);
});

afterAll(async () => {
  await disconnectDb();
});

/** A voucher sitting in PENDING_APPROVAL, ready for review. */
async function pending() {
  return makeVoucher({
    createdById: aarav.id,
    status: 'PENDING_APPROVAL',
    employeeSignatureId: employeeSig.id,
    submittedAt: new Date(),
  });
}

describe('POST /api/vouchers/:id/approve', () => {
  it('as DIRECTOR with their own signature sets APPROVED, approvalDate, reviewedById, directorSignatureId', async () => {
    const voucher = await pending();
    const director = await loginAs(app, 'rohan@abc.com');

    const res = await director
      .post(`/api/vouchers/${voucher.id}/approve`)
      .send({ signatureId: directorSig.id });

    expect(res.status).toBe(200);
    expect(res.body.voucher.status).toBe('APPROVED');
    expect(res.body.voucher.approvalDate).not.toBeNull();
    expect(res.body.voucher.reviewedBy.id).toBe(rohan.id);
    expect(res.body.voucher.directorSignatureId).toBe(directorSig.id);
  });

  it('without signatureId returns 400', async () => {
    const voucher = await pending();
    const director = await loginAs(app, 'rohan@abc.com');

    const res = await director.post(`/api/vouchers/${voucher.id}/approve`).send({});

    expect(res.status).toBe(400);
  });

  it('with a signature owned by someone else returns 403', async () => {
    const voucher = await pending();
    const director = await loginAs(app, 'rohan@abc.com');

    const res = await director
      .post(`/api/vouchers/${voucher.id}/approve`)
      .send({ signatureId: employeeSig.id });

    expect(res.status).toBe(403);
  });

  it.each(['DRAFT', 'APPROVED', 'REJECTED'] as VoucherStatus[])(
    'on a %s voucher returns 409',
    async (status) => {
      const voucher = await makeVoucher({ createdById: aarav.id, status });
      const director = await loginAs(app, 'rohan@abc.com');

      const res = await director
        .post(`/api/vouchers/${voucher.id}/approve`)
        .send({ signatureId: directorSig.id });

      expect(res.status).toBe(409);
    },
  );

  it('as EMPLOYEE or ACCOUNTS returns 403', async () => {
    const voucher = await pending();
    const employee = await loginAs(app, 'aarav@abc.com');
    const accounts = await loginAs(app, 'priya@abc.com');

    expect(
      (await employee.post(`/api/vouchers/${voucher.id}/approve`).send({ signatureId: employeeSig.id })).status,
    ).toBe(403);
    expect(
      (await accounts.post(`/api/vouchers/${voucher.id}/approve`).send({ signatureId: directorSig.id })).status,
    ).toBe(403);
  });

  it('two concurrent approvals: exactly one 200 and one 409, and approvalDate is written once', async () => {
    const voucher = await pending();
    const director = await loginAs(app, 'rohan@abc.com');

    const results = await Promise.all([
      director.post(`/api/vouchers/${voucher.id}/approve`).send({ signatureId: directorSig.id }),
      director.post(`/api/vouchers/${voucher.id}/approve`).send({ signatureId: directorSig.id }),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);

    const after = await prisma.voucher.findUnique({ where: { id: voucher.id } });
    expect(after?.status).toBe('APPROVED');
    expect(after?.approvalDate).not.toBeNull();
  });
});

describe('POST /api/vouchers/:id/reject', () => {
  it('with a reason sets REJECTED, rejectionReason, reviewedById, and leaves approvalDate null', async () => {
    const voucher = await pending();
    const director = await loginAs(app, 'rohan@abc.com');

    const res = await director
      .post(`/api/vouchers/${voucher.id}/reject`)
      .send({ rejectionReason: REASON });

    expect(res.status).toBe(200);
    expect(res.body.voucher.status).toBe('REJECTED');
    expect(res.body.voucher.rejectionReason).toBe(REASON);
    expect(res.body.voucher.reviewedBy.id).toBe(rohan.id);
    expect(res.body.voucher.approvalDate).toBeNull();
  });

  it.each(['', '   ', 'too short'])('with reason %j returns 400', async (rejectionReason) => {
    const voucher = await pending();
    const director = await loginAs(app, 'rohan@abc.com');

    const res = await director.post(`/api/vouchers/${voucher.id}/reject`).send({ rejectionReason });

    expect(res.status).toBe(400);
  });

  it.each(['DRAFT', 'APPROVED'] as VoucherStatus[])('on a %s voucher returns 409', async (status) => {
    const voucher = await makeVoucher({ createdById: aarav.id, status });
    const director = await loginAs(app, 'rohan@abc.com');

    const res = await director
      .post(`/api/vouchers/${voucher.id}/reject`)
      .send({ rejectionReason: REASON });

    expect(res.status).toBe(409);
  });

  it('does not require a director signature', async () => {
    const voucher = await pending();
    const director = await loginAs(app, 'rohan@abc.com');

    const res = await director
      .post(`/api/vouchers/${voucher.id}/reject`)
      .send({ rejectionReason: REASON });

    expect(res.status).toBe(200);
    expect(res.body.voucher.directorSignatureId).toBeNull();
  });
});

describe('read-only after review', () => {
  it('an approved voucher cannot be transitioned anywhere', async () => {
    const voucher = await makeVoucher({
      createdById: aarav.id,
      status: 'APPROVED',
      employeeSignatureId: employeeSig.id,
      directorSignatureId: directorSig.id,
      reviewedById: rohan.id,
      approvalDate: new Date(),
    });
    const employee = await loginAs(app, 'aarav@abc.com');
    const director = await loginAs(app, 'rohan@abc.com');

    expect((await employee.post(`/api/vouchers/${voucher.id}/submit`)).status).toBe(409);
    expect((await employee.patch(`/api/vouchers/${voucher.id}`).send({ title: 'x' })).status).toBe(409);
    expect((await employee.delete(`/api/vouchers/${voucher.id}`)).status).toBe(409);
    expect(
      (await director.post(`/api/vouchers/${voucher.id}/approve`).send({ signatureId: directorSig.id })).status,
    ).toBe(409);
    expect(
      (await director.post(`/api/vouchers/${voucher.id}/reject`).send({ rejectionReason: REASON })).status,
    ).toBe(409);
  });

  it('the employee who created a rejected voucher can read the rejection reason', async () => {
    const voucher = await makeVoucher({
      createdById: aarav.id,
      status: 'REJECTED',
      rejectionReason: REASON,
      reviewedById: rohan.id,
    });
    const employee = await loginAs(app, 'aarav@abc.com');

    const res = await employee.get(`/api/vouchers/${voucher.id}`);

    expect(res.status).toBe(200);
    expect(res.body.voucher.rejectionReason).toBe(REASON);
  });
});
