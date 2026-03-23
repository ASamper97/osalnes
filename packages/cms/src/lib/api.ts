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

/** Upload helper — sends multipart/form-data (no Content-Type header) */
async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const authHeaders = await getAuthHeaders();

  const res = await fetch(`${API_BASE}${path}`, {
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
  // Admin — Resources
  // ---------------------------------------------------------------------------

  createResource: (data: any) =>
    apiFetch<any>('/admin/resources', { method: 'POST', body: JSON.stringify(data) }),

  updateResource: (id: string, data: any) =>
    apiFetch<any>(`/admin/resources/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  updateResourceStatus: (id: string, status: string) =>
    apiFetch<any>(`/admin/resources/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  deleteResource: (id: string) =>
    apiFetch<any>(`/admin/resources/${id}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------------------
  // Admin — Categories
  // ---------------------------------------------------------------------------

  getAdminCategories: () => apiFetch<any[]>('/admin/categories'),

  createCategory: (data: any) =>
    apiFetch<any>('/admin/categories', { method: 'POST', body: JSON.stringify(data) }),

  updateCategory: (id: string, data: any) =>
    apiFetch<any>(`/admin/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteCategory: (id: string) =>
    apiFetch<any>(`/admin/categories/${id}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------------------
  // Admin — Navigation
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Admin — Pages
  // ---------------------------------------------------------------------------

  getAdminPages: () => apiFetch<any[]>('/admin/pages'),

  getAdminPage: (id: string) => apiFetch<any>(`/admin/pages/${id}`),

  createPage: (data: any) =>
    apiFetch<any>('/admin/pages', { method: 'POST', body: JSON.stringify(data) }),

  updatePage: (id: string, data: any) =>
    apiFetch<any>(`/admin/pages/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  updatePageStatus: (id: string, status: string) =>
    apiFetch<any>(`/admin/pages/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  deletePage: (id: string) =>
    apiFetch<any>(`/admin/pages/${id}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------------------
  // Admin — Relations
  // ---------------------------------------------------------------------------

  getRelations: (recursoId: string) =>
    apiFetch<any[]>(`/admin/relations?recurso_id=${recursoId}`),

  createRelation: (data: any) =>
    apiFetch<any>('/admin/relations', { method: 'POST', body: JSON.stringify(data) }),

  updateRelation: (id: string, data: any) =>
    apiFetch<any>(`/admin/relations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteRelation: (id: string) =>
    apiFetch<any>(`/admin/relations/${id}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------------------
  // Admin — Documents
  // ---------------------------------------------------------------------------

  getDocuments: (entidadTipo: string, entidadId: string) =>
    apiFetch<any[]>(`/admin/documents?entidad_tipo=${entidadTipo}&entidad_id=${entidadId}`),

  uploadDocument: (entidadTipo: string, entidadId: string, file: File, nombre?: Record<string, string>) => {
    const form = new FormData();
    form.append('file', file);
    form.append('entidad_tipo', entidadTipo);
    form.append('entidad_id', entidadId);
    if (nombre) form.append('nombre', JSON.stringify(nombre));
    return apiUpload<any>('/admin/documents', form);
  },

  updateDocument: (id: string, data: any) =>
    apiFetch<any>(`/admin/documents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteDocument: (id: string) =>
    apiFetch<any>(`/admin/documents/${id}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------------------
  // Admin — Exports
  // ---------------------------------------------------------------------------

  getExports: (tipo?: string) => {
    const qs = tipo ? `?tipo=${tipo}` : '';
    return apiFetch<any[]>(`/admin/exports${qs}`);
  },

  getExportJob: (jobId: string) => apiFetch<any>(`/admin/exports/${jobId}`),

  createExportPid: (params?: any) =>
    apiFetch<any>('/admin/exports/pid', { method: 'POST', body: JSON.stringify(params || {}) }),

  createExportDatalake: (params?: any) =>
    apiFetch<any>('/admin/exports/datalake', { method: 'POST', body: JSON.stringify(params || {}) }),

  // ---------------------------------------------------------------------------
  // Admin — Users
  // ---------------------------------------------------------------------------

  getUsers: () => apiFetch<any[]>('/admin/users'),

  getUser: (id: string) => apiFetch<any>(`/admin/users/${id}`),

  createUser: (data: any) =>
    apiFetch<any>('/admin/users', { method: 'POST', body: JSON.stringify(data) }),

  updateUser: (id: string, data: any) =>
    apiFetch<any>(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteUser: (id: string) =>
    apiFetch<any>(`/admin/users/${id}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------------------
  // Admin — Products
  // ---------------------------------------------------------------------------

  getProducts: () => apiFetch<any[]>('/admin/products'),

  createProduct: (data: any) =>
    apiFetch<any>('/admin/products', { method: 'POST', body: JSON.stringify(data) }),

  updateProduct: (id: string, data: any) =>
    apiFetch<any>(`/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteProduct: (id: string) =>
    apiFetch<any>(`/admin/products/${id}`, { method: 'DELETE' }),
};
