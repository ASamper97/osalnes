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
