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
// Public API methods
// ---------------------------------------------------------------------------

export function getResources(params?: {
  type?: string;
  municipio?: string;
  lang?: string;
  page?: number;
  limit?: number;
}) {
  const search = new URLSearchParams();
  if (params?.type) search.set('type', params.type);
  if (params?.municipio) search.set('municipio', params.municipio);
  if (params?.lang) search.set('lang', params.lang);
  if (params?.page) search.set('page', String(params.page));
  if (params?.limit) search.set('limit', String(params.limit));

  const qs = search.toString();
  return apiFetch<{
    items: unknown[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }>(`/resources${qs ? `?${qs}` : ''}`);
}

export function getResourceBySlug(slug: string, lang?: string) {
  return apiFetch(`/resources/by-slug/${slug}`, { lang });
}

export function getCategories() {
  return apiFetch<unknown[]>('/categories');
}

export function getMunicipalities() {
  return apiFetch<unknown[]>('/municipalities');
}

export function getNavigation(menuSlug: string, lang?: string) {
  return apiFetch<unknown[]>(`/navigation/${menuSlug}`, { lang });
}

export function getPage(slug: string, lang?: string) {
  return apiFetch(`/pages/${slug}`, { lang });
}

export function searchResources(q: string, lang?: string) {
  const search = new URLSearchParams({ q });
  if (lang) search.set('lang', lang);
  return apiFetch<{ items: unknown[]; total: number }>(`/search?${search}`);
}
