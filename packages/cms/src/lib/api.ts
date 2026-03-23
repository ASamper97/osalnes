const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      // E2: add Authorization header from auth context
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `API ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Resources
  getResources: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : '';
    return apiFetch(`/resources${qs}`);
  },
  getResource: (id: string) => apiFetch(`/resources/${id}`),

  // Categories
  getCategories: () => apiFetch('/categories'),

  // Municipalities
  getMunicipalities: () => apiFetch('/municipalities'),

  // Typologies
  getTypologies: () => apiFetch('/typologies'),

  // Navigation
  getNavigation: (slug: string) => apiFetch(`/navigation/${slug}`),
};
