import { supabase } from './supabase';

// Public API (read-only endpoints)
const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';
// Admin API (authenticated CRUD endpoints)
// In production with Supabase Edge Functions these are separate functions:
//   VITE_API_URL   = https://<ref>.supabase.co/functions/v1/api
//   VITE_ADMIN_URL = https://<ref>.supabase.co/functions/v1/admin
// In dev, falls back to /api/v1/admin (proxied by Vite)
const ADMIN_BASE = import.meta.env.VITE_ADMIN_URL || `${API_BASE}/admin`;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

async function apiFetch<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();

  const res = await fetch(`${base}${path}`, {
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

/** Shortcut for public endpoints */
function publicFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return apiFetch<T>(API_BASE, path, init);
}

/** Shortcut for admin endpoints */
function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  return apiFetch<T>(ADMIN_BASE, path, init);
}

/** Upload helper — sends multipart/form-data (no Content-Type header) */
async function adminUpload<T>(path: string, formData: FormData): Promise<T> {
  const authHeaders = await getAuthHeaders();

  const res = await fetch(`${ADMIN_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders,
    body: formData,
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
    return publicFetch<{ items: any[]; total: number; page: number; limit: number; pages: number }>(`/resources${qs}`);
  },
  getResource: (id: string) => publicFetch<any>(`/resources/${id}`),

  // Categories
  getCategories: () => publicFetch<any[]>('/categories'),

  // Municipalities
  getMunicipalities: () => publicFetch<any[]>('/municipalities'),

  // Typologies
  getTypologies: () => publicFetch<any[]>('/typologies'),

  // Navigation
  getNavigation: (slug: string) => publicFetch<any[]>(`/navigation/${slug}`),

  // ---------------------------------------------------------------------------
  // Admin — Resources
  // ---------------------------------------------------------------------------

  createResource: (data: any) =>
    adminFetch<any>('/resources', { method: 'POST', body: JSON.stringify(data) }),

  updateResource: (id: string, data: any) =>
    adminFetch<any>(`/resources/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  updateResourceStatus: (id: string, status: string) =>
    adminFetch<any>(`/resources/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  deleteResource: (id: string) =>
    adminFetch<any>(`/resources/${id}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------------------
  // Admin — Categories
  // ---------------------------------------------------------------------------

  getAdminCategories: () => adminFetch<any[]>('/categories'),

  createCategory: (data: any) =>
    adminFetch<any>('/categories', { method: 'POST', body: JSON.stringify(data) }),

  updateCategory: (id: string, data: any) =>
    adminFetch<any>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteCategory: (id: string) =>
    adminFetch<any>(`/categories/${id}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------------------
  // Admin — Navigation
  // ---------------------------------------------------------------------------

  getAdminNavigation: (menu?: string) => {
    const qs = menu ? `?menu=${encodeURIComponent(menu)}` : '';
    return adminFetch<any[]>(`/navigation${qs}`);
  },

  createNavItem: (data: any) =>
    adminFetch<any>('/navigation', { method: 'POST', body: JSON.stringify(data) }),

  updateNavItem: (id: string, data: any) =>
    adminFetch<any>(`/navigation/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteNavItem: (id: string) =>
    adminFetch<any>(`/navigation/${id}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------------------
  // Admin — Pages
  // ---------------------------------------------------------------------------

  getAdminPages: () => adminFetch<any[]>('/pages'),

  getAdminPage: (id: string) => adminFetch<any>(`/pages/${id}`),

  createPage: (data: any) =>
    adminFetch<any>('/pages', { method: 'POST', body: JSON.stringify(data) }),

  updatePage: (id: string, data: any) =>
    adminFetch<any>(`/pages/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  updatePageStatus: (id: string, status: string) =>
    adminFetch<any>(`/pages/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  deletePage: (id: string) =>
    adminFetch<any>(`/pages/${id}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------------------
  // Admin — Relations
  // ---------------------------------------------------------------------------

  getRelations: (recursoId: string) =>
    adminFetch<any[]>(`/relations?recurso_id=${recursoId}`),

  createRelation: (data: any) =>
    adminFetch<any>('/relations', { method: 'POST', body: JSON.stringify(data) }),

  updateRelation: (id: string, data: any) =>
    adminFetch<any>(`/relations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteRelation: (id: string) =>
    adminFetch<any>(`/relations/${id}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------------------
  // Admin — Documents
  // ---------------------------------------------------------------------------

  getDocuments: (entidadTipo: string, entidadId: string) =>
    adminFetch<any[]>(`/documents?entidad_tipo=${entidadTipo}&entidad_id=${entidadId}`),

  uploadDocument: (entidadTipo: string, entidadId: string, file: File, nombre?: Record<string, string>) => {
    const form = new FormData();
    form.append('file', file);
    form.append('entidad_tipo', entidadTipo);
    form.append('entidad_id', entidadId);
    if (nombre) form.append('nombre', JSON.stringify(nombre));
    return adminUpload<any>('/documents', form);
  },

  updateDocument: (id: string, data: any) =>
    adminFetch<any>(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteDocument: (id: string) =>
    adminFetch<any>(`/documents/${id}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------------------
  // Admin — Exports
  // ---------------------------------------------------------------------------

  getExports: (tipo?: string) => {
    const qs = tipo ? `?tipo=${tipo}` : '';
    return adminFetch<any[]>(`/exports${qs}`);
  },

  getExportJob: (jobId: string) => adminFetch<any>(`/exports/${jobId}`),

  createExportPid: (params?: any) =>
    adminFetch<any>('/exports/pid', { method: 'POST', body: JSON.stringify(params || {}) }),

  createExportDatalake: (params?: any) =>
    adminFetch<any>('/exports/datalake', { method: 'POST', body: JSON.stringify(params || {}) }),

  // ---------------------------------------------------------------------------
  // Admin — Users
  // ---------------------------------------------------------------------------

  getUsers: () => adminFetch<any[]>('/users'),

  getUser: (id: string) => adminFetch<any>(`/users/${id}`),

  createUser: (data: any) =>
    adminFetch<any>('/users', { method: 'POST', body: JSON.stringify(data) }),

  updateUser: (id: string, data: any) =>
    adminFetch<any>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteUser: (id: string) =>
    adminFetch<any>(`/users/${id}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------------------
  // Admin — Products
  // ---------------------------------------------------------------------------

  getProducts: () => adminFetch<any[]>('/products'),

  createProduct: (data: any) =>
    adminFetch<any>('/products', { method: 'POST', body: JSON.stringify(data) }),

  updateProduct: (id: string, data: any) =>
    adminFetch<any>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteProduct: (id: string) =>
    adminFetch<any>(`/products/${id}`, { method: 'DELETE' }),
};
