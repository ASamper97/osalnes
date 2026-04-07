import { useEffect } from 'react';

/**
 * LivePreviewPanel — Panel deslizable que muestra como queda el recurso
 * en la web publica, en tiempo real mientras se edita.
 *
 * Imita el estilo de packages/web/src/app/[lang]/recurso/[slug]/page.tsx
 * para dar al editor una representacion fiel de como se vera el contenido.
 */

export interface LivePreviewData {
  name: string;
  type: string;
  typeGroup?: string;
  description: string;
  municipio?: string;
  address?: string;
  postalCode?: string;
  telephone?: string;
  email?: string;
  url?: string;
  openingHours?: string;
  ratingValue?: string;
  cuisine?: string;
  isAccessibleForFree?: boolean;
  latitude?: string;
  longitude?: string;
  /** Optional preview image URL */
  imageUrl?: string;
  /** Selected language to preview */
  lang?: 'es' | 'gl' | 'en' | 'fr' | 'pt';
}

interface LivePreviewPanelProps {
  open: boolean;
  onClose: () => void;
  data: LivePreviewData;
}

export function LivePreviewPanel({ open, onClose, data }: LivePreviewPanelProps) {
  // ESC closes the panel
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  if (!open) return null;

  const hasContent = data.name.trim().length > 0 || data.description.trim().length > 0;
  const hasHtml = /<[a-z][\s\S]*>/i.test(data.description);

  return (
    <>
      {/* Backdrop */}
      <div className="preview-backdrop" onClick={onClose} role="presentation" />

      {/* Drawer */}
      <aside className="preview-panel" role="dialog" aria-label="Vista previa del recurso">
        <header className="preview-panel__header">
          <div>
            <span className="preview-panel__label">👁 Vista previa</span>
            <h2 className="preview-panel__title">Asi se vera en la web publica</h2>
          </div>
          <button type="button" className="preview-panel__close" onClick={onClose} aria-label="Cerrar vista previa">
            ✕
          </button>
        </header>

        <div className="preview-panel__body">
          {!hasContent ? (
            <div className="preview-panel__empty">
              <div className="preview-panel__empty-icon">📝</div>
              <p>Empieza a rellenar el formulario y veras como queda en la web</p>
            </div>
          ) : (
            <PreviewCard data={data} hasHtml={hasHtml} />
          )}
        </div>

        <footer className="preview-panel__footer">
          <span>Vista previa en tiempo real — actualiza al editar</span>
        </footer>
      </aside>
    </>
  );
}

function PreviewCard({ data, hasHtml }: { data: LivePreviewData; hasHtml: boolean }) {
  return (
    <article className="preview-card">
      {/* Image */}
      <div className="preview-card__image">
        {data.imageUrl ? (
          <img src={data.imageUrl} alt={data.name} />
        ) : (
          <div className="preview-card__image-placeholder">
            <span>📷</span>
            <small>Sin imagen principal</small>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="preview-card__header">
        <div className="preview-card__badges">
          {data.typeGroup && <span className={`tipo-badge tipo-badge--${data.typeGroup}`}>{data.type}</span>}
          {!data.typeGroup && data.type && <span className="tipo-badge tipo-badge--general">{data.type}</span>}
          {data.isAccessibleForFree && <span className="preview-card__badge preview-card__badge--free">Acceso gratuito</span>}
          {data.ratingValue && (
            <span className="preview-card__badge preview-card__badge--stars">{'★'.repeat(parseInt(data.ratingValue))}</span>
          )}
        </div>
        <h1 className="preview-card__title">{data.name || 'Sin nombre'}</h1>
        {data.municipio && (
          <p className="preview-card__location">📍 {data.municipio}</p>
        )}
      </div>

      {/* Description */}
      {data.description && (
        <div className="preview-card__description">
          {hasHtml ? (
            <div dangerouslySetInnerHTML={{ __html: data.description }} />
          ) : (
            data.description.split('\n').map((p, i) => <p key={i}>{p}</p>)
          )}
        </div>
      )}

      {/* Info grid */}
      <div className="preview-card__info">
        {data.address && (
          <div className="preview-card__info-item">
            <span className="preview-card__info-icon">🏠</span>
            <div>
              <strong>Direccion</strong>
              <p>{data.address}{data.postalCode && `, ${data.postalCode}`}</p>
            </div>
          </div>
        )}

        {data.telephone && (
          <div className="preview-card__info-item">
            <span className="preview-card__info-icon">📞</span>
            <div>
              <strong>Telefono</strong>
              <p>{data.telephone}</p>
            </div>
          </div>
        )}

        {data.email && (
          <div className="preview-card__info-item">
            <span className="preview-card__info-icon">✉️</span>
            <div>
              <strong>Email</strong>
              <p>{data.email}</p>
            </div>
          </div>
        )}

        {data.url && (
          <div className="preview-card__info-item">
            <span className="preview-card__info-icon">🌐</span>
            <div>
              <strong>Web</strong>
              <p>{data.url}</p>
            </div>
          </div>
        )}

        {data.openingHours && (
          <div className="preview-card__info-item">
            <span className="preview-card__info-icon">🕐</span>
            <div>
              <strong>Horario</strong>
              <p>{data.openingHours}</p>
            </div>
          </div>
        )}

        {data.cuisine && (
          <div className="preview-card__info-item">
            <span className="preview-card__info-icon">🍴</span>
            <div>
              <strong>Tipo de cocina</strong>
              <p>{data.cuisine}</p>
            </div>
          </div>
        )}

        {data.latitude && data.longitude && (
          <div className="preview-card__info-item">
            <span className="preview-card__info-icon">🗺️</span>
            <div>
              <strong>Coordenadas</strong>
              <p>{data.latitude}, {data.longitude}</p>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
