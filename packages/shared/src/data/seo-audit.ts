/**
 * Motor de auditoría SEO (decisión 1-C)
 *
 * Dado un `ResourceSeo` + contexto del recurso, devuelve un informe con
 * checks específicos (✓ pass / ⚠ warn / ✗ fail) y una nota global 0-100.
 *
 * El informe se muestra en el paso 7 (Revisión) y también inline en el
 * paso 6 si el usuario quiere.
 *
 * Checks inspirados en Yoast/RankMath pero simplificados y en castellano
 * para el perfil del funcionario municipal.
 */

import {
  type ResourceSeo,
  type AnyLang,
  SEO_LIMITS,
  countVisibleChars,
  isValidSlug,
} from './seo.js';

// ─── Tipos ─────────────────────────────────────────────────────────────

export type CheckStatus = 'pass' | 'warn' | 'fail';

export interface SeoCheck {
  /** Clave estable para tests y filtrado */
  key: string;
  /** Título corto del check (lo que ve el usuario) */
  label: string;
  /** Explicación extendida que se muestra al expandir */
  explanation: string;
  status: CheckStatus;
  /** Severidad: cuántos puntos resta un fallo (total 100) */
  weight: number;
}

export interface SeoReport {
  checks: SeoCheck[];
  /** Nota 0-100 */
  score: number;
  /** Cuántos fallos críticos (fail) hay */
  criticalCount: number;
  /** Cuántos avisos (warn) hay */
  warnCount: number;
}

// ─── Contexto que necesita la auditoría ────────────────────────────────

export interface AuditContext {
  /** Nombre del recurso (paso 1) */
  resourceName: string;
  /** Descripción ES del paso 2; se usa para comprobar que keywords aparecen */
  descriptionEs: string;
  /** ¿Tiene imagen principal asignada en paso 5? */
  hasPrimaryImage: boolean;
}

// ─── Motor ─────────────────────────────────────────────────────────────

export function auditSeo(seo: ResourceSeo, ctx: AuditContext): SeoReport {
  const checks: SeoCheck[] = [];

  // ─── 1. Título ES presente y dentro de rango ───────────────────────
  checks.push(checkSeoTitle(seo, 'es', 20));

  // ─── 2. Descripción ES presente y dentro de rango ─────────────────
  checks.push(checkSeoDescription(seo, 'es', 20));

  // ─── 3. Slug válido ────────────────────────────────────────────────
  checks.push(checkSlug(seo, 10));

  // ─── 4. Keywords (3-8 recomendados) ────────────────────────────────
  checks.push(checkKeywords(seo, 8));

  // ─── 5. Imagen Open Graph (principal o override) ──────────────────
  checks.push(checkOgImage(seo, ctx, 10));

  // ─── 6. Al menos una traducción además de GL ──────────────────────
  checks.push(checkTranslations(seo, 8));

  // ─── 7. Gallego completo (paridad con castellano) ─────────────────
  checks.push(checkGallegoParity(seo, 10));

  // ─── 8. Indexabilidad declarada ────────────────────────────────────
  checks.push(checkIndexable(seo, 4));

  // ─── 9. Título != Nombre exacto (sino Google penaliza redundancia) ─
  checks.push(checkTitleNotJustName(seo, ctx, 5));

  // ─── 10. Keywords aparecen en la descripción ──────────────────────
  checks.push(checkKeywordsInDescription(seo, ctx, 5));

  // ─── Cálculo de score ─────────────────────────────────────────────
  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  const lostPoints = checks.reduce((s, c) => {
    if (c.status === 'fail') return s + c.weight;
    if (c.status === 'warn') return s + c.weight * 0.4;
    return s;
  }, 0);
  const score = Math.max(0, Math.round(100 * (1 - lostPoints / totalWeight)));

  return {
    checks,
    score,
    criticalCount: checks.filter((c) => c.status === 'fail').length,
    warnCount: checks.filter((c) => c.status === 'warn').length,
  };
}

// ─── Checks individuales ───────────────────────────────────────────────

