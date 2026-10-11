import type { RequestHandler } from 'express';
import type { Role } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';

/**
 * Role gate, kept separate from authenticate so each route's definition reads
 * as an explicit permission statement.
 */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError('Your role does not permit this action'));
      return;
    }

    next();
  };
}
