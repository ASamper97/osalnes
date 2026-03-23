import type { Request, Response, NextFunction } from 'express';
import { supabase } from '../db/supabase.js';

/**
 * Express middleware that verifies the Supabase JWT from the Authorization header.
 * Attaches the authenticated user to req.user.
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = header.slice(7);

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  // Attach user to request for downstream handlers
  (req as any).user = user;
  next();
}
