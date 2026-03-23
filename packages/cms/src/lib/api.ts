import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `API ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public endpoints
// ---------------------------------------------------------------------------

export const api = {
  // Resources (public)
  getResources: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : '';
    return apiFetch<{ items: any[]; total: number; page: number; limit: number; pages: number }>(`/resources${qs}`);
  },
  getResource: (id: string) => apiFetch<any>(`/resources/${id}`),

  // Categories
  getCategories: () => apiFetch<any[]>('/categories'),

  // Municipalities
  getMunicipalities: () => apiFetch<any[]>('/municipalities'),

  // Typologies
  getTypologies: () => apiFetch<any[]>('/typologies'),

  // Navigation
  getNavigation: (slug: string) => apiFetch<any[]>(`/navigation/${slug}`),

  // ---------------------------------------------------------------------------
  // Admin endpoints (authenticated)
  // ---------------------------------------------------------------------------

  createResource: (data: any) =>
    apiFetch<any>('/admin/resources', { method: 'POST', body: JSON.stringify(data) }),

  updateResource: (id: string, data: any) =>
    apiFetch<any>(`/admin/resources/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  updateResourceStatus: (id: string, status: string) =>
    apiFetch<any>(`/admin/resources/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  deleteResource: (id: string) =>
    apiFetch<any>(`/admin/resources/${id}`, { method: 'DELETE' }),

  // Categories (admin)
  getAdminCategories: () => apiFetch<any[]>('/admin/categories'),

  createCategory: (data: any) =>
    apiFetch<any>('/admin/categories', { method: 'POST', body: JSON.stringify(data) }),

  updateCategory: (id: string, data: any) =>
    apiFetch<any>(`/admin/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteCategory: (id: string) =>
    apiFetch<any>(`/admin/categories/${id}`, { method: 'DELETE' }),

  // Navigation (admin)
  getAdminNavigation: (menu?: string) => {
    const qs = menu ? `?menu=${encodeURIComponent(menu)}` : '';
    return apiFetch<any[]>(`/admin/navigation${qs}`);
  },

  createNavItem: (data: any) =>
    apiFetch<any>('/admin/navigation', { method: 'POST', body: JSON.stringify(data) }),

  updateNavItem: (id: string, data: any) =>
    apiFetch<any>(`/admin/navigation/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteNavItem: (id: string) =>
    apiFetch<any>(`/admin/navigation/${id}`, { method: 'DELETE' }),
};
