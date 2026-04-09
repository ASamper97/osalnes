/**
 * Shared translation helpers — used by both public and admin functions.
 */
import { getAdminClient } from './supabase.ts';
import { sanitizeHtml, sanitizeText } from './sanitize.ts';

type LocalizedValue = Record<string, string>;

/**
 * Fields that contain HTML (from RichTextEditor) and need full HTML
 * sanitization. Anything not in this set gets the strict text sanitizer.
 *
 * Audit S7 — sanitize at the persistence boundary so the DB never stores
 * hostile markup, regardless of which Edge Function is calling
 * saveTranslations.
 */
const HTML_FIELDS = new Set([
  'description',  // recurso_turistico, producto_turistico
  'body',         // pagina (rich content)
]);

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

  // S7 — sanitize at the boundary. HTML fields go through the allowlist
  // sanitizer; plain-text fields get all tags stripped (defensive, in case
  // someone sends `<script>` in a name).
  const isHtmlField = HTML_FIELDS.has(campo);

  for (const [idioma, rawValor] of Object.entries(values)) {
    const valor = isHtmlField ? sanitizeHtml(rawValor) : sanitizeText(rawValor);
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
