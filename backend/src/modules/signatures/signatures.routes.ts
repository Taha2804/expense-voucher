import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/requireRole.js';
import { uploadSignature } from '../../middleware/upload.js';
import {
  getSignatureImageController,
  uploadSignatureController,
} from './signatures.controller.js';

export const signatureRoutes = Router();

// Only people who sign vouchers upload a signature. Accounts never does.
signatureRoutes.post(
  '/',
  authenticate,
  requireRole('EMPLOYEE', 'DIRECTOR'),
  uploadSignature,
  asyncHandler(uploadSignatureController),
);

signatureRoutes.get('/:id/image', authenticate, asyncHandler(getSignatureImageController));
