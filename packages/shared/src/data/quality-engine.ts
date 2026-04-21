/**
 * Motor global de calidad del recurso (Paso 7)
 *
 * Amplía `seo-audit.ts` del paso 6 con checks de todos los pasos del
 * wizard:
 *   - Paso 1 · Identificación (tipología, nombre, slug, municipio)
 *   - Paso 2 · Contenido (descripción ES/GL, longitud, visibilidad)
 *   - Paso 3 · Ubicación (coordenadas, dirección, contacto, horarios)
 *   - Paso 4 · Clasificación (establecimiento, tags)
 *   - Paso 5 · Multimedia (foto principal, alt text, vídeos, documentos)
 *   - Paso 6 · SEO (reutiliza auditSeo)
 *
 * Cada check devuelve `{ status, label, explanation, weight, stepRef }`.
 * `stepRef` permite que la UI del paso 7 lleve al usuario al paso
 * correspondiente con un clic en "Editar".
 *
 * El score global es una media ponderada; la UI lo muestra grande.
 *
 * Decisión del usuario 7-B: motor global unificado reutilizando el
 * motor SEO del paso 6.
 */

import {
  auditSeo,
  type SeoCheck,
  type SeoReport,
  type AuditContext as SeoAuditContext,
  type CheckStatus,
} from './seo-audit';
import { type ResourceSeo } from './seo';
import { validatePlan, type OpeningHoursPlan } from './opening-hours';
import { hasAnyEstablishmentField, getEstablishmentFields } from './establishment-fields';

// ─── Tipos públicos ────────────────────────────────────────────────────

export type QualityStep =
  | 'identification'
  | 'content'
  | 'location'
  | 'classification'
  | 'multimedia'
  | 'seo';

export interface QualityCheck {
  key: string;
  label: string;
  explanation: string;
  status: CheckStatus;
  weight: number;
  /** Paso al que corresponde este check (para el botón "Editar") */
  stepRef: QualityStep;
}

/** Estado agregado de un paso (para los checkmarks honestos de las tarjetas) */
export type StepStatus = 'empty' | 'incomplete' | 'warn' | 'ok';

export interface StepAggregate {
  step: QualityStep;
  status: StepStatus;
  failCount: number;
  warnCount: number;
  passCount: number;
}

export interface QualityReport {
  checks: QualityCheck[];
  /** Nota global 0-100 */
  score: number;
  /** Resúmenes por paso (para las tarjetas de la página) */
  byStep: Record<QualityStep, StepAggregate>;
  /** Número de errores críticos (fail) agregados */
  criticalCount: number;
  /** Número de avisos (warn) agregados */
  warnCount: number;
  /** Puede publicarse sin warnings de consentimiento explícito */
  canPublishCleanly: boolean;
}

// ─── Shape del recurso que recibe el motor ─────────────────────────────

export interface ResourceSnapshot {
  // Paso 1
  mainTypeKey: string | null;
  nameEs: string;
  nameGl: string;
  slug: string;
  municipioId: string | null;
  municipioName: string | null;

  // Paso 2
  descriptionEs: string;
  descriptionGl: string;
  accessPublic: boolean;
  accessFree: boolean;
  visibleOnMap: boolean;

  // Paso 3
  latitude: number | null;
  longitude: number | null;
  streetAddress: string;
  postalCode: string;
  contactPhone: string;
  contactEmail: string;
  contactWeb: string;
  hoursPlan: OpeningHoursPlan | null;

  // Paso 4
  accommodationRating: number | null;
  occupancy: number | null;
  servesCuisine: string[];
  tagKeys: string[];

  // Paso 5
  imageCount: number;
  primaryImageId: string | null;
  imagesWithoutAltCount: number;
  videoCount: number;
  documentCount: number;

  // Paso 6 (SEO)
  seo: ResourceSeo;
}

// ─── Motor principal ───────────────────────────────────────────────────

