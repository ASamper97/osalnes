/**
 * useResourcesList — hook principal del listado (SCR-03)
 *
 * Gestiona:
 *   - Estado de filtros, orden, paginación
 *   - Llamada debounced a RPC list_resources
 *   - Persistencia de filtros en URL (query params)
 *   - KPIs agregados independientes
 *   - Callback refetch() para refrescar tras acción (duplicar, cambiar estado)
 *
 * La persistencia en URL permite:
 *   - Compartir link con filtros aplicados
 *   - Botón atrás del navegador restaura filtros
 *   - F5 no pierde el contexto
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type ListResourceRow,
  type ListFilters,
  type ListSort,
  type ListPagination,
  type ListKpis,
  EMPTY_FILTERS,
  DEFAULT_SORT,
  DEFAULT_PAGINATION,
  EMPTY_KPIS,
} from '@osalnes/shared/data/resources-list';

// ─── Cliente Supabase abstracto ────────────────────────────────────────
//
// El hook no importa `@supabase/supabase-js` directamente — recibe un
// cliente compatible desde el padre. Esto evita acoplamiento y facilita
// el test.

export interface SupabaseLike {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

export interface UseResourcesListOptions {
  supabase: SupabaseLike;
  currentUserId: string | null;
  /** Sincronizar con la URL (recomendado). Si false, estado solo en memoria. */
  syncWithUrl?: boolean;
}

export interface UseResourcesListState {
  rows: ListResourceRow[];
  totalCount: number;
  kpis: ListKpis;

  filters: ListFilters;
  setFilters: (f: ListFilters) => void;
  updateFilter: <K extends keyof ListFilters>(key: K, value: ListFilters[K]) => void;

  sort: ListSort;
  setSort: (s: ListSort) => void;

  pagination: ListPagination;
  setPagination: (p: ListPagination) => void;

  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useResourcesList({
  supabase,
  currentUserId,
  syncWithUrl = true,
}: UseResourcesListOptions): UseResourcesListState {
  // Estado
  const [filters, setFiltersRaw] = useState<ListFilters>(() =>
    syncWithUrl ? readFiltersFromUrl() : EMPTY_FILTERS,
  );
  const [sort, setSortRaw] = useState<ListSort>(DEFAULT_SORT);
  const [pagination, setPaginationRaw] = useState<ListPagination>(DEFAULT_PAGINATION);

  const [rows, setRows] = useState<ListResourceRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [kpis, setKpis] = useState<ListKpis>(EMPTY_KPIS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref para cancelar peticiones obsoletas
  const abortRef = useRef(0);

  // ─── Sincronización con URL ─────────────────────────────────────────
  useEffect(() => {
    if (!syncWithUrl) return;
    writeFiltersToUrl(filters);
  }, [filters, syncWithUrl]);

  // ─── Setters envolventes: resetean paginación al cambiar filtros/sort
  const setFilters = useCallback((f: ListFilters) => {
    setFiltersRaw(f);
    setPaginationRaw((p) => ({ ...p, page: 1 }));
  }, []);

  const updateFilter = useCallback(
    <K extends keyof ListFilters>(key: K, value: ListFilters[K]) => {
      setFiltersRaw((curr) => ({ ...curr, [key]: value }));
      setPaginationRaw((p) => ({ ...p, page: 1 }));
    },
    [],
  );

  const setSort = useCallback((s: ListSort) => {
    setSortRaw(s);
    setPaginationRaw((p) => ({ ...p, page: 1 }));
  }, []);

  const setPagination = useCallback((p: ListPagination) => {
    setPaginationRaw(p);
  }, []);

  // ─── Fetch principal ─────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    const myId = ++abortRef.current;
    setLoading(true);
    setError(null);

    try {
      const ownerFilter = filters.onlyMine ? currentUserId : null;

      // Promesas paralelas: listado + KPIs
      const [listRes, kpisRes] = await Promise.all([
        supabase.rpc('list_resources', {
          p_search: filters.search.trim() || null,
          p_status: filters.status === 'all' ? null : filters.status,
          p_type_keys: filters.typeKeys.length > 0 ? filters.typeKeys : null,
          p_municipality_ids:
            filters.municipalityIds.length > 0 ? filters.municipalityIds : null,
          p_languages_missing:
            filters.languagesMissing.length > 0 ? filters.languagesMissing : null,
          p_visible_on_map: filters.visibleOnMap,
          p_has_coordinates: filters.hasCoordinates,
          p_incomplete_for_publish: filters.incompleteForPublish,
          p_owner_id: ownerFilter,
          p_order_by: sort.orderBy,
          p_order_dir: sort.orderDir,
          p_page: pagination.page,
          p_page_size: pagination.pageSize,
        }),
        supabase.rpc('list_resources_kpis', {
          p_owner_id: ownerFilter,
        }),
      ]);

      // Descartar si ya hay otra petición posterior
      if (myId !== abortRef.current) return;

      if (listRes.error) throw new Error(listRes.error.message);
      if (kpisRes.error) throw new Error(kpisRes.error.message);

      const listData = (listRes.data ?? []) as Record<string, unknown>[];
      setRows(listData.map(mapRpcRow));
      setTotalCount(
        listData.length > 0 ? Number(listData[0].total_count ?? 0) : 0,
      );

      const kpisData = (kpisRes.data ?? [EMPTY_KPIS]) as Record<string, unknown>[];
      setKpis(mapKpisRow(kpisData[0] ?? {}));
    } catch (e) {
      if (myId !== abortRef.current) return;
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      if (myId === abortRef.current) setLoading(false);
    }
  }, [supabase, currentUserId, filters, sort, pagination]);

