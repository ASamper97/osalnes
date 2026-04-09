/**
 * Shared zona helpers used by both the admin and the public api Edge
 * Functions. Lives here so the listing logic, the response shape and the
 * batched translation query exist in exactly one place.
 *
 * Resolves audit findings:
 *   A7 — listZones was duplicated in admin/index.ts and api/index.ts.
 *   P1 — both copies did N+1 queries (1 + 1-per-zone for translations).
 *
 * Performance note
 * ----------------
 * The previous implementation called getTranslatedField('zona', z.id, 'name')
 * inside `Promise.all((zonas || []).map(...))`, which fired one SELECT per
 * zone against the `traduccion` table. For 100 zones that's 101 round trips.
 * The new implementation runs a single `IN (...)` query for all translations
 * and groups them in memory, so it's always exactly 2 round trips
 * regardless of how many zones exist.
 */

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface ZoneListItem {
  id: string;
  slug: string;
  municipioId: string;
  name: Record<string, string>;
  /** ISO 8601 timestamp. Used by the optimistic concurrency check (DF3). */
  updatedAt: string;
}

/**
 * Fetch zones (optionally filtered by municipio) plus their multilingual
 * names in two batched queries.
 *
 * NOTE on DF4: this helper currently returns ALL zones. When/if a future
 * `zona.activo` column is introduced (audit F6), the public listZones path
 * (api/index.ts) must add `.eq('activo', true)` here so unpublished zones
 * are not exposed via the public endpoint. The admin path can keep showing
 * everything because admins need to manage drafts.
 */
export async function listZones(
  sb: SupabaseClient,
  municipio?: string,
): Promise<ZoneListItem[]> {
  // Step 1: zones table — include updated_at for optimistic concurrency
  let query = sb
    .from('zona')
    .select('id, slug, municipio_id, updated_at')
    .order('slug');
  if (municipio) query = query.eq('municipio_id', municipio);

  const { data: zonas, error: zErr } = await query;
  if (zErr) throw zErr;
  if (!zonas || zonas.length === 0) return [];

  // Step 2: ALL translations for ALL the zones above, in a single query
  const ids = zonas.map((z: { id: string }) => z.id);
  const { data: trans, error: tErr } = await sb
    .from('traduccion')
    .select('entidad_id, idioma, valor')
    .eq('entidad_tipo', 'zona')
    .eq('campo', 'name')
    .in('entidad_id', ids);

  if (tErr) throw tErr;

  // Group translations by zone id
  const namesByZone: Record<string, Record<string, string>> = {};
  for (const t of trans || []) {
    if (!namesByZone[t.entidad_id]) namesByZone[t.entidad_id] = {};
    namesByZone[t.entidad_id][t.idioma] = t.valor;
  }

  return zonas.map((z: { id: string; slug: string; municipio_id: string; updated_at: string }) => ({
    id: z.id,
    slug: z.slug,
    municipioId: z.municipio_id,
    name: namesByZone[z.id] || {},
    updatedAt: z.updated_at,
  }));
}