function checkSeoTitle(seo: ResourceSeo, lang: AnyLang, weight: number): SeoCheck {
  const value = seo.byLang[lang]?.title ?? '';
  const n = countVisibleChars(value);
  const L = SEO_LIMITS.title;
  const langLabel = lang === 'es' ? 'en castellano' : lang;

  if (n === 0) {
    return {
      key: `seo.title.${lang}.missing`,
      label: `Título SEO ${langLabel} vacío`,
      explanation:
        'Sin título SEO, Google usará el nombre del recurso como fallback. Es mejor escribir un título específico con el municipio o una propuesta de valor.',
      status: 'fail',
      weight,
    };
  }
  if (n < L.recommendedMin) {
    return {
      key: `seo.title.${lang}.short`,
      label: `Título SEO ${langLabel} corto (${n}/${L.recommendedMin})`,
      explanation: `El título ideal tiene entre ${L.recommendedMin} y ${L.recommendedMax} caracteres. Demasiado corto pierde oportunidades de posicionar.`,
      status: 'warn',
      weight,
    };
  }
  if (n > L.hardMax) {
    return {
      key: `seo.title.${lang}.over`,
      label: `Título SEO ${langLabel} muy largo (${n}/${L.hardMax})`,
      explanation: `Google trunca títulos por encima de ${L.hardMax} caracteres con puntos suspensivos. Acórtalo para que se vea completo.`,
      status: 'fail',
      weight,
    };
  }
  if (n > L.recommendedMax) {
    return {
      key: `seo.title.${lang}.long`,
      label: `Título SEO ${langLabel} largo (${n}/${L.recommendedMax})`,
      explanation: `Entre ${L.recommendedMax} y ${L.hardMax} caracteres puede mostrarse truncado en móviles. Reduce si puedes.`,
      status: 'warn',
      weight,
    };
  }
  return {
    key: `seo.title.${lang}.ok`,
    label: `Título SEO ${langLabel} correcto (${n})`,
    explanation: 'Longitud óptima para aparecer completo en resultados de Google.',
    status: 'pass',
    weight,
  };
}

function checkSeoDescription(seo: ResourceSeo, lang: AnyLang, weight: number): SeoCheck {
  const value = seo.byLang[lang]?.description ?? '';
  const n = countVisibleChars(value);
  const L = SEO_LIMITS.description;
  const langLabel = lang === 'es' ? 'en castellano' : lang;

  if (n === 0) {
    return {
      key: `seo.desc.${lang}.missing`,
      label: `Descripción SEO ${langLabel} vacía`,
      explanation:
        'Sin descripción SEO, Google mostrará un extracto automático del contenido. Escribir una propia da mucho más control sobre qué se ve.',
      status: 'fail',
      weight,
    };
  }
  if (n < L.recommendedMin) {
    return {
      key: `seo.desc.${lang}.short`,
      label: `Descripción SEO ${langLabel} corta (${n}/${L.recommendedMin})`,
      explanation: `Lo ideal son ${L.recommendedMin}-${L.recommendedMax} caracteres para aprovechar el espacio que Google muestra en resultados.`,
      status: 'warn',
      weight,
    };
  }
  if (n > L.hardMax) {
    return {
      key: `seo.desc.${lang}.over`,
      label: `Descripción SEO ${langLabel} muy larga (${n}/${L.hardMax})`,
      explanation: `Google corta descripciones largas. Quédate en ${L.recommendedMax} caracteres como máximo práctico.`,
      status: 'fail',
      weight,
    };
  }
  if (n > L.recommendedMax) {
    return {
      key: `seo.desc.${lang}.long`,
      label: `Descripción SEO ${langLabel} largo (${n}/${L.recommendedMax})`,
      explanation: `Por encima de ${L.recommendedMax} caracteres el final puede truncarse. Revisa que la parte importante quede en los primeros ${L.recommendedMax}.`,
      status: 'warn',
      weight,
    };
  }
  return {
    key: `seo.desc.${lang}.ok`,
    label: `Descripción SEO ${langLabel} correcta (${n})`,
    explanation: 'Longitud óptima para que Google muestre el texto completo en resultados.',
    status: 'pass',
    weight,
  };
}

