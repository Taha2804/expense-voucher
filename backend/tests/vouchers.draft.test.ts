import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import type { User, VoucherStatus } from '@prisma/client';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetDb, disconnectDb } from './helpers/db.js';
import { makeUser, makeVoucher, makeSignature } from './helpers/factories.js';
import { loginAs } from './helpers/agent.js';

const app = createApp();

let aarav: User;
let sneha: User;

beforeEach(async () => {
  await resetDb();
  aarav = await makeUser({ email: 'aarav@abc.com', department: 'Engineering' });
  sneha = await makeUser({ email: 'sneha@abc.com', department: 'Sales' });
  await makeUser({ email: 'rohan@abc.com', role: 'DIRECTOR' });
});

afterAll(async () => {
  await disconnectDb();
});

describe('PATCH /api/vouchers/:id', () => {
  it('updates a DRAFT voucher owned by the caller', async () => {
    const voucher = await makeVoucher({ createdById: aarav.id, title: 'Old title' });
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent
      .patch(`/api/vouchers/${voucher.id}`)
      .send({ title: 'New title', amount: '99.50' });

    expect(res.status).toBe(200);
    expect(res.body.voucher.title).toBe('New title');
    expect(res.body.voucher.amount).toBe('99.50');
  });

  it('cannot change voucherNumber, status, createdById, or any approval field', async () => {
    const voucher = await makeVoucher({ createdById: aarav.id });
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent.patch(`/api/vouchers/${voucher.id}`).send({
      title: 'Still editable',
      voucherNumber: 'VCH-0000-000001',
      status: 'APPROVED',
      createdById: sneha.id,
      approvalDate: new Date().toISOString(),
      rejectionReason: 'nope',
      directorSignatureId: '3f4a8c0e-0000-4000-8000-000000000000',
      reviewedById: sneha.id,
    });

    expect(res.status).toBe(200);
    expect(res.body.voucher.voucherNumber).toBe(voucher.voucherNumber);
    expect(res.body.voucher.status).toBe('DRAFT');
    expect(res.body.voucher.createdBy.id).toBe(aarav.id);
    expect(res.body.voucher.approvalDate).toBeNull();
    expect(res.body.voucher.rejectionReason).toBeNull();
    expect(res.body.voucher.directorSignatureId).toBeNull();
    expect(res.body.voucher.reviewedBy).toBeNull();
  });

  it.each(['PENDING_APPROVAL', 'APPROVED', 'REJECTED'] as VoucherStatus[])(
    'on a %s voucher returns 409',
    async (status) => {
      const voucher = await makeVoucher({ createdById: aarav.id, status });
      const agent = await loginAs(app, 'aarav@abc.com');

      const res = await agent.patch(`/api/vouchers/${voucher.id}`).send({ title: 'Nope' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    },
  );

  it("on another employee's draft returns 404", async () => {
    const voucher = await makeVoucher({ createdById: sneha.id });
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent.patch(`/api/vouchers/${voucher.id}`).send({ title: 'Mine now' });

    expect(res.status).toBe(404);
  });

  it('as DIRECTOR returns 403', async () => {
    const voucher = await makeVoucher({ createdById: aarav.id });
    const director = await loginAs(app, 'rohan@abc.com');

    const res = await director.patch(`/api/vouchers/${voucher.id}`).send({ amount: '1.00' });

    expect(res.status).toBe(403);
  });

  it('can attach an employeeSignatureId the caller owns and rejects one they do not', async () => {
    const voucher = await makeVoucher({ createdById: aarav.id });
    const mine = await makeSignature(aarav.id);
    const theirs = await makeSignature(sneha.id);
    const agent = await loginAs(app, 'aarav@abc.com');

    const ok = await agent
      .patch(`/api/vouchers/${voucher.id}`)
      .send({ employeeSignatureId: mine.id });
    expect(ok.status).toBe(200);
    expect(ok.body.voucher.employeeSignatureId).toBe(mine.id);

    const denied = await agent
      .patch(`/api/vouchers/${voucher.id}`)
      .send({ employeeSignatureId: theirs.id });
    expect(denied.status).toBe(403);
  });
});

describe('DELETE /api/vouchers/:id', () => {
  it('removes a DRAFT owned by the caller and returns 204', async () => {
    const voucher = await makeVoucher({ createdById: aarav.id });
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent.delete(`/api/vouchers/${voucher.id}`);

    expect(res.status).toBe(204);
    expect(await prisma.voucher.findUnique({ where: { id: voucher.id } })).toBeNull();
  });

  it('on a non-DRAFT voucher returns 409', async () => {
    const voucher = await makeVoucher({ createdById: aarav.id, status: 'APPROVED' });
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent.delete(`/api/vouchers/${voucher.id}`);

    expect(res.status).toBe(409);
    expect(await prisma.voucher.findUnique({ where: { id: voucher.id } })).not.toBeNull();
  });

  it("on another employee's draft returns 404", async () => {
    const voucher = await makeVoucher({ createdById: sneha.id });
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent.delete(`/api/vouchers/${voucher.id}`);

    expect(res.status).toBe(404);
    expect(await prisma.voucher.findUnique({ where: { id: voucher.id } })).not.toBeNull();
  });
});

describe('POST /api/vouchers/:id/submit', () => {
  it('with an employee signature moves DRAFT to PENDING_APPROVAL and sets submittedAt', async () => {
    const signature = await makeSignature(aarav.id);
    const voucher = await makeVoucher({ createdById: aarav.id, employeeSignatureId: signature.id });
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent.post(`/api/vouchers/${voucher.id}/submit`);

    expect(res.status).toBe(200);
    expect(res.body.voucher.status).toBe('PENDING_APPROVAL');
    expect(res.body.voucher.submittedAt).not.toBeNull();
  });

  it('without employeeSignatureId returns 400 and leaves the status DRAFT', async () => {
    const voucher = await makeVoucher({ createdById: aarav.id });
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent.post(`/api/vouchers/${voucher.id}/submit`);

    expect(res.status).toBe(400);
    const after = await prisma.voucher.findUnique({ where: { id: voucher.id } });
    expect(after?.status).toBe('DRAFT');
  });

  it('twice returns 409 on the second call', async () => {
    const signature = await makeSignature(aarav.id);
    const voucher = await makeVoucher({ createdById: aarav.id, employeeSignatureId: signature.id });
    const agent = await loginAs(app, 'aarav@abc.com');

    expect((await agent.post(`/api/vouchers/${voucher.id}/submit`)).status).toBe(200);
    expect((await agent.post(`/api/vouchers/${voucher.id}/submit`)).status).toBe(409);
  });

  it('with a signature owned by another user returns 403', async () => {
    const theirs = await makeSignature(sneha.id);
    const voucher = await makeVoucher({ createdById: aarav.id, employeeSignatureId: theirs.id });
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent.post(`/api/vouchers/${voucher.id}/submit`);

    expect(res.status).toBe(403);
  });
});
