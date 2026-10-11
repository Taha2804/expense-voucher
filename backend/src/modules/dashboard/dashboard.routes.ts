import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { authenticate } from '../../middleware/authenticate.js';
import { getStatsController } from './dashboard.controller.js';

export const dashboardRoutes = Router();

// Every role has a dashboard; the payload differs, and the service scopes it.
dashboardRoutes.get('/stats', authenticate, asyncHandler(getStatsController));
