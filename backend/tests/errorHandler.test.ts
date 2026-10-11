import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { asyncHandler } from '../src/lib/asyncHandler.js';
import { ForbiddenError, ConflictError } from '../src/lib/errors.js';

/** A bare app carrying only the routes a test needs plus the error handler. */
function appWith(mount: (app: express.Express) => void): express.Express {
  const app = express();
  mount(app);
  app.use(errorHandler);
  return app;
}

describe('errorHandler', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('maps AppError subclasses to their status code and code', async () => {
    const app = appWith((a) => {
      a.get('/forbidden', () => {
        throw new ForbiddenError('nope');
      });
      a.get('/conflict', () => {
        throw new ConflictError('already reviewed');
      });
    });

    const forbidden = await request(app).get('/forbidden');
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
    expect(forbidden.body.error.message).toBe('nope');

    const conflict = await request(app).get('/conflict');
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('CONFLICT');
    expect(conflict.body.error.message).toBe('already reviewed');
  });

  it('maps ZodError to 400 VALIDATION_ERROR with details array', async () => {
    const schema = z.object({ amount: z.string() });
    const app = appWith((a) => {
      a.get('/zod', () => {
        schema.parse({ amount: 12 });
      });
    });

    const res = await request(app).get('/zod');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.details[0].path).toEqual(['amount']);
  });

  it('maps an unknown Error to 500 INTERNAL_ERROR and does not leak the message', async () => {
    const app = appWith((a) => {
      a.get('/boom', () => {
        throw new Error('secret internals leaked');
      });
    });

    const res = await request(app).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.error.message).not.toBe('secret internals leaked');
    expect(JSON.stringify(res.body)).not.toContain('secret internals leaked');
  });

  it('forwards a rejected async handler to the error middleware', async () => {
    const app = appWith((a) => {
      a.get(
        '/async',
        asyncHandler(async () => {
          throw new ForbiddenError('async nope');
        }),
      );
    });

    const res = await request(app).get('/async');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
