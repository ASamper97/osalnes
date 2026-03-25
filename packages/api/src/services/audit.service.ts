import { supabase } from '../db/supabase.js';

type Accion = 'crear' | 'modificar' | 'eliminar' | 'publicar' | 'archivar';

/**
 * Inserts a row into log_cambios for UNE 178502 sec. 6.4 traceability.
 * Fire-and-forget: errors are logged but never block the main operation.
 */
export async function log(
  entidadTipo: string,
  entidadId: string,
  accion: Accion,
  usuarioId: string | null,
  cambios?: Record<string, unknown>,
) {
  try {
    await supabase.from('log_cambios').insert({
      entidad_tipo: entidadTipo,
      entidad_id: entidadId,
      accion,
      usuario_id: usuarioId,
      cambios: cambios || null,
    });
  } catch (err) {
    console.error('[audit] Failed to write log_cambios:', err);
  }
}
