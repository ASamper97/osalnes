/**
 * Tipos y helpers de Fase B de SCR-13 — drawer de detalle, retry, descargas.
 *
 * Se ubica aparte de exports.ts (Fase A) para no mezclar cambios con
 * el core y facilitar el despliegue incremental.
 */

import type { ExportErrorCategory, ExportJobStatus, ExportJobType, ExportScopeType } from './exports.js';

// ─── Detalle del job ──────────────────────────────────────────────────

export interface ExportJobDetail {
  id: string;
  jobType: ExportJobType;
  status: ExportJobStatus;
  scopeType: ExportScopeType;
  recordsTotal: number;
  recordsProcessed: number;
  recordsFailed: number;
  recordsSkipped: number;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  triggeredBy: string | null;
  triggeredByEmail: string | null;
  notes: string | null;
  retryOf: string | null;
  isRetry: boolean;
  scopeIdsCount: number;
  /** Agrupación de errores por categoría → cuántos de cada tipo hubo */
  errorSummary: Partial<Record<ExportErrorCategory, number>>;
}

export function mapRpcExportJobDetail(r: Record<string, unknown>): ExportJobDetail {
  const summary = (r.error_summary as Record<string, unknown>) ?? {};
  const parsedSummary: Partial<Record<ExportErrorCategory, number>> = {};
  for (const k of Object.keys(summary)) {
    const v = summary[k];
    if (typeof v === 'number') parsedSummary[k as ExportErrorCategory] = v;
    else if (typeof v === 'string') parsedSummary[k as ExportErrorCategory] = Number(v);
  }

  return {
    id: String(r.id),
    jobType: (r.job_type as ExportJobType) ?? 'pid',
    status: (r.status as ExportJobStatus) ?? 'pending',
    scopeType: (r.scope_type as ExportScopeType) ?? 'all_published',
    recordsTotal: Number(r.records_total ?? 0),
    recordsProcessed: Number(r.records_processed ?? 0),
    recordsFailed: Number(r.records_failed ?? 0),
    recordsSkipped: Number(r.records_skipped ?? 0),
    startedAt: String(r.started_at ?? new Date().toISOString()),
    finishedAt: (r.finished_at as string) ?? null,
    durationMs: r.duration_ms != null ? Number(r.duration_ms) : null,
    triggeredBy: (r.triggered_by as string) ?? null,
    triggeredByEmail: (r.triggered_by_email as string) ?? null,
    notes: (r.notes as string) ?? null,
    retryOf: (r.retry_of as string) ?? null,
    isRetry: Boolean(r.is_retry),
    scopeIdsCount: Number(r.scope_ids_count ?? 0),
    errorSummary: parsedSummary,
  };
}

// ─── Records (recursos procesados dentro del job) ──────────────────────

export interface ExportJobRecord {
  id: string;
  resourceId: string | null;
  resourceName: string | null;
  resourceSlug: string | null;
  status: 'success' | 'failed' | 'skipped';
  errorCategory: ExportErrorCategory | null;
  errorMessage: string | null;
  errorDetails: Record<string, unknown> | null;
  hasPayload: boolean;
  processedAt: string;
  totalCount: number;
}

export function mapRpcExportJobRecord(r: Record<string, unknown>): ExportJobRecord {
  return {
    id: String(r.id),
    resourceId: (r.resource_id as string) ?? null,
    resourceName: (r.resource_name as string) ?? null,
    resourceSlug: (r.resource_slug as string) ?? null,
    status: (r.status as 'success' | 'failed' | 'skipped') ?? 'skipped',
    errorCategory: (r.error_category as ExportErrorCategory) ?? null,
    errorMessage: (r.error_message as string) ?? null,
    errorDetails: (r.error_details as Record<string, unknown>) ?? null,
    hasPayload: Boolean(r.has_payload),
    processedAt: String(r.processed_at ?? new Date().toISOString()),
    totalCount: Number(r.total_count ?? 0),
  };
}

// ─── Retry ────────────────────────────────────────────────────────────

export type RetryMode = 'all' | 'failed';

export const RETRY_MODE_LABELS: Record<RetryMode, string> = {
  all: 'Reintentar todo',
  failed: 'Solo reintentar fallidos',
};

export const RETRY_MODE_HINTS: Record<RetryMode, string> = {
  all: 'Reprocesa los {total} recursos del job original, incluidos los que tuvieron éxito.',
  failed: 'Reprocesa solo los {failed} recursos que fallaron, dejando intactos los que fueron bien.',
};

// ─── Tabs del drawer ──────────────────────────────────────────────────

export type DrawerTab = 'summary' | 'payload' | 'errors' | 'records';

export const DRAWER_TAB_LABELS: Record<DrawerTab, string> = {
  summary: 'Resumen',
  payload: 'Payload',
  errors: 'Errores',
  records: 'Records',
};

// ─── Helper · descarga de JSON/texto como fichero ──────────────────────

/**
 * Descarga un contenido como fichero. Se ejecuta en cliente, usa
 * URL.createObjectURL + link sintético.
 */
export function downloadAsFile(
  content: string,
  filename: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Liberar después de un tick
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Genera un nombre de fichero para descargas de exportación.
 * Ej: osalnes-export-pid-20260423-1435-abc123.json
 */
export function buildDownloadFilename(params: {
  jobType: string;
  jobId: string;
  extension: 'json' | 'txt';
  startedAt: string;
}): string {
  const d = new Date(params.startedAt);
  const stamp =
    d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0') +
    '-' +
    String(d.getHours()).padStart(2, '0') +
    String(d.getMinutes()).padStart(2, '0');
  const shortId = params.jobId.slice(0, 8);
  return `osalnes-export-${params.jobType}-${stamp}-${shortId}.${params.extension}`;
}
