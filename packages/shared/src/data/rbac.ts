/**
 * RBAC · Roles y permisos sobre widgets del dashboard (decisión 3-C)
 *
 * Define los 5 roles del pliego y qué widgets puede ver cada uno.
 * Se lee desde `auth.users.user_metadata.role` en el cliente.
 *
 * Cuando venga SCR-14 (Gestión de usuarios y roles), esta matriz se
 * ampliará a todas las acciones del CMS, no solo visibilidad del
 * dashboard.
 */

export type UserRole =
  | 'admin'           // RBAC-01 Administrador general
  | 'platform'        // RBAC-02 Gestor de plataforma
  | 'operator'        // RBAC-03 Operador
  | 'agency'          // RBAC-04 Usuario agencia
  | 'tourism_manager' // RBAC-05 Gestor turístico
  | 'unknown';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador general',
  platform: 'Gestor de plataforma',
  operator: 'Operador',
  agency: 'Usuario agencia',
  tourism_manager: 'Gestor turístico',
  unknown: 'Sin rol asignado',
};

/** IDs de widgets del dashboard con control de visibilidad */
export type DashboardWidgetId =
  | 'alerts'
  | 'quickActions'
  | 'myWork'
  | 'statusKpis'
  | 'upcomingScheduled'
  | 'uneIndicators'
  | 'translationProgress'
  | 'dataQuality'
  | 'catalogDistribution'
  | 'lastExport'
  | 'recentActivity'
  | 'catalogContext';

/**
 * Matriz de visibilidad por rol.
 *
 * Principio del pliego NFR-07: "Principio de mínimo privilegio".
 * Usuarios agencia y gestor turístico tienen visibilidad acotada.
 *
 * Si hay duda, mejor ocultar que exponer.
 */
const VISIBILITY_MATRIX: Record<UserRole, ReadonlySet<DashboardWidgetId>> = {
  admin: new Set<DashboardWidgetId>([
    'alerts', 'quickActions', 'myWork', 'statusKpis', 'upcomingScheduled',
    'uneIndicators', 'translationProgress', 'dataQuality',
    'catalogDistribution', 'lastExport', 'recentActivity', 'catalogContext',
  ]),
  platform: new Set<DashboardWidgetId>([
    'alerts', 'quickActions', 'myWork', 'statusKpis', 'upcomingScheduled',
    'uneIndicators', 'translationProgress', 'dataQuality',
    'catalogDistribution', 'lastExport', 'recentActivity', 'catalogContext',
  ]),
  operator: new Set<DashboardWidgetId>([
    'alerts', 'quickActions', 'myWork', 'statusKpis', 'upcomingScheduled',
    'translationProgress', 'dataQuality', 'recentActivity', 'catalogContext',
    // NO ve: uneIndicators (estratégico), catalogDistribution (gerencia),
    // lastExport (restringido por pliego a gestor/admin)
  ]),
  agency: new Set<DashboardWidgetId>([
    'quickActions', 'myWork', 'statusKpis', 'upcomingScheduled', 'dataQuality',
    // NO ve: alerts globales, exportaciones, indicadores UNE, actividad del equipo
  ]),
  tourism_manager: new Set<DashboardWidgetId>([
    'alerts', 'quickActions', 'statusKpis', 'upcomingScheduled',
    'translationProgress', 'recentActivity', 'catalogContext',
    // NO ve: myWork (no crea), lastExport, uneIndicators
  ]),
  unknown: new Set<DashboardWidgetId>([
    'quickActions', 'statusKpis',
    // Mínimo absoluto hasta que se asigne rol
  ]),
};

export function canSeeWidget(role: UserRole, widget: DashboardWidgetId): boolean {
  return VISIBILITY_MATRIX[role]?.has(widget) ?? false;
}

/** Parsea el rol desde user_metadata de Supabase, con fallback seguro */
export function parseUserRole(metadata: unknown): UserRole {
  if (!metadata || typeof metadata !== 'object') return 'unknown';
  const role = (metadata as Record<string, unknown>).role;
  if (typeof role !== 'string') return 'unknown';
  const normalized = role.toLowerCase().trim();
  if (normalized === 'admin' || normalized === 'administrator' || normalized === 'administrador') return 'admin';
  if (normalized === 'platform' || normalized === 'gestor_plataforma' || normalized === 'gestor-plataforma') return 'platform';
  if (normalized === 'operator' || normalized === 'operador') return 'operator';
  if (normalized === 'agency' || normalized === 'agencia') return 'agency';
  if (normalized === 'tourism_manager' || normalized === 'gestor_turistico' || normalized === 'gestor-turistico') return 'tourism_manager';
  return 'unknown';
}

// ─── Acciones rápidas por rol (decisión 4-C) ──────────────────────────

export interface QuickAction {
  id: string;
  label: string;
  icon: string; // emoji
  href: string; // ruta relativa
  variant: 'primary' | 'ghost';
  description?: string;
}

/**
 * Devuelve la lista ordenada de accesos rápidos según rol.
 * El primero siempre es "Nuevo recurso" (acción más común).
 */
export function getQuickActionsForRole(role: UserRole): QuickAction[] {
  const CREATE: QuickAction = {
    id: 'create',
    label: 'Nuevo recurso',
    icon: '➕',
    href: '/resources/new',
    variant: 'primary',
    description: 'Crear ficha de recurso turístico',
  };
  const OPEN_LIST: QuickAction = {
    id: 'list',
    label: 'Abrir listado',
    icon: '📋',
    href: '/resources',
    variant: 'ghost',
  };
  const MY_DRAFTS: QuickAction = {
    id: 'myDrafts',
    label: 'Mis borradores',
    icon: '✏️',
    href: '/resources?status=draft&mine=1',
    variant: 'ghost',
  };
  const MAP: QuickAction = {
    id: 'map',
    label: 'Mapa',
    icon: '🗺',
    href: '/map',
    variant: 'ghost',
  };
  const EXPORTS: QuickAction = {
    id: 'exports',
    label: 'Exportaciones',
    icon: '📤',
    href: '/exports',
    variant: 'ghost',
  };
  const USERS: QuickAction = {
    id: 'users',
    label: 'Usuarios',
    icon: '👥',
    href: '/users',
    variant: 'ghost',
  };
  const SETTINGS: QuickAction = {
    id: 'settings',
    label: 'Ajustes',
    icon: '⚙️',
    href: '/settings',
    variant: 'ghost',
  };
  const REVIEW: QuickAction = {
    id: 'review',
    label: 'Pendientes de revisión',
    icon: '🔍',
    href: '/resources?status=in_review',
    variant: 'ghost',
  };

  switch (role) {
    case 'admin':
      return [CREATE, OPEN_LIST, EXPORTS, USERS, MAP, SETTINGS];
    case 'platform':
      return [CREATE, OPEN_LIST, EXPORTS, MAP, REVIEW];
    case 'operator':
      return [CREATE, MY_DRAFTS, OPEN_LIST, MAP];
    case 'agency':
      return [CREATE, MY_DRAFTS, OPEN_LIST];
    case 'tourism_manager':
      return [OPEN_LIST, REVIEW, MAP];
    case 'unknown':
    default:
      return [CREATE, OPEN_LIST];
  }
}
