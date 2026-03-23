/**
 * Estados editoriales de contenido
 * Fuente: BRI-6.1
 */
export const EDITORIAL_STATES = {
  borrador: 'borrador',
  revision: 'revision',
  publicado: 'publicado',
  archivado: 'archivado',
} as const;

export type EditorialState = typeof EDITORIAL_STATES[keyof typeof EDITORIAL_STATES];

/** Transiciones permitidas */
export const STATE_TRANSITIONS: Record<EditorialState, EditorialState[]> = {
  borrador: ['revision', 'archivado'],
  revision: ['publicado', 'borrador'],
  publicado: ['archivado', 'borrador'],
  archivado: ['borrador'],
};