function checkSlug(seo: ResourceSeo, weight: number): SeoCheck {
  const slug = seo.slug.trim();
  if (!slug) {
    return {
      key: 'seo.slug.missing',
      label: 'Slug vacío',
      explanation:
        'El slug es la parte final de la URL (/recurso/TU-SLUG). Sin slug, la URL quedará con el UUID y será menos reconocible.',
      status: 'fail',
      weight,
    };
  }
  if (!isValidSlug(slug)) {
    return {
      key: 'seo.slug.invalid',
      label: 'Slug no válido',
      explanation:
        'El slug solo puede contener letras minúsculas ASCII, números y guiones. Sin acentos, espacios ni símbolos.',
      status: 'fail',
      weight,
    };
  }
  return {
    key: 'seo.slug.ok',
    label: 'Slug correcto',
    explanation: 'La URL del recurso queda limpia y recordable.',
    status: 'pass',
    weight,
  };
}

function checkKeywords(seo: ResourceSeo, weight: number): SeoCheck {
  const n = seo.keywords.length;
  const L = SEO_LIMITS.keywords;
  if (n === 0) {
    return {
      key: 'seo.keywords.missing',
      label: 'Sin palabras clave',
      explanation:
        'Las palabras clave ayudan a nuestro propio buscador interno y a clasificar el recurso en filtros facetados. Pulsa "Sugerir con IA" para empezar.',
      status: 'warn',
      weight,
    };
  }
  if (n < L.recommendedMin) {
    return {
      key: 'seo.keywords.few',
      label: `Pocas palabras clave (${n}/${L.recommendedMin})`,
      explanation: `Ideal entre ${L.recommendedMin} y ${L.recommendedMax}. Añade alguna más.`,
      status: 'warn',
      weight,
    };
  }
  if (n > L.hardMax) {
    return {
      key: 'seo.keywords.too-many',
      label: `Demasiadas palabras clave (${n}/${L.hardMax})`,
      explanation: `Más de ${L.recommendedMax} keywords pierde foco. Quita las menos relevantes.`,
      status: 'warn',
      weight,
    };
  }
  return {
    key: 'seo.keywords.ok',
    label: `Palabras clave OK (${n})`,
    explanation: 'Conjunto razonable de keywords para clasificación interna.',
    status: 'pass',
    weight,
  };
}

function checkOgImage(seo: ResourceSeo, ctx: AuditContext, weight: number): SeoCheck {
  const hasOverride = seo.ogImageOverridePath != null && seo.ogImageOverridePath !== '';
  const hasPrimary = ctx.hasPrimaryImage;

  if (!hasOverride && !hasPrimary) {
    return {
      key: 'seo.og.image.missing',
      label: 'Sin imagen para compartir',
      explanation:
        'Sin imagen Open Graph, cuando alguien comparta el enlace en WhatsApp o Facebook aparecerá sin foto. Marca una foto como portada en el paso 5 o sube una imagen específica aquí.',
      status: 'fail',
      weight,
    };
  }
  return {
    key: 'seo.og.image.ok',
    label: hasOverride ? 'Imagen para compartir personalizada' : 'Imagen para compartir (portada)',
    explanation: hasOverride
      ? 'Se usará la imagen que has subido específicamente para compartir en redes.'
      : 'Se usará la foto principal del paso 5 al compartir en redes.',
    status: 'pass',
    weight,
  };
}

function checkTranslations(seo: ResourceSeo, weight: number): SeoCheck {
  const n = Object.keys(seo.translations).length;
  if (n === 0) {
    return {
      key: 'seo.translations.missing',
      label: 'Sin traducciones adicionales',
      explanation:
        'El recurso aparecerá solo en castellano y gallego. En destinos turísticos, al menos inglés es muy recomendable.',
      status: 'warn',
      weight,
    };
  }
  return {
    key: 'seo.translations.ok',
    label: `${n} traducción${n === 1 ? '' : 'es'} disponible${n === 1 ? '' : 's'}`,
    explanation: 'El recurso estará disponible en varios idiomas para visitantes internacionales.',
    status: 'pass',
    weight,
  };
}

