/**
 * Shared translation helpers — used by both public and admin functions.
 */
import { getAdminClient } from './supabase.ts';

type LocalizedValue = Record<string, string>;

/** Fetch all translations for an entity: { campo: { lang: value } } */
export async function getTranslations(
  entidadTipo: string,
  entidadId: string,
): Promise<Record<string, LocalizedValue>> {
  const sb = getAdminClient();
  const { data, error } = await sb
    .from('traduccion')
    .select('campo, idioma, valor')
    .eq('entidad_tipo', entidadTipo)
    .eq('entidad_id', entidadId);

  if (error) throw error;

  const result: Record<string, LocalizedValue> = {};
  for (const row of data || []) {
    if (!result[row.campo]) result[row.campo] = {};
    result[row.campo][row.idioma] = row.valor;
  }
  return result;
}

/** Fetch a single translated field: { lang: value } */
export async function getTranslatedField(
  entidadTipo: string,
  entidadId: string,
  campo: string,
): Promise<LocalizedValue> {
  const sb = getAdminClient();
  const { data, error } = await sb
    .from('traduccion')
    .select('idioma, valor')
    .eq('entidad_tipo', entidadTipo)
    .eq('entidad_id', entidadId)
    .eq('campo', campo);

  if (error) throw error;

  const result: LocalizedValue = {};
  for (const row of data || []) {
    result[row.idioma] = row.valor;
  }
  return result;
}

/**
 * Upsert translations for a field: { lang: value }
 *
 * - Non-empty values are batch-upserted in a single round trip.
 * - Empty values are explicitly DELETED so a previously stored translation
 *   gets cleared when the user blanks the field. Without this, the old
 *   value would silently linger in the database forever — a real bug,
 *   since the form would re-display the stale value on the next edit.
 */
export async function saveTranslations(
  entidadTipo: string,
  entidadId: string,
  campo: string,
  values: Record<string, string>,
): Promise<void> {
  const sb = getAdminClient();

  const upserts: Array<{
    entidad_tipo: string;
    entidad_id: string;
    campo: string;
    idioma: string;
    valor: string;
  }> = [];
  const langsToDelete: string[] = [];

  for (const [idioma, valor] of Object.entries(values)) {
    if (valor && valor.trim().length > 0) {
      upserts.push({ entidad_tipo: entidadTipo, entidad_id: entidadId, campo, idioma, valor });
    } else {
      langsToDelete.push(idioma);
    }
  }

  // Single batched upsert for non-empty translations
  if (upserts.length > 0) {
    const { error } = await sb
      .from('traduccion')
      .upsert(upserts, { onConflict: 'entidad_tipo,entidad_id,campo,idioma' });
    if (error) throw error;
  }

  // Single batched delete for translations the user explicitly cleared
  if (langsToDelete.length > 0) {
    const { error } = await sb
      .from('traduccion')
      .delete()
      .eq('entidad_tipo', entidadTipo)
      .eq('entidad_id', entidadId)
      .eq('campo', campo)
      .in('idioma', langsToDelete);
    if (error) throw error;
  }
}
