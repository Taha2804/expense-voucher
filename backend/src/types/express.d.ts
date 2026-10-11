import type { PublicUser } from '../modules/auth/auth.service.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by the authenticate middleware. Absent on unguarded routes. */
      user?: PublicUser;
    }
  }
}

export {};