  // Refetch automático al cambiar filtros/sort/paginación (con debounce search)
  useEffect(() => {
    const delay = filters.search.length > 0 ? 300 : 0;
    const t = setTimeout(() => void fetchData(), delay);
    return () => clearTimeout(t);
  }, [fetchData, filters.search.length]);

  const refetch = useCallback(() => fetchData(), [fetchData]);

  return {
    rows,
    totalCount,
    kpis,

    filters,
    setFilters,
    updateFilter,

    sort,
    setSort,

    pagination,
    setPagination,

    loading,
    error,
    refetch,
  };
}

// ─── Mappers ─────────────────────────────────────────────────────────

function mapRpcRow(r: Record<string, unknown>): ListResourceRow {
  return {
    id: String(r.id ?? ''),
    nameEs: String(r.name_es ?? ''),
    nameGl: String(r.name_gl ?? ''),
    slug: String(r.slug ?? ''),
    singleTypeVocabulary: (r.single_type_vocabulary as string) ?? null,
    publicationStatus: (r.publication_status as ListResourceRow['publicationStatus']) ?? 'borrador',
    municipalityId: (r.municipality_id as string) ?? null,
    municipalityName: (r.municipality_name as string) ?? null,
    municipalitySlug: (r.municipality_slug as string) ?? null,
    hasLangEs: Boolean(r.has_lang_es),
    hasLangGl: Boolean(r.has_lang_gl),
    hasLangEn: Boolean(r.has_lang_en),
    hasLangFr: Boolean(r.has_lang_fr),
    hasLangPt: Boolean(r.has_lang_pt),
    hasCoordinates: Boolean(r.has_coordinates),
    visibleOnMap: Boolean(r.visible_on_map),
    qualityScore: Number(r.quality_score ?? 0),
    pidMissingRequired: Number(r.pid_missing_required ?? 0),
    scheduledPublishAt: (r.scheduled_publish_at as string) ?? null,
    publishedAt: (r.published_at as string) ?? null,
    updatedAt: String(r.updated_at ?? new Date().toISOString()),
    lastEditorEmail: (r.last_editor_email as string) ?? null,
    primaryImagePath: (r.primary_image_path as string) ?? null,
  };
}

function mapKpisRow(r: Record<string, unknown>): ListKpis {
  return {
    total: Number(r.total ?? 0),
    published: Number(r.published ?? 0),
    scheduled: Number(r.scheduled ?? 0),
    draft: Number(r.draft ?? 0),
    archived: Number(r.archived ?? 0),
    incompleteForPublish: Number(r.incomplete_for_publish ?? 0),
  };
}

// ─── URL sync ─────────────────────────────────────────────────────────

function readFiltersFromUrl(): ListFilters {
  if (typeof window === 'undefined') return EMPTY_FILTERS;
  const params = new URLSearchParams(window.location.search);
  return {
    search: params.get('q') ?? '',
    status: (params.get('status') as ListFilters['status']) || 'all',
    typeKeys: params.get('types')?.split(',').filter(Boolean) ?? [],
    municipalityIds: params.get('munis')?.split(',').filter(Boolean) ?? [],
    languagesMissing: params.get('langs_missing')?.split(',').filter(Boolean) ?? [],
    visibleOnMap: parseTriState(params.get('map')),
    hasCoordinates: parseTriState(params.get('coords')),
    incompleteForPublish: parseTriState(params.get('incomplete')),
    onlyMine: params.get('mine') === '1',
  };
}

function writeFiltersToUrl(f: ListFilters): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams();
  if (f.search.trim()) params.set('q', f.search.trim());
  if (f.status !== 'all') params.set('status', f.status);
  if (f.typeKeys.length > 0) params.set('types', f.typeKeys.join(','));
  if (f.municipalityIds.length > 0) params.set('munis', f.municipalityIds.join(','));
  if (f.languagesMissing.length > 0) params.set('langs_missing', f.languagesMissing.join(','));
  if (f.visibleOnMap !== null) params.set('map', f.visibleOnMap ? '1' : '0');
  if (f.hasCoordinates !== null) params.set('coords', f.hasCoordinates ? '1' : '0');
  if (f.incompleteForPublish !== null) params.set('incomplete', f.incompleteForPublish ? '1' : '0');
  if (f.onlyMine) params.set('mine', '1');

  const qs = params.toString();
  const newUrl = qs
    ? `${window.location.pathname}?${qs}`
    : window.location.pathname;
  window.history.replaceState({}, '', newUrl);
}

function parseTriState(v: string | null): boolean | null {
  if (v === '1') return true;
  if (v === '0') return false;
  return null;
}

// ─── Re-exports para consumidores ─────────────────────────────────────
export const INITIAL_STATE = {
  filters: EMPTY_FILTERS,
  sort: DEFAULT_SORT,
  pagination: DEFAULT_PAGINATION,
};
