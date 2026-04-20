/**
 * Helpers para persistir/leer etiquetas UNE 178503 (tabla `resource_tags`).
 *
 * El CMS tiene sesión Supabase Auth viva (ver `lib/api.ts` → getAuthHeaders).
 * Las policies añadidas por la migración 018 dan acceso total al role
 * `authenticated` (policy `resource_tags_rw_authed`), así que estas funciones
 * se llaman directamente con el client anon + bearer JWT — sin pasar por
 * la Edge Function `admin`.
 *
 * Fuente de verdad del catálogo: packages/shared/src/data/tag-catalog.ts
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { TAGS_BY_KEY } from '@osalnes/shared/data/tag-catalog';

/**
 * Sincroniza las etiquetas de un recurso con el array `keys` dado.
 *
 * Estrategia: delete-all + insert. Para volúmenes bajos (máx ~30 tags
 * por recurso) es correcto y atómico desde la perspectiva del editor.
 * Si en el futuro escala, mover a diff (detectar added/removed y solo
 * aplicar esos).
 *
 * Claves del catálogo que no existan en TAGS_BY_KEY se ignoran silenciosamente.
 * Esto protege contra tag keys obsoletas tras actualizar el catálogo.
 */
export async function saveResourceTags(
  supabase: SupabaseClient,
  resourceId: string,
  keys: string[],
): Promise<void> {
  const { error: delError } = await supabase
    .from('resource_tags')
    .delete()
    .eq('resource_id', resourceId);
  if (delError) throw delError;

  if (keys.length === 0) return;

  const rows = keys
    .map((k) => TAGS_BY_KEY[k])
    .filter((t): t is NonNullable<typeof t> => !!t)
    .map((t) => ({
      resource_id: resourceId,
      tag_key: t.key,
      field: t.field,
      value: t.value,
      pid_exportable: t.pidExportable,
      source: 'manual',
    }));

  if (rows.length === 0) return;

  const { error } = await supabase.from('resource_tags').insert(rows);
  if (error) throw error;
}

/**
 * Carga las `tag_key` asociadas a un recurso. Devuelve array vacío si no hay
 * o si el recurso no existe (el caller decide qué hacer).
 */
export async function loadResourceTags(
  supabase: SupabaseClient,
  resourceId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('resource_tags')
    .select('tag_key')
    .eq('resource_id', resourceId);
  if (error) throw error;
  return (data ?? []).map((row) => row.tag_key as string);
}

/**
 * Resumen PID por recurso — alimenta la columna "Completitud PID" del
 * listado (Lote 2 rediseño). Una sola query con IN (ids), tolerante a
 * error (devuelve mapa vacío → columna se rinde a "sin datos", no rompe).
 */
export interface PidSummary {
  /** Total de tags marcadas pid_exportable=true */
  pidCount: number;
  /** Tiene al menos una tag con field='type' */
  hasType: boolean;
  /** Tiene al menos una tag con field='addressLocality' (municipio) */
  hasLocality: boolean;
}

export async function loadResourcesPidSummary(
  supabase: SupabaseClient,
  resourceIds: string[],
): Promise<Record<string, PidSummary>> {
  const out: Record<string, PidSummary> = {};
  if (resourceIds.length === 0) return out;
  for (const id of resourceIds) out[id] = { pidCount: 0, hasType: false, hasLocality: false };

  const { data, error } = await supabase
    .from('resource_tags')
    .select('resource_id, field, pid_exportable')
    .in('resource_id', resourceIds);
  if (error) return out;

  for (const row of data ?? []) {
    const s = out[row.resource_id as string];
    if (!s) continue;
    if (row.pid_exportable) s.pidCount++;
    if (row.field === 'type') s.hasType = true;
    if (row.field === 'addressLocality') s.hasLocality = true;
  }
  return out;
}

export type PidStatus = 'ready' | 'partial' | 'incomplete';

/**
 * Reglas coherentes con PidCompletenessCard del wizard (Tarea 5):
 * - incomplete: falta `type` o falta `addressLocality` (mínimos obligatorios).
 * - partial: tiene los dos pero menos de 5 tags PID exportables en total.
 * - ready: ambos mínimos + ≥5 tags PID.
 */
export function pidStatus(summary: PidSummary | undefined): PidStatus {
  if (!summary || !summary.hasType || !summary.hasLocality) return 'incomplete';
  if (summary.pidCount < 5) return 'partial';
  return 'ready';
}
