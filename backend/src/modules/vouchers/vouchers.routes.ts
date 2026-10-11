import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import {
  createVoucherSchema,
  listVouchersQuerySchema,
  updateVoucherSchema,
  voucherIdParamSchema,
} from './vouchers.schemas.js';
import {
  createVoucherController,
  deleteVoucherController,
  getVoucherController,
  listVouchersController,
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