function checkGallegoParity(seo: ResourceSeo, weight: number): SeoCheck {
  const esTitle = seo.byLang.es?.title?.trim() ?? '';
  const glTitle = seo.byLang.gl?.title?.trim() ?? '';

  if (esTitle && !glTitle) {
    return {
      key: 'seo.gl.missing',
      label: 'Falta título SEO en gallego',
      explanation:
        'La Mancomunidade es Galicia. Tener el título en gallego es importante por motivos legales y de cercanía al visitante local.',
      status: 'warn',
      weight,
    };
  }
  return {
    key: 'seo.gl.ok',
    label: 'Castellano y gallego presentes',
    explanation: 'Contenido bilingüe base cubierto.',
    status: 'pass',
    weight,
  };
}

function checkIndexable(seo: ResourceSeo, weight: number): SeoCheck {
  if (!seo.indexable) {
    return {
      key: 'seo.noindex',
      label: 'No indexable en buscadores',
      explanation:
        'Has marcado este recurso como "no visible en buscadores". Asegúrate de que es intencional — no aparecerá en Google.',
      status: 'warn',
      weight,
    };
  }
  return {
    key: 'seo.indexable',
    label: 'Visible en buscadores',
    explanation: 'Google y otros buscadores podrán indexar este recurso.',
    status: 'pass',
    weight,
  };
}

function checkTitleNotJustName(seo: ResourceSeo, ctx: AuditContext, weight: number): SeoCheck {
  const title = (seo.byLang.es?.title ?? '').trim();
  if (!title || !ctx.resourceName) {
    // Si no hay título, ya está cubierto por otro check
    return {
      key: 'seo.title.not-just-name.skip',
      label: 'Título diferenciado (pendiente)',
      explanation: 'Escribe primero el título SEO para comprobar este punto.',
      status: 'pass',
      weight: 0,
    };
  }
  if (title.toLowerCase() === ctx.resourceName.toLowerCase()) {
    return {
      key: 'seo.title.just-name',
      label: 'El título SEO es idéntico al nombre',
      explanation:
        'Cuando el título SEO coincide exactamente con el nombre del recurso, estás desperdiciando esa línea. Añade el municipio, el tipo o una propuesta corta ("Mirador con vistas a la Ría — O Grove").',
      status: 'warn',
      weight,
    };
  }
  return {
    key: 'seo.title.differentiated',
    label: 'Título diferenciado del nombre',
    explanation: 'El título SEO aporta información adicional al nombre.',
    status: 'pass',
    weight,
  };
}

function checkKeywordsInDescription(seo: ResourceSeo, ctx: AuditContext, weight: number): SeoCheck {
  if (seo.keywords.length === 0 || !ctx.descriptionEs) {
    return {
      key: 'seo.keywords.in-desc.skip',
      label: 'Coherencia keywords ↔ descripción',
      explanation: 'Añade keywords y descripción para comprobar este punto.',
      status: 'pass',
      weight: 0,
    };
  }
  const desc = ctx.descriptionEs
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const normalizedKw = seo.keywords.map((k: string) =>
    k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
  );
  const matches = normalizedKw.filter((k: string) => desc.includes(k)).length;
  const pct = matches / normalizedKw.length;

  if (pct < 0.5) {
    return {
      key: 'seo.keywords.disconnected',
      label: 'Keywords poco presentes en la descripción',
      explanation: `Solo ${matches} de ${normalizedKw.length} keywords aparecen en la descripción del paso 2. Revísalo: o añades keywords que sí estén, o enriqueces la descripción para incluirlas.`,
      status: 'warn',
      weight,
    };
  }
  return {
    key: 'seo.keywords.in-desc.ok',
    label: 'Keywords coherentes con la descripción',
    explanation: 'Las palabras clave aparecen en el texto del recurso.',
    status: 'pass',
    weight,
  };
}
