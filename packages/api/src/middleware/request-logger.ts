import type { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger.js';

/**
 * HTTP request/response logging middleware.
 * Logs method, path, status, and duration for every request.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  // Log on response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const meta: Record<string, unknown> = {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: duration,
      ip: req.ip || req.socket.remoteAddress,
    };

    // Include user info if authenticated
    if ((req as any).userRole) {
      meta.userRole = (req as any).userRole;
    }

    if (res.statusCode >= 500) {
      logger.error(`${req.method} ${req.originalUrl} ${res.statusCode}`, meta);
    } else if (res.statusCode >= 400) {
      logger.warn(`${req.method} ${req.originalUrl} ${res.statusCode}`, meta);
    } else {
      logger.info(`${req.method} ${req.originalUrl} ${res.statusCode}`, meta);
    }
  });

  next();
}