export function auditResource(snap: ResourceSnapshot): QualityReport {
  const checks: QualityCheck[] = [];

  // 1) Identificación
  checks.push(...identificationChecks(snap));

  // 2) Contenido
  checks.push(...contentChecks(snap));

  // 3) Ubicación
  checks.push(...locationChecks(snap));

  // 4) Clasificación
  checks.push(...classificationChecks(snap));

  // 5) Multimedia
  checks.push(...multimediaChecks(snap));

  // 6) SEO — reutiliza el motor del paso 6 y convierte sus checks
  const seoReport = auditSeo(snap.seo, {
    resourceName: snap.nameEs,
    descriptionEs: snap.descriptionEs,
    hasPrimaryImage: snap.primaryImageId != null,
  });
  checks.push(...adaptSeoChecks(seoReport));

  // ─── Score global ─────────────────────────────────────────────────
  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  const lostPoints = checks.reduce((s, c) => {
    if (c.status === 'fail') return s + c.weight;
    if (c.status === 'warn') return s + c.weight * 0.4;
    return s;
  }, 0);
  const score = totalWeight > 0
    ? Math.max(0, Math.round(100 * (1 - lostPoints / totalWeight)))
    : 100;

  // ─── Agregados por paso ───────────────────────────────────────────
  const byStep = aggregateByStep(checks);

  const criticalCount = checks.filter((c) => c.status === 'fail').length;
  const warnCount = checks.filter((c) => c.status === 'warn').length;

  return {
    checks,
    score,
    byStep,
    criticalCount,
    warnCount,
    canPublishCleanly: criticalCount === 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Checks por paso
// ═══════════════════════════════════════════════════════════════════════

function identificationChecks(snap: ResourceSnapshot): QualityCheck[] {
  const out: QualityCheck[] = [];

  // Tipología principal obligatoria
  out.push(snap.mainTypeKey
    ? check('id.type.ok', 'Tipología principal', 'Hay tipología asignada.', 'pass', 15, 'identification')
    : check('id.type.missing', 'Tipología principal', 'Sin tipología principal el recurso no puede clasificarse ni exportarse al PID.', 'fail', 15, 'identification'));

  // Nombre ES obligatorio
  out.push(snap.nameEs.trim()
    ? check('id.name.es.ok', 'Nombre en castellano', 'El nombre está presente.', 'pass', 12, 'identification')
    : check('id.name.es.missing', 'Nombre en castellano', 'El nombre es obligatorio. Sin él, el recurso no puede identificarse.', 'fail', 12, 'identification'));

  // Nombre GL recomendado
  if (!snap.nameGl.trim()) {
    out.push(check('id.name.gl.missing', 'Nombre en gallego', 'La Mancomunidade es Galicia. El nombre en gallego es importante por motivos legales (Lei 3/1983 de normalización lingüística).', 'warn', 8, 'identification'));
  } else {
    out.push(check('id.name.gl.ok', 'Nombre en gallego', 'Versión en gallego disponible.', 'pass', 8, 'identification'));
  }

  // Municipio obligatorio
  out.push(snap.municipioId
    ? check('id.muni.ok', 'Municipio', 'Municipio asignado.', 'pass', 10, 'identification')
    : check('id.muni.missing', 'Municipio', 'El municipio es obligatorio. Sin él, el recurso no puede aparecer filtrado por zona ni exportarse al PID.', 'fail', 10, 'identification'));

  // Slug: no hacemos check aquí porque ya lo hace el motor SEO (paso 6).

  return out;
}

function contentChecks(snap: ResourceSnapshot): QualityCheck[] {
  const out: QualityCheck[] = [];

  const wordsEs = countWords(snap.descriptionEs);
  const wordsGl = countWords(snap.descriptionGl);

  // Descripción ES: mínimo funcional 30 palabras, recomendado 80+
  if (wordsEs === 0) {
    out.push(check('content.desc.es.missing', 'Descripción en castellano',
      'Sin descripción, la ficha pública se ve vacía y el SEO es pobre.',
      'fail', 15, 'content'));
  } else if (wordsEs < 30) {
    out.push(check('content.desc.es.short', `Descripción en castellano corta (${wordsEs} palabras)`,
      'Muy breve. Lo recomendable son 80-200 palabras para dar contexto suficiente.',
      'warn', 10, 'content'));
  } else if (wordsEs < 80) {
    out.push(check('content.desc.es.mid', `Descripción en castellano suficiente (${wordsEs} palabras)`,
      'Puede ampliarse para mejorar SEO y experiencia del visitante.',
      'warn', 5, 'content'));
  } else {
    out.push(check('content.desc.es.ok', `Descripción en castellano (${wordsEs} palabras)`,
      'Longitud adecuada.', 'pass', 10, 'content'));
  }

  // Descripción GL: si hay ES, también debería haber GL
  if (wordsEs > 0 && wordsGl === 0) {
    out.push(check('content.desc.gl.missing', 'Descripción en gallego',
      'Hay descripción en castellano pero falta la gallega. Incompleto para un destino en Galicia.',
      'warn', 8, 'content'));
  } else if (wordsGl > 0 && wordsGl < 30) {
    out.push(check('content.desc.gl.short', `Descripción en gallego corta (${wordsGl} palabras)`,
      'Ampliable. Lo ideal es que tenga longitud similar a la castellana.',
      'warn', 5, 'content'));
  } else if (wordsGl > 0) {
    out.push(check('content.desc.gl.ok', `Descripción en gallego (${wordsGl} palabras)`,
      'Versión gallega disponible.', 'pass', 8, 'content'));
  }

  return out;
}

function locationChecks(snap: ResourceSnapshot): QualityCheck[] {
  const out: QualityCheck[] = [];

  // Coordenadas: si el recurso está "visible en mapa", son obligatorias
  const hasCoords = snap.latitude != null && snap.longitude != null;

  if (snap.visibleOnMap && !hasCoords) {
    out.push(check('loc.coords.missing', 'Coordenadas',
      'Marcaste "visible en mapa" pero no hay coordenadas. El recurso no aparecerá en el mapa público.',
      'fail', 12, 'location'));
  } else if (!snap.visibleOnMap && !hasCoords) {
    out.push(check('loc.coords.nomap', 'Sin coordenadas',
      'El recurso no se mostrará en el mapa. Está bien para recursos inmateriales (leyendas, fiestas sin lugar fijo).',
      'pass', 4, 'location'));
  } else {
    out.push(check('loc.coords.ok', 'Coordenadas', 'Ubicación en el mapa disponible.', 'pass', 12, 'location'));
  }

  // Dirección postal
  if (hasCoords && !snap.streetAddress.trim()) {
    out.push(check('loc.street.missing', 'Dirección postal',
      'Hay coordenadas pero falta la dirección. Es útil para visitantes que prefieren buscar por calle.',
      'warn', 5, 'location'));
  } else if (snap.streetAddress.trim()) {
    out.push(check('loc.street.ok', 'Dirección postal', 'Dirección disponible.', 'pass', 5, 'location'));
  }

  // Algún medio de contacto
  const hasContact = !!(snap.contactPhone || snap.contactEmail || snap.contactWeb).trim?.() ||
    snap.contactPhone.trim() || snap.contactEmail.trim() || snap.contactWeb.trim();

  if (!hasContact) {
    out.push(check('loc.contact.missing', 'Medios de contacto',
      'Ningún teléfono, email ni web. Los visitantes no sabrán cómo preguntar.',
      'warn', 6, 'location'));
  } else {
    out.push(check('loc.contact.ok', 'Medios de contacto', 'Al menos un medio de contacto disponible.', 'pass', 6, 'location'));
  }

  // Horarios
  if (!snap.hoursPlan) {
    out.push(check('loc.hours.missing', 'Horarios',
      'Sin horarios declarados. Los visitantes no saben cuándo visitar.',
      'warn', 5, 'location'));
  } else {
    const errors = validatePlan(snap.hoursPlan);
    if (errors.length > 0) {
      out.push(check('loc.hours.invalid', 'Horarios con errores',
        `Hay ${errors.length} problema${errors.length === 1 ? '' : 's'} en los horarios: ${errors[0]}`,
        'warn', 5, 'location'));
    } else {
      out.push(check('loc.hours.ok', 'Horarios', 'Horarios bien definidos.', 'pass', 5, 'location'));
    }
  }

  return out;
}

function classificationChecks(snap: ResourceSnapshot): QualityCheck[] {
  const out: QualityCheck[] = [];

  // Etiquetas totales (sin contar curaduria-editorial)
  const realTags = snap.tagKeys.filter((k) => !k.startsWith('curaduria-editorial.'));
  if (realTags.length === 0) {
    out.push(check('cls.tags.missing', 'Etiquetas de clasificación',
      'Sin etiquetas el recurso no se encuentra al filtrar en la web. Marca al menos 3 etiquetas que describan el recurso.',
      'fail', 10, 'classification'));
  } else if (realTags.length < 3) {
    out.push(check('cls.tags.few', `Pocas etiquetas (${realTags.length})`,
      'Lo ideal son 5-10 etiquetas. Usa "Sugerir con IA" en el paso 4 para encontrar las más relevantes.',
      'warn', 6, 'classification'));
  } else {
    out.push(check('cls.tags.ok', `${realTags.length} etiquetas`, 'Buen nivel de clasificación.', 'pass', 10, 'classification'));
  }

  // Campos específicos del establecimiento si aplican
  if (hasAnyEstablishmentField(snap.mainTypeKey)) {
    const fields = getEstablishmentFields(snap.mainTypeKey);
    if (fields.showRating && snap.accommodationRating == null) {
      out.push(check('cls.rating.missing', 'Clasificación oficial',
        'Este tipo de recurso suele tener clasificación oficial (estrellas/tenedores/categoría). Añadirla mejora la credibilidad.',
        'warn', 4, 'classification'));
    }
    if (fields.showCuisine && snap.servesCuisine.length === 0) {
      out.push(check('cls.cuisine.missing', 'Tipos de cocina',
        'Un restaurante o bodega sin tipos de cocina aparecerá mal filtrado en la web.',
        'warn', 5, 'classification'));
    }
  }

  return out;
}

function multimediaChecks(snap: ResourceSnapshot): QualityCheck[] {
  const out: QualityCheck[] = [];

  // Sin fotos
  if (snap.imageCount === 0) {
    out.push(check('media.photo.missing', 'Fotos',
      'Sin foto de portada, la ficha pública queda muy fría. Añade al menos una foto representativa.',
      'fail', 12, 'multimedia'));
    return out;
  }

  // Foto principal
  if (snap.primaryImageId == null) {
    out.push(check('media.primary.missing', 'Foto de portada',
      'Hay fotos pero ninguna marcada como portada. Selecciona la foto principal con la estrella.',
      'warn', 6, 'multimedia'));
  } else {
    out.push(check('media.primary.ok', 'Foto de portada', 'Portada asignada.', 'pass', 6, 'multimedia'));
  }

  // Alt text · crítico para WCAG 2.1 AA (criterio 1.1.1)
  if (snap.imagesWithoutAltCount > 0) {
    out.push(check('media.alt.missing', `${snap.imagesWithoutAltCount} foto${snap.imagesWithoutAltCount === 1 ? '' : 's'} sin descripción`,
      'Las fotos sin alt text no cumplen accesibilidad WCAG 2.1 AA, que es exigencia del pliego. Usa "Generar descripciones con IA" en el paso 5.',
      'fail', 10, 'multimedia'));
  } else {
    out.push(check('media.alt.ok', 'Descripciones de foto', 'Todas las fotos tienen alt text (WCAG 2.1 AA).', 'pass', 10, 'multimedia'));
  }

  // Vídeos y documentos: bonus, no penaliza
  if (snap.videoCount > 0) {
    out.push(check('media.video.ok', `${snap.videoCount} vídeo${snap.videoCount === 1 ? '' : 's'}`, 'Contenido audiovisual añadido.', 'pass', 3, 'multimedia'));
  }
  if (snap.documentCount > 0) {
    out.push(check('media.doc.ok', `${snap.documentCount} documento${snap.documentCount === 1 ? '' : 's'} descargable${snap.documentCount === 1 ? '' : 's'}`,
      'Documentos descargables disponibles.', 'pass', 3, 'multimedia'));
  }

  return out;
}

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

function adaptSeoChecks(report: SeoReport): QualityCheck[] {
  return report.checks
    .filter((c) => c.weight > 0)
    .map((c: SeoCheck): QualityCheck => ({
      key: c.key,
      label: c.label,
      explanation: c.explanation,
      status: c.status,
      weight: c.weight,
      stepRef: 'seo',
    }));
}

function check(
  key: string,
  label: string,
  explanation: string,
  status: CheckStatus,
  weight: number,
  stepRef: QualityStep,
): QualityCheck {
  return { key, label, explanation, status, weight, stepRef };
}

function countWords(s: string): number {
  const trimmed = s.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function aggregateByStep(checks: QualityCheck[]): Record<QualityStep, StepAggregate> {
  const steps: QualityStep[] = ['identification', 'content', 'location', 'classification', 'multimedia', 'seo'];
  const result = {} as Record<QualityStep, StepAggregate>;

  for (const step of steps) {
    const subset = checks.filter((c) => c.stepRef === step);
    const failCount = subset.filter((c) => c.status === 'fail').length;
    const warnCount = subset.filter((c) => c.status === 'warn').length;
    const passCount = subset.filter((c) => c.status === 'pass').length;

    let status: StepStatus;
    if (subset.length === 0) status = 'empty';
    else if (failCount > 0) status = 'incomplete';
    else if (warnCount > 0) status = 'warn';
    else status = 'ok';

    result[step] = { step, status, failCount, warnCount, passCount };
  }

  return result;
}
