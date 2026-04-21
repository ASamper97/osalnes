/**
 * OgImageBlock — imagen Open Graph (decisión 5-A)
 *
 * Por defecto, se usa la imagen principal del paso 5. Si el usuario quiere
 * usar una distinta para compartir en redes (p.ej. una imagen más
 * horizontal optimizada para la tarjeta social), puede subir una override.
 *
 * Este componente muestra:
 *   - Preview de la imagen activa (principal del paso 5 o override)
 *   - Botón "Subir otra imagen" (si no hay override)
 *   - Botón "Volver a usar la principal" (si hay override)
 */

import { useRef, useState } from 'react';
import { STEP6_COPY } from '../pages/step6-seo.copy';

const COPY = STEP6_COPY.ogImage;

export interface OgImageBlockProps {
  /** URL pública de la imagen principal del paso 5; null si no hay */
  primaryImageUrl: string | null;

  /** Path en Storage de la override actual; null = usando principal */
  overridePath: string | null;

  /** URL pública de la override (la resuelve el padre desde el path) */
  overrideUrl: string | null;

  /**
   * Sube un fichero override y devuelve el path persistido en Storage.
   * El padre se encarga de:
   *   - Subir a bucket resource-images con un path específico
   *   - Actualizar la tabla resources.og_image_override_path
   */
  onUploadOverride: (file: File) => Promise<string>;

  /** Quita el override; volver a usar la principal del paso 5 */
  onRemoveOverride: () => Promise<void>;
}

export default function OgImageBlock({
  primaryImageUrl,
  overridePath,
  overrideUrl,
  onUploadOverride,
  onRemoveOverride,
}: OgImageBlockProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasOverride = overridePath != null && overridePath !== '';
  const imageUrl = hasOverride ? overrideUrl : primaryImageUrl;

  const handlePick = () => fileInputRef.current?.click();

  const handleFile = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      await onUploadOverride(file);
    } catch {
      setError('No se ha podido subir la imagen. Inténtalo de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveOverride = async () => {
    if (!window.confirm(COPY.removeOverrideConfirm)) return;
    setError(null);
    try {
      await onRemoveOverride();
    } catch {
      setError('No se ha podido quitar la imagen.');
    }
  };

  return (
    <section className="og-image-block">
      <header>
        <h4>{COPY.sectionTitle}</h4>
        <p className="muted">{COPY.sectionDesc}</p>
      </header>

      <div className="og-image-container">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="og-image-preview" />
        ) : (
          <div className="og-image-placeholder" aria-hidden>
            🖼️
          </div>
        )}

        <div className="og-image-meta">
          <div className="og-image-status">
            {hasOverride
              ? COPY.usingOverrideLabel
              : primaryImageUrl
                ? COPY.usingPrimaryLabel
                : COPY.usingPrimaryEmpty}
          </div>

          <div className="og-image-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handlePick}
              disabled={uploading}
            >
              {uploading ? 'Subiendo…' : COPY.uploadButton}
            </button>
            {hasOverride && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleRemoveOverride}
                disabled={uploading}
              >
                {COPY.removeOverrideButton}
              </button>
            )}
          </div>

          <small className="muted og-image-recommendation">{COPY.recommendedSize}</small>
        </div>
      </div>

      {error && (
        <p role="alert" className="og-image-error">
          ⚠️ {error}
        </p>
      )}
    </section>
  );
}
