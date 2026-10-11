import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { Role, User } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { UnauthorizedError } from '../../lib/errors.js';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  employeeCode: string | null;
  department: string | null;
  role: Role;
}

export interface TokenPayload {
  sub: string;
  email: string;
  role: Role;
}

/**
 * A bcrypt hash of a value nobody can supply. Compared against when the email
 * is unknown, so a missing account and a wrong password take comparable time
 * and the endpoint does not leak which accounts exist.
 */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.5cRk/3SBMLMOIKDE4VByCfhprCbUHGy';

/** The same message for both failure modes, for the same reason. */
const INVALID_CREDENTIALS = 'Invalid email or password';

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    employeeCode: user.employeeCode,
    department: user.department,
    role: user.role,
  };
}

export function signToken(user: PublicUser): string {
  const payload: TokenPayload = { sub: user.id, email: user.email, role: user.role };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
}

export async function login(
  email: string,
  password: string,
): Promise<{ user: PublicUser; token: string }> {
  const user = await prisma.user.findUnique({ where: { email } });
  const matches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !matches) {
    throw new UnauthorizedError(INVALID_CREDENTIALS);
  }

  const publicUser = toPublicUser(user);
  return { user: publicUser, token: signToken(publicUser) };
}
