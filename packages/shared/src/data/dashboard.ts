/**
 * Modelo de datos del Dashboard operativo (SCR-02)
 */

// ─── Overview ─────────────────────────────────────────────────────────

export interface DashboardOverview {
  // KPIs
  total: number;
  published: number;
  scheduled: number;
  draft: number;
  inReview: number;
  archived: number;
  incompleteForPublish: number;

  // Alertas derivadas
  withoutImage: number;
  withoutCoordinates: number;
  withoutDescriptionEs: number;

  // Último evento relevante
  lastPublishedAt: string | null;
  lastExportAt: string | null;
  lastExportStatus: string | null;
}

export const EMPTY_OVERVIEW: DashboardOverview = {
  total: 0,
  published: 0,
  scheduled: 0,
  draft: 0,
  inReview: 0,
  archived: 0,
  incompleteForPublish: 0,
  withoutImage: 0,
  withoutCoordinates: 0,
  withoutDescriptionEs: 0,
  lastPublishedAt: null,
  lastExportAt: null,
  lastExportStatus: null,
};

// ─── Mi trabajo (borradores del usuario) ──────────────────────────────

export interface MyWorkRow {
  id: string;
  nameEs: string;
  nameGl: string;
  slug: string;
  singleTypeVocabulary: string | null;
  publicationStatus: 'draft' | 'in_review';
  qualityScore: number;
  pidMissingRequired: number;
  updatedAt: string;
}

// ─── Próximas programadas ─────────────────────────────────────────────

export interface ScheduledRow {
  id: string;
  nameEs: string;
  nameGl: string;
  slug: string;
  singleTypeVocabulary: string | null;
  municipalityName: string | null;
  scheduledPublishAt: string;
  qualityScore: number;
  pidMissingRequired: number;
}

// ─── Actividad reciente ───────────────────────────────────────────────

export interface ActivityRow {
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  createdAt: string;
  fieldName: string;
}

// ─── Progreso de traducción por idioma ────────────────────────────────

export interface TranslationProgressRow {
  languageCode: 'es' | 'gl' | 'en' | 'fr' | 'pt';
  totalResources: number;
  translatedCount: number;
  progressPercent: number;
}

// ─── Indicadores UNE 178502 ───────────────────────────────────────────

export type UneIndicatorBand = 'A' | 'B' | 'C' | 'D';

export interface UneIndicator {
  percent: number;
  band: UneIndicatorBand;
}

export interface UneIndicators {
  digitalization: UneIndicator;
  multilingualism: UneIndicator;
  georeferencing: UneIndicator;
  freshness30d: UneIndicator;
  freshness90d: UneIndicator;
  pidInterop: UneIndicator;
}

export const EMPTY_UNE_INDICATORS: UneIndicators = {
  digitalization: { percent: 0, band: 'D' },
  multilingualism: { percent: 0, band: 'D' },
  georeferencing: { percent: 0, band: 'D' },
  freshness30d: { percent: 0, band: 'D' },
  freshness90d: { percent: 0, band: 'D' },
  pidInterop: { percent: 0, band: 'D' },
};

// ─── Mappers ──────────────────────────────────────────────────────────

export function mapRpcOverview(r: Record<string, unknown>): DashboardOverview {
  return {
    total: Number(r.total ?? 0),
    published: Number(r.published ?? 0),
    scheduled: Number(r.scheduled ?? 0),
    draft: Number(r.draft ?? 0),
    inReview: Number(r.in_review ?? 0),
    archived: Number(r.archived ?? 0),
    incompleteForPublish: Number(r.incomplete_for_publish ?? 0),
    withoutImage: Number(r.without_image ?? 0),
    withoutCoordinates: Number(r.without_coordinates ?? 0),
    withoutDescriptionEs: Number(r.without_description_es ?? 0),
    lastPublishedAt: (r.last_published_at as string) ?? null,
    lastExportAt: (r.last_export_at as string) ?? null,
    lastExportStatus: (r.last_export_status as string) ?? null,
  };
}

