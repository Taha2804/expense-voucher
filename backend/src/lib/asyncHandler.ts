import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wrap an async route handler so a rejected promise reaches Express's error
 * middleware instead of hanging the request.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
