/**
 * SlugEditor — editor del slug con validación y bloqueo si publicado
 *
 * Decisión 3-B: el slug es editable solo si el recurso NO está publicado.
 * En publicación ya no se puede cambiar (rompería enlaces existentes).
 *
 * Valida:
 *   - Formato (solo a-z 0-9 -)
 *   - Longitud máxima
 *   - Disponibilidad (llamada async al backend para ver si ya existe)
 *
 * El check de disponibilidad es debounced a 400ms para no saturar con
 * cada tecleo. Devuelve `isDuplicate(slug)` como prop para que el padre
 * decida la estrategia de consulta (Supabase, cache, etc).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  SEO_LIMITS,
  isValidSlug,
  slugify,
} from '@osalnes/shared/data/seo';
import { STEP6_COPY } from '../pages/step6-seo.copy';

const COPY = STEP6_COPY.slug;

export interface SlugEditorProps {
  /** Valor actual del slug */
  value: string;
  onChange: (next: string) => void;

  /** Nombre del recurso (paso 1), para "Regenerar desde el nombre" */
  resourceName: string;

  /**
   * Si el recurso está publicado, el editor queda en read-only y muestra
   * un aviso (decisión 3-B).
   */
  isPublished: boolean;

  /**
   * Función async que consulta al backend si existe otro recurso con ese
   * slug. Devuelve true si es duplicado. El propio editor gestiona
   * debounce (400ms) para no saturar.
   */
  checkDuplicate: (slug: string) => Promise<boolean>;

  /** ID del recurso actual, para excluirlo de la comprobación de duplicado */
  currentResourceId?: string | null;
}

type Status = 'idle' | 'checking' | 'ok' | 'invalid' | 'duplicate' | 'too-long';

export default function SlugEditor({
  value,
  onChange,
  resourceName,
  isPublished,
  checkDuplicate,
}: SlugEditorProps) {
  const [status, setStatus] = useState<Status>('idle');

  // Debounced duplicate check
  useEffect(() => {
    const trimmed = value.trim();

    if (!trimmed) {
      setStatus('idle');
      return;
    }
    if (trimmed.length > SEO_LIMITS.slug.hardMax) {
      setStatus('too-long');
      return;
    }
    if (!isValidSlug(trimmed)) {
      setStatus('invalid');
      return;
    }

    setStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const dup = await checkDuplicate(trimmed);
        setStatus(dup ? 'duplicate' : 'ok');
      } catch {
        // Si falla la comprobación, asumimos OK para no bloquear al usuario
        setStatus('ok');
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [value, checkDuplicate]);

  const handleRegenerate = useCallback(() => {
    if (resourceName.trim()) {
      onChange(slugify(resourceName));
    }
  }, [resourceName, onChange]);

  return (
    <section className="slug-editor">
      <header>
        <h4>{COPY.sectionTitle}</h4>
        <p className="muted">{COPY.sectionDesc}</p>
      </header>

      {isPublished ? (
        <div className="slug-locked-notice" role="status">
          🔒 {COPY.statusLocked}
        </div>
      ) : null}

      <div className="slug-input-row">
        <span className="slug-url-prefix muted">{COPY.urlPreviewPrefix}</span>
        <input
          type="text"
          className={`slug-input slug-input-${status}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={isPublished}
          maxLength={SEO_LIMITS.slug.hardMax + 20}
          placeholder="mi-recurso"
          aria-label={COPY.sectionTitle}
          aria-invalid={status === 'invalid' || status === 'duplicate' || status === 'too-long'}
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={handleRegenerate}
          disabled={isPublished || !resourceName.trim()}
        >
          {COPY.regenerateButton}
        </button>
      </div>

      {/* Status line */}
      {!isPublished && (
        <div className={`slug-status slug-status-${status}`} role="status" aria-live="polite">
          {status === 'invalid' && <>⚠ {COPY.statusInvalid}</>}
          {status === 'duplicate' && <>✗ {COPY.statusDuplicate}</>}
          {status === 'too-long' && (
            <>⚠ {COPY.statusTooLong.replace('{max}', String(SEO_LIMITS.slug.hardMax))}</>
          )}
          {status === 'ok' && <>✓ {COPY.statusOk}</>}
          {status === 'checking' && <>Comprobando disponibilidad…</>}
        </div>
      )}
    </section>
  );
}
