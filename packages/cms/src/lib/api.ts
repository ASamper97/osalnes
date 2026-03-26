import { supabase } from './supabase';

// Public API (read-only endpoints)
const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';
// Admin API (authenticated CRUD endpoints)
// In production with Supabase Edge Functions these are separate functions:
//   VITE_API_URL   = https://<ref>.supabase.co/functions/v1/api
//   VITE_ADMIN_URL = https://<ref>.supabase.co/functions/v1/admin
// In dev, falls back to /api/v1/admin (proxied by Vite)
const ADMIN_BASE = import.meta.env.VITE_ADMIN_URL || `${API_BASE}/admin`;

// Cache auth headers for 30s to avoid repeated getSession() calls
let _authCache: { headers: Record<string, string>; ts: number } | null = null;
const AUTH_CACHE_TTL = 30_000;

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (_authCache && Date.now() - _authCache.ts < AUTH_CACHE_TTL) {
    return _authCache.headers;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return {};
  const headers = { Authorization: `Bearer ${session.access_token}` };
  _authCache = { headers, ts: Date.now() };
  return headers;
}

/** Call on sign-out to clear cached credentials */
export function clearAuthCache() { _authCache = null; }

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
// Types
// ---------------------------------------------------------------------------

/** Localized value (multilanguage) */
export interface LocalizedValue { [lang: string]: string }

export interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'editor' | 'validador' | 'tecnico' | 'analitica';
  active: boolean;
}

export interface DashboardStats {
  resources: { total: number; published: number; draft: number; review: number; archived: number };
  municipalities: number;
  categories: number;
  quality: {
    withCoordinates: number;
    withImages: number;
    withDescription: number;
    translations: Record<string, number>;
  };
  une178502?: {
    digitalizacion: number;
    multilinguismo: number;
    geolocalizacion: number;
    actualizacion30d: number;
    actualizacion90d: number;
    interoperabilidad: number;
  };
  alerts: { level: 'warning' | 'error' | 'info'; message: string }[];
  resourcesByMunicipio: { id?: string; slug?: string; name?: string; count: number }[];
  resourcesByGroup: { grupo: string; count: number }[];
  recentChanges: { id: string; entidad_tipo: string; entidad_id: string; accion: string; usuario_id: string; created_at: string }[];
  lastExport: { id: string; tipo: string; estado: string; registros_ok: number; registros_err: number; created_at: string; completed_at: string | null } | null;
}

export interface ResourceSummary {
  id: string;
  uri: string;
  rdfType: string;
  slug: string;
  name: LocalizedValue;
  description: LocalizedValue;
  seoTitle: LocalizedValue;
  seoDescription: LocalizedValue;
  location: { latitude: number | null; longitude: number | null; streetAddress: string | null; postalCode: string | null };
  municipioId: string | null;
  zonaId: string | null;
  contact: { telephone: string[]; email: string[]; url: string | null; sameAs: string[] };
  touristTypes: string[];
  ratingValue: number | null;
  servesCuisine: string[];
  isAccessibleForFree: boolean | null;
  publicAccess: boolean | null;
  occupancy: number | null;
  openingHours: string | null;
  extras: Record<string, unknown>;
  status: string;
  visibleOnMap: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  categoryIds: string[];
}

/**
 * Input format for creating/updating resources.
 * Uses snake_case to match database column names (what the admin API expects).
 * Note: ResourceSummary (output) uses camelCase (mapped by the API).
 */
