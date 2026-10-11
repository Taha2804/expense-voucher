import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { loginSchema } from './auth.schemas.js';
import { loginController, logoutController, meController } from './auth.controller.js';

export const authRoutes = Router();

authRoutes.post('/login', validate({ body: loginSchema }), asyncHandler(loginController));
authRoutes.post('/logout', logoutController);
authRoutes.get('/me', authenticate, meController);
