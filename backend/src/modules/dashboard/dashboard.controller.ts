import type { Request, Response } from 'express';
import { UnauthorizedError } from '../../lib/errors.js';
import { getStats } from './dashboard.service.js';

export async function getStatsController(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError();

  const stats = await getStats(req.user);
  res.json({ stats });
}
