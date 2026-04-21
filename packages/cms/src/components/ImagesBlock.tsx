/**
 * ImagesBlock — galería de fotos del recurso (Paso 5)
 *
 * Responsabilidades:
 *   - Drag & drop + picker para subir fotos
 *   - Grid con miniaturas, estrella de portada, quitar
 *   - Editor de alt text por cada foto con badge de origen
 *   - Botón "Generar alt text con IA por lote" (decisión 2-C del usuario)
 *
 * NO gestiona el estado; recibe el array de imágenes y callbacks del
 * padre. El padre sabe cómo persistir en Supabase.
 *
 * Decisiones aplicadas:
 *   - 2-C: alt text con IA por lote, con contador "N fotos sin descripción"
 *   - 6-A: primera foto = principal, botón "Marcar como portada" en las demás
 */

import { useMemo, useRef, useState } from 'react';
import {
  MEDIA_LIMITS,
  type ImageItem,
} from '@osalnes/shared/data/media';
import { STEP5_COPY } from '../pages/step5-multimedia.copy';

const COPY = STEP5_COPY.images;

// ─── Props ─────────────────────────────────────────────────────────────

export interface ImagesBlockProps {
  images: ImageItem[];

  /** Sube un fichero a Supabase Storage y devuelve el ImageItem persistido */
  onUpload: (file: File) => Promise<ImageItem>;

  /** Actualiza alt_text + alt_source */
  onUpdateAlt: (imageId: string, altText: string, altSource: ImageItem['altSource']) => Promise<void>;

  /** Marca una imagen como portada (RPC mark_image_as_primary) */
  onSetPrimary: (imageId: string) => Promise<void>;

  /** Elimina una imagen de BD y Storage */
  onRemove: (imageId: string) => Promise<void>;

  /**
   * Genera alt text para una imagen con IA. Llama al Edge Function
   * `ai-writer` con action `genAltText`. Devuelve el alt generado o null
   * si la IA no ha podido.
   */
  onGenerateAlt: (imageId: string) => Promise<string | null>;
}

// ─── Componente ────────────────────────────────────────────────────────

