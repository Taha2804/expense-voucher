import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { authenticate } from '../src/middleware/authenticate.js';
import { requireRole } from '../src/middleware/requireRole.js';
import { authRoutes } from '../src/modules/auth/auth.routes.js';
import { resetDb, disconnectDb } from './helpers/db.js';
import { makeUser, DEFAULT_PASSWORD } from './helpers/factories.js';
import { loginAs } from './helpers/agent.js';

const app = createApp();

/** A bare app exposing a route guarded by requireRole, alongside real login. */
function probeApp(): express.Express {
  const probe = express();
  probe.use(express.json());
  probe.use(cookieParser());
  probe.use('/api/auth', authRoutes);
  probe.get('/api/probe/director', authenticate, requireRole('DIRECTOR'), (_req, res) => {
    res.json({ ok: true });
  });
  probe.use(errorHandler);
  return probe;
}

describe('authentication', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await disconnectDb();
  });

  it('POST /api/auth/login with valid credentials returns 200, the user, and sets an httpOnly token cookie', async () => {
    await makeUser({ email: 'aarav@abc.com', name: 'Aarav Sharma', role: 'EMPLOYEE' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'aarav@abc.com', password: DEFAULT_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('aarav@abc.com');
    expect(res.body.user.role).toBe('EMPLOYEE');
    expect(res.body.user.passwordHash).toBeUndefined();

    const cookies = res.headers['set-cookie'] as unknown as string[];
    const tokenCookie = cookies.find((c) => c.startsWith('token='));
    expect(tokenCookie).toBeDefined();
    expect(tokenCookie).toContain('HttpOnly');
    expect(tokenCookie).toContain('SameSite=Strict');
  });

  it('POST /api/auth/login with a wrong password returns 401 UNAUTHORIZED', async () => {
    await makeUser({ email: 'aarav@abc.com' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'aarav@abc.com', password: 'WrongPassword1!' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/auth/login with an unknown email returns 401 with the same message as a wrong password', async () => {
    await makeUser({ email: 'aarav@abc.com' });

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: 'aarav@abc.com', password: 'WrongPassword1!' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@abc.com', password: DEFAULT_PASSWORD });

    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body.error.message).toBe(wrongPassword.body.error.message);
  });

  it('POST /api/auth/login with a malformed body returns 400 VALIDATION_ERROR', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/auth/me without a cookie returns 401', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/auth/me with the login cookie returns the current user', async () => {
    await makeUser({ email: 'aarav@abc.com', name: 'Aarav Sharma', employeeCode: 'EMP-001' });
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent.get('/api/auth/me');

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      email: 'aarav@abc.com',
      name: 'Aarav Sharma',
      employeeCode: 'EMP-001',
      role: 'EMPLOYEE',
    });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('GET /api/auth/me with an expired token returns 401', async () => {
    const user = await makeUser({ email: 'aarav@abc.com' });
    const expired = jwt.sign({ sub: user.id, role: user.role, email: user.email }, env.JWT_SECRET, {
      expiresIn: '-1h',
    });

    const res = await request(app).get('/api/auth/me').set('Cookie', [`token=${expired}`]);

    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me with a token signed by a different secret returns 401', async () => {
    const user = await makeUser({ email: 'aarav@abc.com' });
    const forged = jwt.sign(
      { sub: user.id, role: user.role, email: user.email },
      'a-completely-different-secret-of-sufficient-length',
      { expiresIn: '8h' },
    );

    const res = await request(app).get('/api/auth/me').set('Cookie', [`token=${forged}`]);

    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me with a valid token for a deleted user returns 401', async () => {
    const user = await makeUser({ email: 'ghost@abc.com' });
    const token = jwt.sign({ sub: user.id, role: user.role, email: user.email }, env.JWT_SECRET, {
      expiresIn: '8h',
    });
    await resetDb();

    const res = await request(app).get('/api/auth/me').set('Cookie', [`token=${token}`]);

    expect(res.status).toBe(401);
  });

  it('POST /api/auth/logout clears the cookie and a subsequent /me returns 401', async () => {
    await makeUser({ email: 'aarav@abc.com' });
    const agent = await loginAs(app, 'aarav@abc.com');

    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(200);

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(401);
  });
});

describe('requireRole', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await disconnectDb();
  });

  it('returns 403 for a wrong-role user and 200 for an allowed one', async () => {
    const probe = probeApp();
    await makeUser({ email: 'aarav@abc.com', role: 'EMPLOYEE' });
    await makeUser({ email: 'rohan@abc.com', role: 'DIRECTOR' });

    const employee = await loginAs(probe, 'aarav@abc.com');
    const director = await loginAs(probe, 'rohan@abc.com');

    const denied = await employee.get('/api/probe/director');
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');

    const allowed = await director.get('/api/probe/director');
    expect(allowed.status).toBe(200);
    expect(allowed.body.ok).toBe(true);
  });
});
