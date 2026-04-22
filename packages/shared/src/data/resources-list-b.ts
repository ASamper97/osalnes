/// <reference lib="dom" />
/**
 * Tipos compartidos y helpers para la fase B del listado.
 *
 * `downloadCsv` usa DOM APIs (document.createElement, URL.createObjectURL)
 * y solo se invoca desde el cliente CMS (browser). La triple-slash ref
 * `dom` arriba permite que esos tipos resuelvan sin cambiar el tsconfig
 * del paquete shared (que está apuntado a Node por defecto).
 */

import type { ListFilters, ListSort, ListResourceRow } from './resources-list.js';

// ─── Vista guardada ────────────────────────────────────────────────────

export interface SavedView {
  id: string;
  ownerId: string;
  name: string;
  filters: ListFilters;
  sortOrderBy: string | null;
  sortOrderDir: 'asc' | 'desc' | null;
  pageSize: number | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export function mapRpcSavedView(r: Record<string, unknown>): SavedView {
  return {
    id: String(r.id),
    ownerId: String(r.owner_id),
    name: String(r.name),
    filters: (r.filters as ListFilters) ?? ({} as ListFilters),
    sortOrderBy: (r.sort_order_by as string) ?? null,
    sortOrderDir: (r.sort_order_dir as 'asc' | 'desc') ?? null,
    pageSize: r.page_size != null ? Number(r.page_size) : null,
    isDefault: Boolean(r.is_default),
    createdAt: String(r.created_at ?? new Date().toISOString()),
    updatedAt: String(r.updated_at ?? new Date().toISOString()),
  };
}

// ─── Exportación CSV ───────────────────────────────────────────────────

/** Columnas disponibles para exportar. El usuario elige cuáles. */
export type ExportColumn =
  | 'id'
  | 'nameEs'
  | 'nameGl'
  | 'slug'
  | 'typology'
  | 'municipality'
  | 'status'
  | 'languages'
  | 'visibleOnMap'
  | 'coordinates'
  | 'qualityScore'
  | 'pidMissing'
  | 'publishedAt'
  | 'scheduledAt'
  | 'updatedAt'
  | 'lastEditor';

export const EXPORT_COLUMN_LABELS: Record<ExportColumn, string> = {
  id: 'ID',
  nameEs: 'Nombre (ES)',
  nameGl: 'Nombre (GL)',
  slug: 'Slug',
  typology: 'Tipología',
  municipality: 'Municipio',
  status: 'Estado',
  languages: 'Idiomas con contenido',
  visibleOnMap: 'Visible en mapa',
  coordinates: 'Coordenadas',
  qualityScore: 'Calidad',
  pidMissing: 'PID · obligatorios sin rellenar',
  publishedAt: 'Fecha de publicación',
  scheduledAt: 'Fecha programada',
  updatedAt: 'Última modificación',
  lastEditor: 'Último editor',
};

export const DEFAULT_EXPORT_COLUMNS: ExportColumn[] = [
  'nameEs',
  'typology',
  'municipality',
  'status',
  'languages',
  'visibleOnMap',
  'qualityScore',
  'updatedAt',
];

/**
 * Convierte filas + columnas seleccionadas a CSV.
 * Usa comas como separador y escapa campos con comillas cuando haga falta.
 */
export function rowsToCsv(
  rows: ListResourceRow[],
  columns: ExportColumn[],
  resolveTypologyLabel: (key: string | null) => string,
): string {
  const header = columns.map((c) => EXPORT_COLUMN_LABELS[c]);
  const records = rows.map((row) => columns.map((c) => formatCsvCell(row, c, resolveTypologyLabel)));

  const lines = [header, ...records].map((fields) =>
    fields.map(csvEscape).join(','),
  );

  // BOM para que Excel detecte UTF-8
  return '\ufeff' + lines.join('\r\n');
}

function formatCsvCell(
  row: ListResourceRow,
  col: ExportColumn,
  resolveTypologyLabel: (key: string | null) => string,
): string {
  switch (col) {
    case 'id': return row.id;
    case 'nameEs': return row.nameEs;
    case 'nameGl': return row.nameGl;
    case 'slug': return row.slug;
    case 'typology': return resolveTypologyLabel(row.singleTypeVocabulary);
    case 'municipality': return row.municipalityName ?? '';
    case 'status': return row.publicationStatus;
    case 'languages': {
      const l: string[] = [];
      if (row.hasLangEs) l.push('ES');
      if (row.hasLangGl) l.push('GL');
      if (row.hasLangEn) l.push('EN');
      if (row.hasLangFr) l.push('FR');
      if (row.hasLangPt) l.push('PT');
      return l.join(' ');
    }
    case 'visibleOnMap': return row.visibleOnMap ? 'Sí' : 'No';
    case 'coordinates': return row.hasCoordinates ? 'Sí' : 'No';
    case 'qualityScore': return String(row.qualityScore);
    case 'pidMissing': return String(row.pidMissingRequired);
    case 'publishedAt': return row.publishedAt ?? '';
    case 'scheduledAt': return row.scheduledPublishAt ?? '';
    case 'updatedAt': return row.updatedAt;
    case 'lastEditor': return row.lastEditorEmail ?? '';
  }
}

function csvEscape(s: string): string {
  const str = String(s ?? '');
  // Si contiene coma, comilla, retorno o salto → rodear con comillas y escapar las internas
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Dispara la descarga de un CSV en el navegador.
 * Funciona creando un Blob + link temporal.
 */
export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Genera un nombre de archivo con fecha: "recursos-2026-04-22.csv" */
export function defaultCsvFilename(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  return `recursos-${date}.csv`;
}
