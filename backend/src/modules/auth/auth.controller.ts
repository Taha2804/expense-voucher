import type { CookieOptions, Request, Response } from 'express';
import { env, isProduction } from '../../config/env.js';
import { UnauthorizedError } from '../../lib/errors.js';
import { login } from './auth.service.js';
import type { LoginInput } from './auth.schemas.js';

export const TOKEN_COOKIE = 'token';

/**
 * httpOnly keeps the token out of reach of injected scripts; SameSite=Strict
 * means the browser never attaches it to a cross-site request, which is what
 * covers the CSRF exposure cookie auth would otherwise introduce.
 */
const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: isProduction,
  path: '/',
};

function maxAgeMs(): number {
  const match = /^(\d+)([smhd])$/.exec(env.JWT_EXPIRES_IN);
  if (!match) return 8 * 60 * 60 * 1000;
  const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] as 's' | 'm' | 'h' | 'd'];
  return Number(match[1]) * unit;
}

export async function loginController(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as LoginInput;
  const { user, token } = await login(email, password);

  res.cookie(TOKEN_COOKIE, token, { ...cookieOptions, maxAge: maxAgeMs() });
  res.json({ user });
}

export function logoutController(_req: Request, res: Response): void {
  res.clearCookie(TOKEN_COOKIE, cookieOptions);
  res.json({ success: true });
}

export function meController(req: Request, res: Response): void {
  if (!req.user) throw new UnauthorizedError();
  res.json({ user: req.user });
}
