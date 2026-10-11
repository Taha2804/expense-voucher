import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../lib/errors.js';
import type { PublicUser } from '../auth/auth.service.js';
import {
  createVoucher,
  deleteVoucher,
  getVoucherById,
  listVouchers,
  submitVoucher,
  updateVoucher,
} from './vouchers.service.js';
import type {
  CreateVoucherInput,
  ListVouchersQuery,
  UpdateVoucherInput,
} from './vouchers.schemas.js';

export function currentUser(req: Request): PublicUser {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}

export async function createVoucherController(req: Request, res: Response): Promise<void> {
  const voucher = await createVoucher(currentUser(req), req.body as CreateVoucherInput);
  res.status(201).json({ voucher });
}

export async function listVouchersController(req: Request, res: Response): Promise<void> {
  const result = await listVouchers(currentUser(req), req.query as unknown as ListVouchersQuery);
  res.json(result);
}

export async function getVoucherController(req: Request, res: Response): Promise<void> {
  const voucher = await getVoucherById(currentUser(req), req.params.id as string);
  res.json({ voucher });
}

export async function updateVoucherController(req: Request, res: Response): Promise<void> {
  const voucher = await updateVoucher(
    currentUser(req),
    req.params.id as string,
    req.body as UpdateVoucherInput,
  );
  res.json({ voucher });
}

export async function deleteVoucherController(req: Request, res: Response): Promise<void> {
  await deleteVoucher(currentUser(req), req.params.id as string);
  res.status(204).send();
}

export async function submitVoucherController(req: Request, res: Response): Promise<void> {
  const voucher = await submitVoucher(currentUser(req), req.params.id as string);
  res.json({ voucher });
}
