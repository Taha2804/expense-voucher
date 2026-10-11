import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { readdirSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { resetDb, disconnectDb } from './helpers/db.js';
import { makeUser, makeVoucher } from './helpers/factories.js';
import { loginAs } from './helpers/agent.js';

const app = createApp();

const fixtures = resolve(import.meta.dirname, 'fixtures');
const validPng = resolve(fixtures, 'valid.png');
const notAnImage = resolve(fixtures, 'not-an-image.png');
const emptyPng = resolve(fixtures, 'empty.png');

const uploadDir = resolve(import.meta.dirname, '..', env.UPLOAD_DIR);

/** 3 MB, generated rather than committed. */
const oversize = Buffer.alloc(3 * 1024 * 1024, 0x41);

const UUID_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/;

function filesInUploadDir(): string[] {
  mkdirSync(uploadDir, { recursive: true });
  return readdirSync(uploadDir);
}

describe('signature upload', () => {
  beforeEach(async () => {
    await resetDb();
    rmSync(uploadDir, { recursive: true, force: true });
    mkdirSync(uploadDir, { recursive: true });
  });

  afterAll(async () => {
    await disconnectDb();
  });

  it('POST /api/signatures as an employee returns 201 with the signature id and persists the file', async () => {
    await makeUser({ email: 'aarav@abc.com', role: 'EMPLOYEE' });
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent.post('/api/signatures').attach('image', validPng);

    expect(res.status).toBe(201);
    expect(res.body.signature.id).toBeDefined();
    expect(res.body.signature.mimeType).toBe('image/png');
    expect(filesInUploadDir()).toHaveLength(1);
  });

  it('POST /api/signatures as ACCOUNTS returns 403', async () => {
    await makeUser({ email: 'priya@abc.com', role: 'ACCOUNTS' });
    const agent = await loginAs(app, 'priya@abc.com');

    const res = await agent.post('/api/signatures').attach('image', validPng);

    expect(res.status).toBe(403);
  });

  it('POST /api/signatures with no file returns 400 VALIDATION_ERROR', async () => {
    await makeUser({ email: 'aarav@abc.com' });
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent.post('/api/signatures');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/signatures with a 3 MB file returns 413', async () => {
    await makeUser({ email: 'aarav@abc.com' });
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent
      .post('/api/signatures')
      .attach('image', oversize, { filename: 'big.png', contentType: 'image/png' });

    expect(res.status).toBe(413);
  });

  it('POST /api/signatures with text/plain returns 415', async () => {
    await makeUser({ email: 'aarav@abc.com' });
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent
      .post('/api/signatures')
      .attach('image', Buffer.from('hello'), { filename: 'note.txt', contentType: 'text/plain' });

    expect(res.status).toBe(415);
  });

  it('POST /api/signatures with ZIP bytes named .png and typed image/png returns 415', async () => {
    await makeUser({ email: 'aarav@abc.com' });
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent
      .post('/api/signatures')
      .attach('image', notAnImage, { filename: 'evil.png', contentType: 'image/png' });

    expect(res.status).toBe(415);
  });

  it('POST /api/signatures with a zero-byte .png returns 415', async () => {
    await makeUser({ email: 'aarav@abc.com' });
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent
      .post('/api/signatures')
      .attach('image', emptyPng, { filename: 'empty.png', contentType: 'image/png' });

    expect(res.status).toBe(415);
  });

  it('a rejected upload leaves no file in UPLOAD_DIR', async () => {
    await makeUser({ email: 'aarav@abc.com' });
    const agent = await loginAs(app, 'aarav@abc.com');
    const before = filesInUploadDir().length;

    await agent.post('/api/signatures').attach('image', notAnImage, { filename: 'evil.png', contentType: 'image/png' });
    await agent.post('/api/signatures').attach('image', emptyPng, { filename: 'empty.png', contentType: 'image/png' });
    await agent.post('/api/signatures').attach('image', oversize, { filename: 'big.png', contentType: 'image/png' });
    await agent.post('/api/signatures').attach('image', Buffer.from('x'), { filename: 'n.txt', contentType: 'text/plain' });

    expect(filesInUploadDir()).toHaveLength(before);
  });

  it('stores the file under a UUID name, not the client filename', async () => {
    await makeUser({ email: 'aarav@abc.com' });
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent
      .post('/api/signatures')
      .attach('image', validPng, { filename: '../../etc/passwd.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    const files = filesInUploadDir();
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(UUID_FILENAME);
    expect(files[0]).not.toContain('passwd');
  });
});

describe('signature image access', () => {
  beforeEach(async () => {
    await resetDb();
    rmSync(uploadDir, { recursive: true, force: true });
    mkdirSync(uploadDir, { recursive: true });
  });

  afterAll(async () => {
    await disconnectDb();
  });

  /** Upload a real signature as the given employee and return its id. */
  async function uploadAs(email: string): Promise<string> {
    const agent = await loginAs(app, email);
    const res = await agent.post('/api/signatures').attach('image', validPng);
    return res.body.signature.id as string;
  }

  it('GET /api/signatures/:id/image returns the bytes to the owner', async () => {
    await makeUser({ email: 'aarav@abc.com' });
    const id = await uploadAs('aarav@abc.com');
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent.get(`/api/signatures/${id}/image`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(Buffer.from(res.body)).toEqual(readFileSync(validPng));
  });

  it('GET /api/signatures/:id/image returns 404 to an unrelated employee', async () => {
    await makeUser({ email: 'aarav@abc.com' });
    await makeUser({ email: 'sneha@abc.com' });
    const id = await uploadAs('aarav@abc.com');
    const other = await loginAs(app, 'sneha@abc.com');

    const res = await other.get(`/api/signatures/${id}/image`);

    expect(res.status).toBe(404);
  });

  it('GET /api/signatures/:id/image returns 200 to a DIRECTOR and to ACCOUNTS', async () => {
    await makeUser({ email: 'aarav@abc.com' });
    await makeUser({ email: 'rohan@abc.com', role: 'DIRECTOR' });
    await makeUser({ email: 'priya@abc.com', role: 'ACCOUNTS' });
    const id = await uploadAs('aarav@abc.com');

    const director = await loginAs(app, 'rohan@abc.com');
    const accounts = await loginAs(app, 'priya@abc.com');

    expect((await director.get(`/api/signatures/${id}/image`)).status).toBe(200);
    expect((await accounts.get(`/api/signatures/${id}/image`)).status).toBe(200);
  });

  it('GET /api/signatures/:id/image returns 200 to an employee when it is attached to their own voucher', async () => {
    await makeUser({ email: 'rohan@abc.com', role: 'DIRECTOR' });
    const employee = await makeUser({ email: 'aarav@abc.com' });
    // The Director uploads a real file, so this exercises the whole path and
    // not just the permission check.
    const directorSignatureId = await uploadAs('rohan@abc.com');
    await makeVoucher({
      createdById: employee.id,
      status: 'APPROVED',
      directorSignatureId,
    });

    const agent = await loginAs(app, 'aarav@abc.com');
    const res = await agent.get(`/api/signatures/${directorSignatureId}/image`);

    expect(res.status).toBe(200);
  });

  it('GET /api/signatures/:id/image without a cookie returns 401', async () => {
    await makeUser({ email: 'aarav@abc.com' });
    const id = await uploadAs('aarav@abc.com');

    const res = await request(app).get(`/api/signatures/${id}/image`);

    expect(res.status).toBe(401);
  });

  it('GET /api/signatures/:id/image for an unknown id returns 404', async () => {
    await makeUser({ email: 'aarav@abc.com' });
    const agent = await loginAs(app, 'aarav@abc.com');

    const res = await agent.get('/api/signatures/3f4a8c0e-0000-4000-8000-000000000000/image');

    expect(res.status).toBe(404);
  });
});
