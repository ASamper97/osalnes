/**
 * GoogleSearchPreview — previsualización de cómo se ve el recurso en Google
 *
 * Es un componente puramente visual: imita el resultado de búsqueda de
 * Google Desktop. Sirve para que el funcionario vea EN VIVO cómo queda
 * su título SEO y su descripción mientras los escribe.
 *
 * Decisión 1-C del usuario: preview de Google en vivo.
 *
 * No hace llamadas a Google; es solo una maqueta HTML + CSS con los
 * colores y tipografías aproximados. Si Google cambia su diseño (pasa
 * cada 1-2 años), solo hay que ajustar este componente.
 *
 * Fallbacks:
 *   - Título vacío → nombre del recurso + copy fallback en cursiva
 *   - Descripción vacía → copy fallback en cursiva
 *   - Trunca con "…" si excede el hardMax
 */

import { SEO_LIMITS } from '@osalnes/shared/data/seo';
import { STEP6_COPY } from '../pages/step6-seo.copy';

const COPY = STEP6_COPY.googlePreview;

export interface GoogleSearchPreviewProps {
  title: string;
  description: string;
  /** Nombre del recurso (paso 1) — fallback si no hay título SEO */
  resourceName: string;
  /** Slug del recurso para construir la URL */
  slug: string;
}

export default function GoogleSearchPreview({
  title,
  description,
  resourceName,
  slug,
}: GoogleSearchPreviewProps) {
  const effectiveTitle = title.trim() || resourceName.trim();
  const hasTitle = title.trim().length > 0;
  const hasDesc = description.trim().length > 0;

  // Truncado mimando lo que hace Google
  const truncatedTitle = truncateToMax(effectiveTitle, SEO_LIMITS.title.hardMax);
  const truncatedDesc = truncateToMax(description, SEO_LIMITS.description.hardMax);

  const slugDisplay = slug.trim() || '…';

  return (
    <section className="google-preview" aria-label={COPY.title}>
      <header className="google-preview-head">
        <h4>{COPY.title}</h4>
        <p className="muted">{COPY.subtitle}</p>
      </header>

      <div className="google-result">
        {/* Header con favicon + breadcrumb URL */}
        <div className="google-result-head">
          <div className="google-result-favicon" aria-hidden>
            <div className="google-favicon-circle">
              <span>O</span>
            </div>
          </div>
          <div className="google-result-url-block">
            <div className="google-result-site">Mancomunidade de O Salnés</div>
            <div className="google-result-url">
              {COPY.urlPrefix} › <span className="google-result-slug">{slugDisplay}</span>
            </div>
          </div>
        </div>

        {/* Título */}
        <h3 className="google-result-title">
          {hasTitle ? (
            truncatedTitle
          ) : (
            <>
              {resourceName.trim() || <em>{COPY.fallbackTitle}</em>}
            </>
          )}
        </h3>

        {/* Descripción */}
        <p className="google-result-description">
          {hasDesc ? (
            truncatedDesc
          ) : (
            <em className="muted">{COPY.fallbackDescription}</em>
          )}
        </p>
      </div>
    </section>
  );
}

/**
 * Trunca un string a N caracteres añadiendo "…" si excede.
 * Intenta cortar en un espacio para no partir palabras.
 */
function truncateToMax(text: string, max: number): string {
  if (text.length <= max) return text;
  const hard = text.slice(0, max);
  const lastSpace = hard.lastIndexOf(' ');
  const base = lastSpace > max * 0.6 ? hard.slice(0, lastSpace) : hard;
  return `${base.trimEnd()}…`;
}