export default function ImagesBlock({
  images,
  onUpload,
  onUpdateAlt,
  onSetPrimary,
  onRemove,
  onGenerateAlt,
}: ImagesBlockProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState<number>(0); // nº subiendo ahora
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Estado del sugeridor IA por lote
  const [aiBatchState, setAiBatchState] = useState<
    | { kind: 'idle' }
    | { kind: 'running'; current: number; total: number; failed: number }
    | { kind: 'done'; count: number; failed: number }
  >({ kind: 'idle' });

  // Fotos sin alt (para el contador del botón IA)
  const withoutAlt = useMemo(
    () => images.filter((i) => !i.altText || i.altText.trim().length === 0),
    [images],
  );

  // ─── Drag & drop + subida ──────────────────────────────────────────

  const pickFiles = () => fileInputRef.current?.click();

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    setUploadError(null);

    // Validación de límite total
    if (images.length + list.length > MEDIA_LIMITS.image.maxPerResource) {
      setUploadError(COPY.uploadErrorTooMany);
      return;
    }

    setUploading(list.length);
    try {
      for (const file of list) {
        // Validación por fichero
        if (file.size > MEDIA_LIMITS.image.maxBytes) {
          setUploadError(COPY.uploadErrorTooBig);
          continue;
        }
        if (!MEDIA_LIMITS.image.acceptedMimes.includes(file.type as typeof MEDIA_LIMITS.image.acceptedMimes[number])) {
          setUploadError(COPY.uploadErrorWrongType);
          continue;
        }
        try {
          await onUpload(file);
        } catch {
          setUploadError(COPY.uploadErrorGeneric);
        }
      }
    } finally {
      setUploading(0);
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files) void handleFiles(e.dataTransfer.files);
  };

  // ─── Sugeridor IA por lote ─────────────────────────────────────────

  const runAiBatch = async () => {
    if (withoutAlt.length === 0) return;
    setAiBatchState({
      kind: 'running',
      current: 0,
      total: withoutAlt.length,
      failed: 0,
    });
    let done = 0;
    let failed = 0;
    for (const img of withoutAlt) {
      try {
        const alt = await onGenerateAlt(img.id);
        if (alt && alt.trim().length > 0) {
          done += 1;
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
      setAiBatchState({
        kind: 'running',
        current: done + failed,
        total: withoutAlt.length,
        failed,
      });
    }
    setAiBatchState({ kind: 'done', count: done, failed });
  };

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <section className="images-block">
      <header>
        <h3>{COPY.sectionTitle}</h3>
        <p className="muted">{COPY.sectionDesc}</p>
      </header>

      {/* Dropzone */}
      <div
        className={`dropzone ${dragActive ? 'is-active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        onClick={pickFiles}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            pickFiles();
          }
        }}
        aria-label={COPY.dropzoneLabel}
      >
        <input
          ref={fileInputRef}
          type="file"
          hidden
          multiple
          accept={MEDIA_LIMITS.image.acceptedExtensions.join(',')}
          onChange={(e) => {
            if (e.target.files) void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <div className="dropzone-icon" aria-hidden>
          📷
        </div>
        <div className="dropzone-label">
          <strong>{COPY.dropzoneLabel}</strong>
          <span>{COPY.dropzoneHint}</span>
        </div>
        <div className="dropzone-accepted muted">{COPY.dropzoneAccepted}</div>
        {uploading > 0 && (
          <div className="dropzone-progress" aria-live="polite">
            {COPY.uploadProgressLabel}… ({uploading})
          </div>
        )}
      </div>

      {uploadError && (
        <p role="alert" className="images-error">
          ⚠️ {uploadError}
        </p>
      )}

      {/* Sugeridor IA por lote */}
      {images.length > 0 && (
        <AiBatchBar
          withoutAltCount={withoutAlt.length}
          total={images.length}
          state={aiBatchState}
          onRun={runAiBatch}
        />
      )}

      {/* Grid */}
      {images.length > 0 && (
        <ul className="images-grid" role="list">
          {images.map((img) => (
            <ImageCard
              key={img.id}
              image={img}
              onUpdateAlt={onUpdateAlt}
              onSetPrimary={onSetPrimary}
              onRemove={onRemove}
              onGenerateAlt={onGenerateAlt}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Barra del sugeridor IA ────────────────────────────────────────────

function AiBatchBar({
  withoutAltCount,
  total,
  state,
  onRun,
}: {
  withoutAltCount: number;
  total: number;
  state:
    | { kind: 'idle' }
    | { kind: 'running'; current: number; total: number; failed: number }
    | { kind: 'done'; count: number; failed: number };
  onRun: () => void;
}) {
  if (withoutAltCount === 0 && state.kind !== 'done') {
    return (
      <div className="ai-batch-bar is-all-done">
        <span>✓ {COPY.aiSuggestButtonAllHave}</span>
      </div>
    );
  }

  return (
    <div className="ai-batch-bar">
      <div>
        <strong>{COPY.aiSuggestTitle}</strong>
        <p className="muted">{COPY.aiSuggestDescription}</p>
      </div>
      <div className="ai-batch-actions">
        {state.kind === 'idle' && (
          <button type="button" className="btn btn-ai-primary" onClick={onRun}>
            {withoutAltCount === 1
              ? COPY.aiSuggestButtonEmptySingular
              : COPY.aiSuggestButtonEmpty.replace('{count}', String(withoutAltCount))}
          </button>
        )}
        {state.kind === 'running' && (
          <div className="ai-batch-progress" aria-live="polite">
            {COPY.aiSuggestButtonLoading
              .replace('{current}', String(state.current))
              .replace('{total}', String(state.total))}
          </div>
        )}
        {state.kind === 'done' && (
          <div className={`ai-batch-done ${state.failed > 0 ? 'has-errors' : ''}`}>
            {state.failed === 0
              ? COPY.aiSuggestCompleted.replace('{count}', String(state.count))
              : COPY.aiSuggestErrorSome
                  .replace('{done}', String(state.count))
                  .replace('{failed}', String(state.failed))}
            {withoutAltCount > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onRun}
                style={{ marginLeft: '0.5rem' }}
              >
                Reintentar ({withoutAltCount} restantes)
              </button>
            )}
          </div>
        )}
      </div>
      {total > 0 && (
        <div className="ai-batch-meta muted">
          {withoutAltCount} de {total} sin descripción
        </div>
      )}
    </div>
  );
}

// ─── Card individual ───────────────────────────────────────────────────

function ImageCard({
  image,
  onUpdateAlt,
  onSetPrimary,
  onRemove,
  onGenerateAlt,
}: {
  image: ImageItem;
  onUpdateAlt: ImagesBlockProps['onUpdateAlt'];
  onSetPrimary: ImagesBlockProps['onSetPrimary'];
  onRemove: ImagesBlockProps['onRemove'];
  onGenerateAlt: ImagesBlockProps['onGenerateAlt'];
}) {
  const [altLocal, setAltLocal] = useState(image.altText ?? '');
  const [aiLoading, setAiLoading] = useState(false);

  const commitAlt = async () => {
    const trimmed = altLocal.trim();
    if (trimmed === (image.altText ?? '')) return; // sin cambios
    const newSource: ImageItem['altSource'] =
      image.altSource === 'ai' ? 'ai-edited' : 'manual';
    await onUpdateAlt(image.id, trimmed, newSource);
  };

  const handleGenerateOne = async () => {
    setAiLoading(true);
    try {
      const alt = await onGenerateAlt(image.id);
      if (alt) setAltLocal(alt);
    } finally {
      setAiLoading(false);
    }
  };

  const handleRemove = () => {
    if (window.confirm(COPY.removeConfirm)) void onRemove(image.id);
  };

  const srcUrl = image.publicUrl ?? '';

  const altBadge = (() => {
    if (!image.altText) return { label: COPY.altTextMissingBadge, kind: 'missing' as const };
    if (image.altSource === 'ai') return { label: COPY.altTextAiBadge, kind: 'ai' as const };
    if (image.altSource === 'ai-edited') return { label: COPY.altTextAiEditedBadge, kind: 'edited' as const };
    return { label: COPY.altTextManualBadge, kind: 'manual' as const };
  })();

  return (
    <li className={`image-card ${image.isPrimary ? 'is-primary' : ''}`}>
      <div className="image-thumb-wrap">
        <img
          src={srcUrl}
          alt={image.altText ?? ''}
          className="image-thumb"
          loading="lazy"
        />

        {/* Overlay con acciones */}
        <div className="image-overlay">
          {image.isPrimary ? (
            <span className="image-badge-primary" aria-label={COPY.primaryBadge}>
              ★ {COPY.primaryBadge}
            </span>
          ) : (
            <button
              type="button"
              className="image-action"
              onClick={() => void onSetPrimary(image.id)}
              title={COPY.setPrimaryLabel}
              aria-label={COPY.setPrimaryLabel}
            >
              ☆
            </button>
          )}
          <button
            type="button"
            className="image-action image-action-remove"
            onClick={handleRemove}
            title={COPY.removeLabel}
            aria-label={COPY.removeLabel}
          >
            ×
          </button>
        </div>
      </div>

      <div className="image-meta">
        <label className="image-alt-label">
          <span>{COPY.altTextLabel}</span>
          <span className={`alt-badge alt-badge-${altBadge.kind}`}>{altBadge.label}</span>
        </label>
        <textarea
          className="image-alt-textarea"
          value={altLocal}
          onChange={(e) => setAltLocal(e.target.value)}
          onBlur={commitAlt}
          placeholder={COPY.altTextPlaceholder}
          rows={2}
        />
        <small className="image-alt-hint muted">{COPY.altTextHint}</small>

        {!image.altText && (
          <button
            type="button"
            className="btn btn-ghost btn-sm image-generate-one"
            onClick={handleGenerateOne}
            disabled={aiLoading}
          >
            {aiLoading ? '✨ Generando…' : '✨ Generar con IA'}
          </button>
        )}
      </div>
    </li>
  );
}
