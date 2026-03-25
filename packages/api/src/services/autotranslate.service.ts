import { supabase } from '../db/supabase.js';

/**
 * Target languages for auto-translation.
 * Source language (usually 'es') is excluded automatically.
 */
const TARGET_LANGUAGES = ['es', 'gl', 'en', 'fr', 'pt'];

/**
 * Enqueue translation jobs for a field that was just saved.
 * Called from resource/page/category services after saveTranslations().
 *
 * - Detects which language was provided as source
 * - Creates jobs for missing target languages only
 * - Idempotent: duplicate jobs are ignored via UNIQUE constraint
 * - Fire-and-forget: errors don't block the main operation
 */
export async function enqueueTranslations(
  entidadTipo: string,
  entidadId: string,
  campo: string,
  values: Record<string, string>,
) {
  try {
    // Determine source language (first non-empty, preferring ES)
    let sourceText = '';
    let sourceLang = 'es';

    if (values.es) {
      sourceText = values.es;
      sourceLang = 'es';
    } else if (values.gl) {
      sourceText = values.gl;
      sourceLang = 'gl';
    } else {
      const first = Object.entries(values).find(([, v]) => v?.trim());
      if (!first) return; // nothing to translate
      sourceLang = first[0];
      sourceText = first[1];
    }

    if (!sourceText.trim()) return;

    // Only enqueue for languages that don't already have a value
    const targetLangs = TARGET_LANGUAGES.filter(
      (lang) => lang !== sourceLang && !values[lang]?.trim(),
    );

    if (targetLangs.length === 0) return;

    // Insert jobs (ignore duplicates via ON CONFLICT)
    const jobs = targetLangs.map((lang) => ({
      entidad_tipo: entidadTipo,
      entidad_id: entidadId,
      campo,
      idioma_origen: sourceLang,
      idioma_destino: lang,
      texto_origen: sourceText,
      estado: 'pendiente',
    }));

    await supabase
      .from('translation_job')
      .upsert(jobs, { onConflict: 'entidad_tipo,entidad_id,campo,idioma_destino,estado' })
      .then(() => {}, (err) => console.error('[autotranslate] Enqueue error:', err));

  } catch (err) {
    // Fire-and-forget — never block the main operation
    console.error('[autotranslate] Error:', err);
  }
}
