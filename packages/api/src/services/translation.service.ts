import { supabase } from '../db/supabase.js';

type LocalizedValue = Record<string, string>;

/**
 * Fetch all translations for a given entity as a { [campo]: { [lang]: value } } map.
 */
export async function getTranslations(
  entidadTipo: string,
  entidadId: string,
): Promise<Record<string, LocalizedValue>> {
  const { data, error } = await supabase
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

/**
 * Fetch a single translated field for an entity, returning { [lang]: value }.
 */
export async function getTranslatedField(
  entidadTipo: string,
  entidadId: string,
  campo: string,
): Promise<LocalizedValue> {
  const { data, error } = await supabase
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
