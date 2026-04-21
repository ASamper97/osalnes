/**
 * Estado de publicación del recurso
 *
 * Alineado con el CHECK de `recurso_turistico.estado_editorial` (schema
 * en español desde la migración 001). La migración 025 añade
 * 'programado' al conjunto existente ('borrador', 'revision',
 * 'publicado', 'archivado').
 */

export type PublicationStatus =
  | 'borrador'
  | 'revision'
  | 'programado'
  | 'publicado'
  | 'archivado';

export const PUBLICATION_STATUS_LABELS: Record<PublicationStatus, string> = {
  borrador: 'Borrador',
  revision: 'Revisión',
  programado: 'Programado',
  publicado: 'Publicado',
  archivado: 'Archivado',
};

/** Color badge según el estado */
export const PUBLICATION_STATUS_COLORS: Record<PublicationStatus, string> = {
  borrador: 'gray',
  revision: 'amber',
  programado: 'blue',
  publicado: 'green',
  archivado: 'dim',
};

/** ¿Desde qué estado puedo ir a qué otro? */
export function canTransition(from: PublicationStatus, to: PublicationStatus): boolean {
  if (from === to) return false;
  // Borrador → cualquier otro estado no-borrador
  if (from === 'borrador') return true;
  // Revisión → publicado | borrador | archivado
  if (from === 'revision') return to === 'publicado' || to === 'borrador' || to === 'archivado';
  // Programado → borrador | publicado | archivado
  if (from === 'programado') return to === 'borrador' || to === 'publicado' || to === 'archivado';
  // Publicado → borrador (despublicar) | archivado
  if (from === 'publicado') return to === 'borrador' || to === 'archivado';
  // Archivado → borrador (reactivar)
  if (from === 'archivado') return to === 'borrador';
  return false;
}

// ─── Helpers de fecha/hora para Europe/Madrid ──────────────────────────

/**
 * Convierte un `<input type="datetime-local">` en UTC ISO string.
 * El input da un string tipo "2026-05-15T10:30" interpretado en la
 * zona horaria del navegador. Para O Salnés asumimos que el usuario
 * está en España y el navegador tiene Europe/Madrid.
 */
export function localDateTimeToUtcIso(localDateTime: string): string {
  if (!localDateTime) return '';
  // new Date("2026-05-15T10:30") interpreta en timezone local
  const d = new Date(localDateTime);
  return d.toISOString();
}

/**
 * Convierte un UTC ISO string al formato que acepta
 * `<input type="datetime-local">` en zona horaria local.
 */
export function utcIsoToLocalDateTime(utcIso: string | null | undefined): string {
  if (!utcIso) return '';
  const d = new Date(utcIso);
  const offset = d.getTimezoneOffset() * 60000;
  const local = new Date(d.getTime() - offset);
  return local.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
}

/** Mínimo aceptable para programar: ahora + 5 minutos (evitar programar al pasado) */
export function minScheduleDateTime(): string {
  const d = new Date(Date.now() + 5 * 60000);
  return utcIsoToLocalDateTime(d.toISOString());
}

/**
 * Formatea una fecha ISO para mostrar al usuario en español.
 * Ejemplo: "lun, 15 may 2026 · 10:30"
 */
export function formatScheduleForDisplay(utcIso: string | null | undefined): string {
  if (!utcIso) return '';
  const d = new Date(utcIso);
  return d.toLocaleString('es-ES', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).replace(',', ' ·');
}

/** ¿La fecha programada ya venció? */
export function isScheduleExpired(utcIso: string | null | undefined): boolean {
  if (!utcIso) return false;
  return new Date(utcIso).getTime() < Date.now();
}

/** Tiempo restante hasta la publicación (string humano) */
export function timeUntilSchedule(utcIso: string | null | undefined): string {
  if (!utcIso) return '';
  const diffMs = new Date(utcIso).getTime() - Date.now();
  if (diffMs < 0) return 'vencido';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `en ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `en ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `en ${days} día${days === 1 ? '' : 's'}`;
  return `en ${Math.floor(days / 7)} semana${Math.floor(days / 7) === 1 ? '' : 's'}`;
}
