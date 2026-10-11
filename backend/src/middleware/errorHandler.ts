import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

function body(code: string, message: string, details?: unknown): ErrorBody {
  return details === undefined ? { error: { code, message } } : { error: { code, message, details } };
}

/**
 * The single place an error becomes a response. Mounted last, after every
 * route. Anything it does not recognise is logged with its stack and returned
 * as a generic 500, so internal messages never reach a client.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(body(err.code, err.message, err.details));
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json(
      body(
        'VALIDATION_ERROR',
        'Validation failed',
        err.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      ),
    );
    return;
  }

  console.error('Unhandled error:', err instanceof Error ? err.stack : err);
  res.status(500).json(body('INTERNAL_ERROR', 'An unexpected error occurred'));
};
