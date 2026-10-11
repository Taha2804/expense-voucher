import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import {
  createVoucherSchema,
  listVouchersQuerySchema,
  voucherIdParamSchema,
} from './vouchers.schemas.js';
import {
  createVoucherController,
  getVoucherController,
  listVouchersController,
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
