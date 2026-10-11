import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { NotFoundError } from './lib/errors.js';
import { errorHandler } from './middleware/errorHandler.js';

/**
 * Build the Express application. Separate from server.ts so the test suite can
 * mount it with Supertest without binding a port.
 */
export function createApp(): Express {
  const app = express();

  // Signature images are streamed from this origin and rendered in <img>
  // tags, so the default cross-origin resource policy would block them.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Module routers are mounted here as later tasks add them.

  app.use((req) => {
    throw new NotFoundError(`Cannot ${req.method} ${req.path}`);
  });

  app.use(errorHandler);

  return app;
}
