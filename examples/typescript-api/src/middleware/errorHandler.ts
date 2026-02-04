import type { Request, Response, NextFunction } from 'express';

/**
 * Centralized error handling middleware
 * All routes use this for consistent error responses
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error('Error:', err);

  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode).json({
    error: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
}
