import type { Request, Response, NextFunction } from 'express';
import { supabase } from '../db/supabase.js';

/**
 * Express middleware that verifies the Supabase JWT from the Authorization header.
 * Attaches the authenticated user to req.user and fetches the DTI role from the
 * `usuario` table so downstream handlers can check permissions.
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

  // Fetch DTI role from our own usuario table
  const { data: dtiUser } = await supabase
    .from('usuario')
    .select('id, rol, activo')
    .eq('email', user.email)
    .single();

  // Attach user + role to request for downstream handlers
  (req as any).user = user;
  (req as any).userRole = dtiUser?.rol || 'editor';
  (req as any).userActive = dtiUser?.activo ?? true;

  if (dtiUser && !dtiUser.activo) {
    res.status(403).json({ error: 'User account is deactivated' });
    return;
  }

  next();
}

/**
 * Middleware factory that restricts access to specific roles.
 * Usage: adminRouter.delete('/users/:id', requireRole('admin'), asyncHandler(...))
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).userRole as string | undefined;

    if (!userRole || !roles.includes(userRole)) {
      res.status(403).json({
        error: `Acceso denegado. Se requiere rol: ${roles.join(' o ')}`,
      });
      return;
    }

    next();
  };
}