export interface ResourceInput {
  rdf_type: string;
  slug: string;
  municipio_id?: string | null;
  zona_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address_street?: string | null;
  address_postal?: string | null;
  telephone?: string[];
  email?: string[];
  url?: string | null;
  same_as?: string[];
  tourist_types?: string[];
  rating_value?: number | null;
  serves_cuisine?: string[];
  is_accessible_for_free?: boolean | null;
  public_access?: boolean | null;
  occupancy?: number | null;
  opening_hours?: string | null;
  extras?: Record<string, unknown>;
  visible_en_mapa?: boolean;
  name?: LocalizedValue;
  description?: LocalizedValue;
  seo_title?: LocalizedValue;
  seo_description?: LocalizedValue;
  category_ids?: string[];
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface CategoryItem {
  id: string;
  slug: string;
  parentId: string | null;
  orden: number;
  activo: boolean;
  name: LocalizedValue;
  resourceCount?: number;
}

export interface MunicipalityItem {
  id: string;
  codigoIne: string;
  slug: string;
  latitude: number | null;
  longitude: number | null;
  name: LocalizedValue;
}

export interface TypologyItem {
  id: string;
  typeCode: string;
  schemaOrgType: string | null;
  grupo: string;
  name: LocalizedValue;
}

export interface NavItem {
  id: string;
  tipo: string;
  referencia: string;
  orden: number;
  label: LocalizedValue;
  menuSlug?: string;
  parentId?: string | null;
}

export interface PageItem {
  id: string;
  slug: string;
  template: string | null;
  title: LocalizedValue;
  body: LocalizedValue;
  seoTitle: LocalizedValue;
  seoDescription: LocalizedValue;
  status: string;
  publishedAt: string | null;
  createdAt: string;
}

export interface RelationItem {
  id: string;
  recurso_origen: string;
  recurso_destino: string;
  tipo_relacion: string;
}

export interface AssetItem {
  id: string;
  url: string;
  tipo: string;
  mime_type: string;
  orden: number;
}

export interface DocumentItem {
  id: string;
  url: string;
  nombre: LocalizedValue;
  entidad_tipo: string;
  entidad_id: string;
  storage_path: string | null;
}

export interface ExportJob {
  id: string;
  tipo: string;
  estado: string;
  parametros: Record<string, unknown>;
  resultado: Record<string, unknown>;
  registros_ok: number;
  registros_err: number;
  created_at: string;
  completed_at: string | null;
}

export interface UserItem {
  id: string;
  email: string;
  nombre: string;
  rol: string;
  activo: boolean;
  created_at: string;
}

export interface ProductItem {
  id: string;
  slug: string;
  name: LocalizedValue;
  description: LocalizedValue;
  activo: boolean;
  resourceCount?: number;
}

export interface DeleteResult { deleted: boolean }

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const api = {
  // Profile
  getProfile: () => adminFetch<UserProfile>('/profile'),

  // Dashboard
  getStats: () => adminFetch<DashboardStats>('/stats'),

  // Resources (public)
  getResources: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : '';
    return publicFetch<PaginatedResult<ResourceSummary>>(`/resources${qs}`);
  },
  getResource: (id: string) => publicFetch<ResourceSummary>(`/resources/${id}`),

  // Categories
  getCategories: () => publicFetch<CategoryItem[]>('/categories'),

  // Municipalities
  getMunicipalities: () => publicFetch<MunicipalityItem[]>('/municipalities'),

  // Typologies
  getTypologies: () => publicFetch<TypologyItem[]>('/typologies'),

  // Navigation
  getNavigation: (slug: string) => publicFetch<NavItem[]>(`/navigation/${slug}`),

  // ---------------------------------------------------------------------------
  // Admin — Resources
  // ---------------------------------------------------------------------------

  createResource: (data: ResourceInput) =>
    adminFetch<ResourceSummary>('/resources', { method: 'POST', body: JSON.stringify(data) }),

