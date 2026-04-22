/**
 * Modelo de datos del listado de recursos (SCR-03)
 *
 * Matches the shape returned by the RPC `list_resources` (migración 026).
 *
 * Listado A · fix: los valores de `publicationStatus` son los del CHECK
 * real de `recurso_turistico.estado_editorial` en Spanish
 * (borrador/revision/programado/publicado/archivado), NO los English
 * del prompt template. Coherente con `publication-status.ts` del
 * paso 7b.
 */

export type PublicationStatusFilter =
  | 'all'
  | 'publicado'
  | 'programado'
  | 'borrador'
  | 'revision'
  | 'archivado';

export type OrderByField = 'name' | 'updated_at' | 'quality_score' | 'municipality';
export type OrderDir = 'asc' | 'desc';

// ─── Registro por fila que devuelve la RPC ─────────────────────────────

export interface ListResourceRow {
  id: string;
  nameEs: string;
  nameGl: string;
  slug: string;
  singleTypeVocabulary: string | null;
  publicationStatus: 'borrador' | 'revision' | 'programado' | 'publicado' | 'archivado';
  municipalityId: string | null;
  municipalityName: string | null;
  municipalitySlug: string | null;
  hasLangEs: boolean;
  hasLangGl: boolean;
  hasLangEn: boolean;
  hasLangFr: boolean;
  hasLangPt: boolean;
  hasCoordinates: boolean;
  visibleOnMap: boolean;
  qualityScore: number;
  pidMissingRequired: number;
  scheduledPublishAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  lastEditorEmail: string | null;
}

// ─── Filtros aplicados ─────────────────────────────────────────────────

export interface ListFilters {
  search: string;
  status: PublicationStatusFilter;
  typeKeys: string[];           // multi-select tipologías
  municipalityIds: string[];    // multi-select municipios
  languagesMissing: string[];   // ['en', 'fr'] = mostrar los que no tienen EN o FR
  visibleOnMap: boolean | null; // true | false | null (cualquiera)
  hasCoordinates: boolean | null;
  incompleteForPublish: boolean | null;
  onlyMine: boolean;
}

export const EMPTY_FILTERS: ListFilters = {
  search: '',
  status: 'all',
  typeKeys: [],
  municipalityIds: [],
  languagesMissing: [],
  visibleOnMap: null,
  hasCoordinates: null,
  incompleteForPublish: null,
  onlyMine: false,
};

// ─── Orden + paginación ────────────────────────────────────────────────

export interface ListSort {
  orderBy: OrderByField;
  orderDir: OrderDir;
}

export interface ListPagination {
  page: number;
  pageSize: number;
}

export const DEFAULT_SORT: ListSort = { orderBy: 'updated_at', orderDir: 'desc' };
export const DEFAULT_PAGINATION: ListPagination = { page: 1, pageSize: 25 };

// ─── KPIs del dashboard superior ───────────────────────────────────────

export interface ListKpis {
  total: number;
  published: number;
  scheduled: number;
  draft: number;
  archived: number;
  incompleteForPublish: number;
}

export const EMPTY_KPIS: ListKpis = {
  total: 0,
  published: 0,
  scheduled: 0,
  draft: 0,
  archived: 0,
  incompleteForPublish: 0,
};

// ─── Helpers ───────────────────────────────────────────────────────────

/** ¿Algún filtro activo? */
export function hasActiveFilters(f: ListFilters): boolean {
  return (
    f.search.trim() !== '' ||
    f.status !== 'all' ||
    f.typeKeys.length > 0 ||
    f.municipalityIds.length > 0 ||
    f.languagesMissing.length > 0 ||
    f.visibleOnMap !== null ||
    f.hasCoordinates !== null ||
    f.incompleteForPublish !== null ||
    f.onlyMine
  );
}

/** Cuántos filtros activos */
export function countActiveFilters(f: ListFilters): number {
  let n = 0;
  if (f.search.trim()) n++;
  if (f.status !== 'all') n++;
  if (f.typeKeys.length > 0) n++;
  if (f.municipalityIds.length > 0) n++;
  if (f.languagesMissing.length > 0) n++;
  if (f.visibleOnMap !== null) n++;
  if (f.hasCoordinates !== null) n++;
  if (f.incompleteForPublish !== null) n++;
  if (f.onlyMine) n++;
  return n;
}

// ─── Formateo de fecha legible ─────────────────────────────────────────

/**
 * "hace 3 h" | "hace 2 días" | "25 mar 2026 · 14:30"
 * Si es menos de 7 días: relativo
 * Si es más: absoluto con mes abreviado
 */
export function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'ahora mismo';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} día${days === 1 ? '' : 's'}`;
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }) + ' · ' + d.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
