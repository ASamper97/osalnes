/**
 * Shared error handling for Edge Functions.
 *
 * Goal: never leak internal Postgres details (table names, constraint names,
 * column names) to clients. The previous catch-handlers in admin/index.ts
 * and api/index.ts returned `err.message` verbatim — which for any thrown
 * Postgres error meant strings like:
 *
 *   "duplicate key value violates unique constraint \"zona_slug_key\""
 *   "column \"asdf\" of relation \"zona\" does not exist"
 *
 * Those are useful in logs but should never reach a browser.
 */

/**
 * Format any thrown value into a (body, status) tuple safe to send to the
 * client.
 *
 * Three cases:
 *   1. We threw it ourselves with `{status, message}` — pass through unchanged.
 *      Those messages are already user-facing and in Spanish.
 *   2. It's a Postgres error (has `code` field) — log full detail to console
 *      and return a friendly message based on the SQLSTATE code.
 *   3. Anything else — log and return a generic 500.
 */
export function formatError(err: unknown): [Record<string, string>, number] {
  const e = err as { status?: number; message?: string; code?: string; details?: string };

  // Case 1: intentional throw with status (e.g. throw {status: 400, message: '...'})
  if (typeof e.status === 'number') {
    return [{ error: e.message || 'Error' }, e.status];
  }

  // Case 2: Postgres error with SQLSTATE code
  if (typeof e.code === 'string' && e.code.length > 0) {
    console.error('[edge] Postgres error', e.code, e.message, e.details);
    return [{ error: postgresCodeToMessage(e.code) }, postgresCodeToHttpStatus(e.code)];
  }

  // Case 3: anything else
  console.error('[edge] Unhandled error:', err);
  return [{ error: 'Error interno del servidor. Si persiste, contacta con un administrador.' }, 500];
}

/**
 * Map a Postgres SQLSTATE code to a friendly Spanish message.
 * See https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export function postgresCodeToMessage(code: string): string {
  switch (code) {
    case '23505': return 'Ya existe un registro con esos datos. Usa otro identificador.';
    case '23503': return 'No se puede completar la operacion: hay datos relacionados que lo impiden.';
    case '23502': return 'Falta un campo obligatorio.';
    case '23514': return 'Los datos no cumplen las restricciones del modelo.';
    case '22P02': return 'Formato de dato invalido.';
    case '22001': return 'Texto demasiado largo para el campo.';
    case '42703': return 'Campo desconocido en la solicitud.';
    case '42P01': return 'Recurso no disponible.';
    case '42501': return 'Permisos insuficientes para esta operacion.';
    case '40001': return 'Conflicto de concurrencia. Reintenta en unos segundos.';
    case '53300': return 'El servidor esta saturado. Reintenta en unos segundos.';
    default:      return 'Error de base de datos. Si persiste, contacta con un administrador.';
  }
}

export function postgresCodeToHttpStatus(code: string): number {
  switch (code) {
    case '23505': return 409; // Conflict
    case '23503': return 409; // Conflict (FK)
    case '23502':
    case '23514':
    case '22P02':
    case '22001':
    case '42703': return 400; // Bad Request
    case '42501': return 403; // Forbidden
    case '40001': return 409; // Conflict (concurrency)
    case '53300': return 503; // Service Unavailable
    default:      return 500;
  }
}
