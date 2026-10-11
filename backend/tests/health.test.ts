import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('health and 404 handling', () => {
  it('GET /api/health returns 200 and { status: "ok" }', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/unknown returns 404 with error.code NOT_FOUND', async () => {
    const res = await request(app).get('/api/unknown');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