export function mapRpcMyWorkRow(r: Record<string, unknown>): MyWorkRow {
  return {
    id: String(r.id),
    nameEs: String(r.name_es ?? ''),
    nameGl: String(r.name_gl ?? ''),
    slug: String(r.slug ?? ''),
    singleTypeVocabulary: (r.single_type_vocabulary as string) ?? null,
    publicationStatus: (r.publication_status as 'draft' | 'in_review') ?? 'draft',
    qualityScore: Number(r.quality_score ?? 0),
    pidMissingRequired: Number(r.pid_missing_required ?? 0),
    updatedAt: String(r.updated_at ?? new Date().toISOString()),
  };
}

export function mapRpcScheduledRow(r: Record<string, unknown>): ScheduledRow {
  return {
    id: String(r.id),
    nameEs: String(r.name_es ?? ''),
    nameGl: String(r.name_gl ?? ''),
    slug: String(r.slug ?? ''),
    singleTypeVocabulary: (r.single_type_vocabulary as string) ?? null,
    municipalityName: (r.municipality_name as string) ?? null,
    scheduledPublishAt: String(r.scheduled_publish_at),
    qualityScore: Number(r.quality_score ?? 0),
    pidMissingRequired: Number(r.pid_missing_required ?? 0),
  };
}

export function mapRpcActivityRow(r: Record<string, unknown>): ActivityRow {
  return {
    actorEmail: (r.actor_email as string) ?? null,
    action: String(r.action ?? 'Modificado'),
    entityType: String(r.entity_type ?? 'resource'),
    entityId: String(r.entity_id ?? ''),
    entityName: String(r.entity_name ?? '(sin nombre)'),
    createdAt: String(r.created_at ?? new Date().toISOString()),
    fieldName: String(r.field_name ?? ''),
  };
}

export function mapRpcTranslationRow(r: Record<string, unknown>): TranslationProgressRow {
  return {
    languageCode: (r.language_code as TranslationProgressRow['languageCode']) ?? 'es',
    totalResources: Number(r.total_resources ?? 0),
    translatedCount: Number(r.translated_count ?? 0),
    progressPercent: Number(r.progress_percent ?? 0),
  };
}

export function mapRpcUneIndicators(r: Record<string, unknown>): UneIndicators {
  return {
    digitalization: {
      percent: Number(r.digitalization_percent ?? 0),
      band: (r.digitalization_band as UneIndicatorBand) ?? 'D',
    },
    multilingualism: {
      percent: Number(r.multilingualism_percent ?? 0),
      band: (r.multilingualism_band as UneIndicatorBand) ?? 'D',
    },
    georeferencing: {
      percent: Number(r.georeferencing_percent ?? 0),
      band: (r.georeferencing_band as UneIndicatorBand) ?? 'D',
    },
    freshness30d: {
      percent: Number(r.freshness_30d_percent ?? 0),
      band: (r.freshness_30d_band as UneIndicatorBand) ?? 'D',
    },
    freshness90d: {
      percent: Number(r.freshness_90d_percent ?? 0),
      band: (r.freshness_90d_band as UneIndicatorBand) ?? 'D',
    },
    pidInterop: {
      percent: Number(r.pid_interop_percent ?? 0),
      band: (r.pid_interop_band as UneIndicatorBand) ?? 'D',
    },
  };
}

// ─── Formateo de fechas ────────────────────────────────────────────────

/** "en 2 días · mar 15 abr" | "mañana · 10:30" | "en 3 h" */
export function formatScheduledLabel(iso: string): string {
  const d = new Date(iso);
  const diffMs = d.getTime() - Date.now();
  if (diffMs < 0) return 'vencido';

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `en ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `en ${hours} h · ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
  const days = Math.floor(hours / 24);
  if (days === 1) return `mañana · ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
  if (days < 7) {
    return `en ${days} días · ${d.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })}`;
  }
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** "hace 3 h" | "hace 2 días" | "15 abr 2026" */
export function formatRelativePast(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'ahora mismo';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} día${days === 1 ? '' : 's'}`;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}
