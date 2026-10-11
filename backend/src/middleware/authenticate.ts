import type { RequestHandler } from 'express';
import { prisma } from '../lib/prisma.js';
import { UnauthorizedError } from '../lib/errors.js';
import { TOKEN_COOKIE } from '../modules/auth/auth.controller.js';
import { toPublicUser, verifyToken } from '../modules/auth/auth.service.js';

/**
 * Verify the session cookie and attach the user.
 *
 * The user is loaded from the database on every request rather than trusted
 * from the token body: a token stays valid for eight hours, and the account it
 * names may have been removed or had its role changed in the meantime.
 */
export const authenticate: RequestHandler = (req, _res, next) => {
  const token = (req.cookies as Record<string, string | undefined>)?.[TOKEN_COOKIE];

  if (!token) {
    next(new UnauthorizedError());
    return;
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    next(new UnauthorizedError('Your session is invalid or has expired'));
    return;
  }

  prisma.user
    .findUnique({ where: { id: payload.sub } })
    .then((user) => {
      if (!user) {
        next(new UnauthorizedError('Your session is invalid or has expired'));
        return;
      }
      req.user = toPublicUser(user);
      next();
    })
    .catch(next);
};