  updateResource: (id: string, data: Partial<ResourceInput>) =>
    adminFetch<ResourceSummary>(`/resources/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  updateResourceStatus: (id: string, status: string) =>
    adminFetch<ResourceSummary>(`/resources/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  deleteResource: (id: string) =>
    adminFetch<DeleteResult>(`/resources/${id}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------------------
  // Admin — Categories
  // ---------------------------------------------------------------------------

  getAdminCategories: () => adminFetch<CategoryItem[]>('/categories'),

  createCategory: (data: { slug: string; parent_id?: string | null; orden?: number; name: LocalizedValue }) =>
    adminFetch<CategoryItem>('/categories', { method: 'POST', body: JSON.stringify(data) }),

  updateCategory: (id: string, data: { slug?: string; parent_id?: string | null; orden?: number; name?: LocalizedValue }) =>
    adminFetch<CategoryItem>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteCategory: (id: string) =>
    adminFetch<DeleteResult>(`/categories/${id}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------------------
  // Admin — Navigation
  // ---------------------------------------------------------------------------

  getAdminNavigation: (menu?: string) => {
    const qs = menu ? `?menu=${encodeURIComponent(menu)}` : '';
    return adminFetch<NavItem[]>(`/navigation${qs}`);
  },

  createNavItem: (data: { menu_slug: string; tipo: string; referencia: string; orden?: number; label: LocalizedValue; parent_id?: string | null }) =>
    adminFetch<NavItem>('/navigation', { method: 'POST', body: JSON.stringify(data) }),

  updateNavItem: (id: string, data: Partial<{ tipo: string; referencia: string; orden: number; label: LocalizedValue; parent_id: string | null; visible: boolean }>) =>
    adminFetch<NavItem>(`/navigation/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteNavItem: (id: string) =>
    adminFetch<DeleteResult>(`/navigation/${id}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------------------
  // Admin — Pages
  // ---------------------------------------------------------------------------

  getAdminPages: () => adminFetch<PageItem[]>('/pages'),

  getAdminPage: (id: string) => adminFetch<PageItem>(`/pages/${id}`),

  createPage: (data: { slug: string; template?: string; title: LocalizedValue; body: LocalizedValue; seo_title?: LocalizedValue; seo_description?: LocalizedValue }) =>
    adminFetch<PageItem>('/pages', { method: 'POST', body: JSON.stringify(data) }),

  updatePage: (id: string, data: Partial<{ slug: string; template: string; title: LocalizedValue; body: LocalizedValue; seo_title: LocalizedValue; seo_description: LocalizedValue }>) =>
    adminFetch<PageItem>(`/pages/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  updatePageStatus: (id: string, status: string) =>
    adminFetch<PageItem>(`/pages/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  deletePage: (id: string) =>
    adminFetch<DeleteResult>(`/pages/${id}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------------------
  // Admin — Relations
  // ---------------------------------------------------------------------------

  getRelations: (recursoId: string) =>
    adminFetch<RelationItem[]>(`/relations?recurso_id=${recursoId}`),

  createRelation: (data: { recurso_origen: string; recurso_destino: string; tipo_relacion: string }) =>
    adminFetch<RelationItem>('/relations', { method: 'POST', body: JSON.stringify(data) }),

  updateRelation: (id: string, data: Partial<{ tipo_relacion: string }>) =>
    adminFetch<RelationItem>(`/relations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteRelation: (id: string) =>
    adminFetch<DeleteResult>(`/relations/${id}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------------------
  // Admin — Assets (multimedia)
  // ---------------------------------------------------------------------------

  getAssets: (entidadTipo: string, entidadId: string) =>
    adminFetch<AssetItem[]>(`/assets?entidad_tipo=${entidadTipo}&entidad_id=${entidadId}`),

  uploadAsset: (entidadTipo: string, entidadId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    form.append('entidad_tipo', entidadTipo);
    form.append('entidad_id', entidadId);
    form.append('tipo', file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'imagen');
    return adminUpload<AssetItem>('/assets', form);
  },

  deleteAsset: (id: string) =>
    adminFetch<DeleteResult>(`/assets/${id}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------------------
  // Admin — Documents
  // ---------------------------------------------------------------------------

  getDocuments: (entidadTipo: string, entidadId: string) =>
    adminFetch<DocumentItem[]>(`/documents?entidad_tipo=${entidadTipo}&entidad_id=${entidadId}`),

  uploadDocument: (entidadTipo: string, entidadId: string, file: File, nombre?: LocalizedValue) => {
    const form = new FormData();
    form.append('file', file);
    form.append('entidad_tipo', entidadTipo);
    form.append('entidad_id', entidadId);
    if (nombre) form.append('nombre', JSON.stringify(nombre));
    return adminUpload<DocumentItem>('/documents', form);
  },

  updateDocument: (id: string, data: { nombre?: LocalizedValue }) =>
    adminFetch<DocumentItem>(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteDocument: (id: string) =>
    adminFetch<DeleteResult>(`/documents/${id}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------------------
  // Admin — Exports
  // ---------------------------------------------------------------------------

  getExports: (tipo?: string) => {
    const qs = tipo ? `?tipo=${tipo}` : '';
    return adminFetch<ExportJob[]>(`/exports${qs}`);
  },

  getExportJob: (jobId: string) => adminFetch<ExportJob>(`/exports/${jobId}`),

  createExportPid: (params?: Record<string, unknown>) =>
    adminFetch<ExportJob>('/exports/pid', { method: 'POST', body: JSON.stringify(params || {}) }),

  createExportDatalake: (params?: Record<string, unknown>) =>
    adminFetch<ExportJob>('/exports/datalake', { method: 'POST', body: JSON.stringify(params || {}) }),

  // ---------------------------------------------------------------------------
  // Admin — Users
  // ---------------------------------------------------------------------------

  getUsers: () => adminFetch<UserItem[]>('/users'),

  getUser: (id: string) => adminFetch<UserItem>(`/users/${id}`),

  createUser: (data: { email: string; nombre: string; rol: string; password?: string }) =>
    adminFetch<UserItem>('/users', { method: 'POST', body: JSON.stringify(data) }),

  updateUser: (id: string, data: Partial<{ nombre: string; rol: string; activo: boolean }>) =>
    adminFetch<UserItem>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteUser: (id: string) =>
    adminFetch<DeleteResult>(`/users/${id}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------------------
  // Admin — Products
  // ---------------------------------------------------------------------------

  getProducts: () => adminFetch<ProductItem[]>('/products'),

  createProduct: (data: { slug: string; name: LocalizedValue }) =>
    adminFetch<ProductItem>('/products', { method: 'POST', body: JSON.stringify(data) }),

  updateProduct: (id: string, data: Partial<{ slug: string; name: LocalizedValue; activo: boolean }>) =>
    adminFetch<ProductItem>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteProduct: (id: string) =>
    adminFetch<DeleteResult>(`/products/${id}`, { method: 'DELETE' }),
};
