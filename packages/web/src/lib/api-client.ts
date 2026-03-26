// In production: https://<ref>.supabase.co/functions/v1/api
// In dev: http://localhost:54321/functions/v1/api (supabase functions serve)
//   or the Express fallback: http://localhost:3001/api/v1
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

interface FetchOptions {
  lang?: string;
  revalidate?: number;
}

async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  if (opts.lang) url.searchParams.set('lang', opts.lang);

  const res = await fetch(url.toString(), {
    next: { revalidate: opts.revalidate ?? 60 },
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${path}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Resource {
  id: string;
  uri: string;
  slug: string;
  rdfType: string;
  name: Record<string, string>;
  description: Record<string, string>;
  seoTitle: Record<string, string>;
  seoDescription: Record<string, string>;
  location: { latitude: number | null; longitude: number | null; streetAddress: string | null; postalCode: string | null };
  municipioId: string | null;
  contact: { telephone: string[]; email: string[]; url: string | null; sameAs: string[] };
  touristTypes: string[];
  ratingValue: number | null;
  servesCuisine: string[];
  openingHours: string | null;
  isAccessibleForFree: boolean | null;
  publicAccess: boolean | null;
  occupancy: number | null;
  status: string;
  visibleOnMap: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  categoryIds: string[];
}

export interface Typology {
  id: string;
  typeCode: string;
  schemaOrgType: string;
  grupo: string;
  name: Record<string, string>;
}

export interface Category {
  id: string;
  slug: string;
  parentId: string | null;
  orden: number;
  name: Record<string, string>;
}

export interface Municipality {
  id: string;
  codigoIne: string;
  slug: string;
  latitude: number | null;
  longitude: number | null;
  name: Record<string, string>;
}

export interface PageData {
  id: string;
  slug: string;
  template: string;
  title: Record<string, string>;
  body: Record<string, string>;
  seoTitle: Record<string, string>;
  seoDescription: Record<string, string>;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ---------------------------------------------------------------------------
// Public API methods
// ---------------------------------------------------------------------------

export function getResources(params?: {
  type?: string;
  municipio?: string;
  lang?: string;
  page?: number;
  limit?: number;
  sort?: string;
  status?: string;
}) {
  const search = new URLSearchParams();
  if (params?.type) search.set('type', params.type);
  if (params?.municipio) search.set('municipio', params.municipio);
  if (params?.lang) search.set('lang', params.lang);
  if (params?.page) search.set('page', String(params.page));
  if (params?.limit) search.set('limit', String(params.limit));
  if (params?.sort) search.set('sort', params.sort);
  if (params?.status) search.set('status', params.status);

  const qs = search.toString();
  return apiFetch<PaginatedResult<Resource>>(`/resources${qs ? `?${qs}` : ''}`);
}

export function getResourceBySlug(slug: string) {
  return apiFetch<Resource>(`/resources/by-slug/${slug}`);
}

export function getTypologies() {
  return apiFetch<Typology[]>('/typologies');
}

export function getCategories() {
  return apiFetch<Category[]>('/categories');
}

export function getMunicipalities() {
  return apiFetch<Municipality[]>('/municipalities');
}

export function getNavigation(menuSlug: string) {
  return apiFetch<any[]>(`/navigation/${menuSlug}`);
}

export function getPage(slug: string) {
  return apiFetch<PageData>(`/pages/${slug}`);
}

export function getEvents(params?: { from?: string; to?: string }) {
  const search = new URLSearchParams();
  if (params?.from) search.set('from', params.from);
  if (params?.to) search.set('to', params.to);
  const qs = search.toString();
  return apiFetch<any[]>(`/events${qs ? `?${qs}` : ''}`);
}

export function searchResources(q: string, params?: { lang?: string; type?: string; municipio?: string; page?: number; limit?: number }) {
  const search = new URLSearchParams({ q });
  if (params?.lang) search.set('lang', params.lang);
  if (params?.type) search.set('type', params.type);
  if (params?.municipio) search.set('municipio', params.municipio);
  if (params?.page) search.set('page', String(params.page));
  if (params?.limit) search.set('limit', String(params.limit));
  return apiFetch<PaginatedResult<any>>(`/search?${search}`);
}

export function getMapResources(bounds: string, type?: string) {
  const search = new URLSearchParams({ bounds });
  if (type) search.set('type', type);
  return apiFetch<any[]>(`/map/resources?${search}`);
}
