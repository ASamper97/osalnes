/**
 * Auth helpers for Edge Functions.
 * Verifies Supabase JWT and fetches DTI role from the `usuario` table.
 */
import { getAdminClient } from './supabase.ts';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  active: boolean;
}

/**
 * Verify the JWT from the Authorization header and return the authenticated user.
 * Throws an object with `status` and `message` on failure.
 */
export async function verifyAuth(req: Request): Promise<AuthUser> {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    throw { status: 401, message: 'Missing or invalid Authorization header' };
  }

  const token = header.slice(7);
  const sb = getAdminClient();

  const {
    data: { user },
    error,
  } = await sb.auth.getUser(token);

  if (error || !user) {
    throw { status: 401, message: 'Invalid or expired token' };
  }

  // Fetch DTI role
  const { data: dtiUser } = await sb
    .from('usuario')
    .select('id, rol, activo')
    .eq('email', user.email)
    .single();

  const role = dtiUser?.rol || 'editor';
  const active = dtiUser?.activo ?? true;

  if (!active) {
    throw { status: 403, message: 'User account is deactivated' };
  }

  return { id: user.id, email: user.email!, role, active };
}

/** Throw 403 if the user does not have one of the required roles. */
export function requireRole(user: AuthUser, ...roles: string[]): void {
  if (!roles.includes(user.role)) {
    throw {
      status: 403,
      message: `Acceso denegado. Se requiere rol: ${roles.join(' o ')}`,
    };
  }
}
