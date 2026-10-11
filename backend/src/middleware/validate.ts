import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { ValidationError } from '../lib/errors.js';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Validate the request against Zod schemas and write the parsed values back,
 * so handlers read coerced types and never see a field the schema stripped.
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    for (const part of ['body', 'query', 'params'] as const) {
      const schema = schemas[part];
      if (!schema) continue;

      const result = schema.safeParse(req[part]);
      if (!result.success) {
        next(
          new ValidationError(
            result.error.issues[0]?.message ?? 'Validation failed',
            result.error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
          ),
        );
        return;
      }

      // Express 5 defines req.query as a getter, so assignment needs
      // defineProperty rather than a plain write.
      Object.defineProperty(req, part, { value: result.data, writable: true, configurable: true });
    }

    next();
  };
}
