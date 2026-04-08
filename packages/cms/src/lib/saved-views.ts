/**
 * SavedViews — Sistema simple de vistas guardadas en localStorage
 *
 * Cada usuario tiene sus propias "vistas" (combinaciones de filtros)
 * para listas como Recursos. No requiere cambios en BBDD.
 */

export interface SavedView {
  id: string;
  name: string;
  icon?: string;
  /** Filter values stored as a flat object — interpretation depends on the page */
  filters: Record<string, string>;
  /** Optional: marks built-in views that cannot be deleted */
  builtin?: boolean;
}

const STORAGE_KEY_PREFIX = 'osalnes_views_';

export function getSavedViews(entityType: string): SavedView[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + entityType);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveView(entityType: string, view: SavedView): void {
  if (typeof window === 'undefined') return;
  const views = getSavedViews(entityType);
  const existingIdx = views.findIndex((v) => v.id === view.id);
  if (existingIdx >= 0) {
    views[existingIdx] = view;
  } else {
    views.push(view);
  }
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + entityType, JSON.stringify(views));
  } catch { /* ignore quota errors */ }
}

export function deleteView(entityType: string, viewId: string): void {
  if (typeof window === 'undefined') return;
  const views = getSavedViews(entityType).filter((v) => v.id !== viewId);
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + entityType, JSON.stringify(views));
  } catch { /* ignore */ }
}

// Built-in views for resources — always available
export const RESOURCE_BUILTIN_VIEWS: SavedView[] = [
  { id: 'all', name: 'Todos', icon: '📋', filters: {}, builtin: true },
  { id: 'published', name: 'Publicados', icon: '🌐', filters: { status: 'publicado' }, builtin: true },
  { id: 'review', name: 'En revision', icon: '👀', filters: { status: 'revision' }, builtin: true },
  { id: 'draft', name: 'Borradores', icon: '✏️', filters: { status: 'borrador' }, builtin: true },
  { id: 'archived', name: 'Archivados', icon: '📦', filters: { status: 'archivado' }, builtin: true },
];
