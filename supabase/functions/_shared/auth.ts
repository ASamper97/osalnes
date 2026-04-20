/**
 * Auth helpers for Edge Functions.
 * Verifies Supabase JWT and fetches DTI role from the `usuario` table.
 */
import { getAdminClient } from './supabase.ts';

export interface AuthUser {
  /** Supabase auth.user.id (stable UUID from auth schema) */
  id: string;
  /** usuario.id — the FK target for recurso_turistico.created_by and friends */
  dbId: string;
  email: string;
  role: string;
  active: boolean;
  /** Municipio asignado por defecto al editor local. NULL para admins/analítica. */
  municipioId: string | null;
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

  // Fetch DTI role from the local `usuario` table.
  //
  // Lookup strategy:
  //   1. Prefer `auth_user_id = user.id` — stable UUID, immune to email
  //      changes and case sensitivity. Migration 011 added this column and
  //      backfilled it for existing rows.
  //   2. Fallback to case-insensitive email match — covers legacy rows that
  //      were not backfilled (e.g. invitations created after the migration
  //      but before the user accepted them). On a successful fallback we
  //      opportunistically write the auth_user_id link so the next call
  //      uses the fast path.
  //
  // No bypass: if BOTH lookups fail the request is rejected. Defaulting to
  // 'editor' (the original behaviour) would silently grant content-edit
  // privileges to anyone holding a valid Supabase JWT.

  // Step 1: lookup by stable auth_user_id
  let dtiUser: { id: string; rol: string; activo: boolean; municipio_id: string | null } | null = null;
  {
    const { data } = await sb
      .from('usuario')
      .select('id, rol, activo, municipio_id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    dtiUser = data;
  }

  // Step 2: fallback to case-insensitive email
  if (!dtiUser) {
    if (!user.email) {
      throw { status: 401, message: 'Token sin email asociado' };
    }
    const { data } = await sb
      .from('usuario')
      .select('id, rol, activo, municipio_id')
      .ilike('email', user.email)
      .maybeSingle();
    dtiUser = data;

    // Backfill the link for next time (fire-and-forget — failure is harmless)
    if (dtiUser) {
      sb.from('usuario')
        .update({ auth_user_id: user.id })
        .eq('id', dtiUser.id)
        .then(() => {}, (err: unknown) => {
          console.error('[auth] backfill auth_user_id failed:', err);
        });
    }
  }

  if (!dtiUser) {
    throw {
      status: 403,
      message: 'Tu email no está registrado en el CMS de O Salnés. Pide acceso a un administrador.',
    };
  }

  if (!dtiUser.activo) {
    throw { status: 403, message: 'Tu cuenta está desactivada. Contacta con un administrador.' };
  }

  return {
    id: user.id,
    dbId: dtiUser.id,
    email: user.email || '',
    role: dtiUser.rol,
    active: dtiUser.activo,
    municipioId: dtiUser.municipio_id ?? null,
  };
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
