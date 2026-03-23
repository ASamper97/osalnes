/**
 * Roles de usuario del sistema
 * Fuente: BRI-7, MEM-3.3
 */
export const ROLES = {
  admin: 'admin',
  editor: 'editor',
  validador: 'validador',
  tecnico: 'tecnico',
  analitica: 'analitica',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

/** Permisos por rol */
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  admin: [
    'resources:read', 'resources:write', 'resources:delete', 'resources:publish',
    'pages:read', 'pages:write', 'pages:delete', 'pages:publish',
    'taxonomy:read', 'taxonomy:write',
    'media:read', 'media:write', 'media:delete',
    'navigation:read', 'navigation:write',
    'users:read', 'users:write',
    'exports:read', 'exports:write',
    'analytics:read',
  ],
  editor: [
    'resources:read', 'resources:write',
    'pages:read', 'pages:write',
    'taxonomy:read',
    'media:read', 'media:write',
    'navigation:read',
  ],
  validador: [
    'resources:read', 'resources:publish',
    'pages:read', 'pages:publish',
    'taxonomy:read',
    'media:read',
  ],
  tecnico: [
    'resources:read',
    'pages:read',
    'taxonomy:read', 'taxonomy:write',
    'media:read',
    'exports:read', 'exports:write',
    'navigation:read', 'navigation:write',
  ],
  analitica: [
    'resources:read',
    'pages:read',
    'taxonomy:read',
    'exports:read',
    'analytics:read',
  ],
};
