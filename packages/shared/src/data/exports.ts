/**
 * Modelo de datos del Centro de exportaciones (SCR-13)
 */

// ─── Tipos principales ────────────────────────────────────────────────

export type ExportJobType = 'pid' | 'data_lake' | 'csv' | 'json_ld';

export type ExportJobStatus = 'pending' | 'running' | 'success' | 'partial' | 'failed';

export type ExportScopeType = 'all_published' | 'filtered' | 'selected' | 'single';

export type ExportErrorCategory = 'content' | 'integration' | 'schema' | 'permissions';

// ─── Metadata visual por tipo/estado ──────────────────────────────────

export const JOB_TYPE_LABELS: Record<ExportJobType, string> = {
  pid: 'PID (JSON-LD schema.org)',
  data_lake: 'Data Lake Semántico',
  csv: 'CSV plano',
  json_ld: 'JSON-LD genérico',
};

export const JOB_TYPE_SHORT_LABELS: Record<ExportJobType, string> = {
  pid: 'PID',
  data_lake: 'Data Lake',
  csv: 'CSV',
  json_ld: 'JSON-LD',
};

export const JOB_TYPE_ICONS: Record<ExportJobType, string> = {
  pid: '🏛',
  data_lake: '💧',
  csv: '📄',
  json_ld: '📊',
};

export const JOB_STATUS_LABELS: Record<ExportJobStatus, string> = {
  pending: 'En cola',
  running: 'En proceso',
  success: 'Éxito',
  partial: 'Parcial',
  failed: 'Error',
};

export const SCOPE_TYPE_LABELS: Record<ExportScopeType, string> = {
  all_published: 'Todos los publicados',
  filtered: 'Filtrados',
  selected: 'Seleccionados',
  single: 'Un solo recurso',
};

export const ERROR_CATEGORY_LABELS: Record<ExportErrorCategory, string> = {
  content: 'Error de contenido',
  integration: 'Error de integración',
  schema: 'Error de esquema',
  permissions: 'Error de permisos',
};

/**
 * Mapeo de categoría → explicación humana para mostrar al editor.
 * Cumple el principio del pliego: "no esconder el error bajo tecnicismos".
 */
export const ERROR_CATEGORY_HINTS: Record<ExportErrorCategory, string> = {
  content: 'Faltan campos obligatorios en el recurso. Edita el recurso para completarlos.',
  integration: 'El sistema destino no respondió correctamente. Suele ser temporal — puedes reintentar.',
  schema: 'El payload no cumple el formato esperado. Revisa la configuración del tipo de exportación.',
  permissions: 'No tienes permisos para esta operación. Contacta con un administrador.',
};

// ─── Fila del listado de jobs ─────────────────────────────────────────

export interface ExportJobRow {
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
  isRetry: boolean;
  retryOf: string | null;
  totalCount: number;
}

export function mapRpcExportJobRow(r: Record<string, unknown>): ExportJobRow {
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
    isRetry: Boolean(r.is_retry),
    retryOf: (r.retry_of as string) ?? null,
    totalCount: Number(r.total_count ?? 0),
  };
}

// ─── KPIs del centro ──────────────────────────────────────────────────

export interface ExportsKpis {
  totalJobs: number;
  success24h: number;
  failed24h: number;
  pendingNow: number;
  runningNow: number;
  avgDurationMs: number | null;
  lastSuccessAt: string | null;
  lastSuccessType: ExportJobType | null;
}

export const EMPTY_EXPORTS_KPIS: ExportsKpis = {
  totalJobs: 0,
  success24h: 0,
  failed24h: 0,
  pendingNow: 0,
  runningNow: 0,
  avgDurationMs: null,
  lastSuccessAt: null,
  lastSuccessType: null,
};

export function mapRpcExportsKpis(r: Record<string, unknown>): ExportsKpis {
  return {
    totalJobs: Number(r.total_jobs ?? 0),
    success24h: Number(r.success_24h ?? 0),
    failed24h: Number(r.failed_24h ?? 0),
    pendingNow: Number(r.pending_now ?? 0),
    runningNow: Number(r.running_now ?? 0),
    avgDurationMs: r.avg_duration_ms != null ? Number(r.avg_duration_ms) : null,
    lastSuccessAt: (r.last_success_at as string) ?? null,
    lastSuccessType: (r.last_success_type as ExportJobType) ?? null,
  };
}

// ─── Pre-validación de alcance ────────────────────────────────────────

export interface ValidationFailure {
  resourceId: string;
  resourceName: string;
  resourceSlug: string;
  missingCount: number;
  errorCategory: ExportErrorCategory;
  errorMessage: string;
}

export interface ScopeValidation {
  totalInScope: number;
  passingCount: number;
  failingCount: number;
  sampleFailures: ValidationFailure[];
}

export const EMPTY_VALIDATION: ScopeValidation = {
  totalInScope: 0,
  passingCount: 0,
  failingCount: 0,
  sampleFailures: [],
};

export function mapRpcValidation(r: Record<string, unknown>): ScopeValidation {
  const rawSample = r.sample_failures;
  const sample: ValidationFailure[] = Array.isArray(rawSample)
    ? (rawSample as Record<string, unknown>[]).map((f) => ({
        resourceId: String(f.resource_id),
        resourceName: String(f.resource_name ?? ''),
        resourceSlug: String(f.resource_slug ?? ''),
        missingCount: Number(f.missing_count ?? 0),
        errorCategory: (f.error_category as ExportErrorCategory) ?? 'content',
        errorMessage: String(f.error_message ?? ''),
      }))
    : [];

  return {
    totalInScope: Number(r.total_in_scope ?? 0),
    passingCount: Number(r.passing_count ?? 0),
    failingCount: Number(r.failing_count ?? 0),
    sampleFailures: sample,
  };
}

// ─── Formato de duración ──────────────────────────────────────────────

export function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.floor((ms % 60_000) / 1000);
  return `${min} min ${sec} s`;
}

// ─── Helper: progreso de job running ──────────────────────────────────

export function computeProgress(job: ExportJobRow): number {
  if (job.recordsTotal === 0) return 0;
  return Math.round(((job.recordsProcessed + job.recordsFailed) / job.recordsTotal) * 100);
}
