import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import {
  approveVoucherSchema,
  createVoucherSchema,
  listVouchersQuerySchema,
  rejectVoucherSchema,
  updateVoucherSchema,
  voucherIdParamSchema,
} from './vouchers.schemas.js';
import {
  approveVoucherController,
  createVoucherController,
  deleteVoucherController,
  getVoucherController,
  listVouchersController,
  rejectVoucherController,
  submitVoucherController,
  updateVoucherController,
} from './vouchers.controller.js';

export const voucherRoutes = Router();

voucherRoutes.use(authenticate);

voucherRoutes.get(
  '/',
  validate({ query: listVouchersQuerySchema }),
  asyncHandler(listVouchersController),
);

voucherRoutes.post(
  '/',
  requireRole('EMPLOYEE'),
  validate({ body: createVoucherSchema }),
  asyncHandler(createVoucherController),
);

voucherRoutes.get(
  '/:id',
  validate({ params: voucherIdParamSchema }),
  asyncHandler(getVoucherController),
);

// Editing, deleting and submitting belong to the employee who raised the
// voucher. The Director reviews; it must not be able to alter what was claimed.
voucherRoutes.patch(
  '/:id',
  requireRole('EMPLOYEE'),
  validate({ params: voucherIdParamSchema, body: updateVoucherSchema }),
  asyncHandler(updateVoucherController),
);

voucherRoutes.delete(
  '/:id',
  requireRole('EMPLOYEE'),
  validate({ params: voucherIdParamSchema }),
  asyncHandler(deleteVoucherController),
);

voucherRoutes.post(
  '/:id/submit',
  requireRole('EMPLOYEE'),
  validate({ params: voucherIdParamSchema }),
  asyncHandler(submitVoucherController),
);

// Only the Director reviews, and only a voucher awaiting approval can move.
voucherRoutes.post(
  '/:id/approve',
  requireRole('DIRECTOR'),
  validate({ params: voucherIdParamSchema, body: approveVoucherSchema }),
  asyncHandler(approveVoucherController),
);

voucherRoutes.post(
  '/:id/reject',
  requireRole('DIRECTOR'),
  validate({ params: voucherIdParamSchema, body: rejectVoucherSchema }),
  asyncHandler(rejectVoucherController),
);
