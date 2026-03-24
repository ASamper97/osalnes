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

/** Upsert translations for a field: { lang: value } */
export async function saveTranslations(
  entidadTipo: string,
  entidadId: string,
  campo: string,
  values: Record<string, string>,
): Promise<void> {
  const sb = getAdminClient();
  for (const [idioma, valor] of Object.entries(values)) {
    if (!valor) continue;
    await sb
      .from('traduccion')
      .upsert(
        { entidad_tipo: entidadTipo, entidad_id: entidadId, campo, idioma, valor },
        { onConflict: 'entidad_tipo,entidad_id,campo,idioma' },
      );
  }
}
