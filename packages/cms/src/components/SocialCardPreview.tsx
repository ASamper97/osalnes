/**
 * SocialCardPreview — cómo se ve el enlace al compartir en redes
 *
 * Imita la tarjeta grande estilo "summary_large_image" de Twitter /
 * Facebook / WhatsApp cuando alguien comparte el enlace. Preview en vivo.
 *
 * Recibe:
 *   - title, description (del SEO del idioma activo)
 *   - imageUrl: URL pública que se vería en la tarjeta
 *     · null → placeholder gris "Sin imagen"
 *
 * El componente no hace ninguna llamada; es pura maqueta HTML/CSS.
 */

import { STEP6_COPY } from '../pages/step6-seo.copy';

const COPY = STEP6_COPY.socialPreview;

export interface SocialCardPreviewProps {
  title: string;
  description: string;
  imageUrl: string | null;
  resourceName: string;
}

export default function SocialCardPreview({
  title,
  description,
  imageUrl,
  resourceName,
}: SocialCardPreviewProps) {
  const effectiveTitle = title.trim() || resourceName.trim();

  return (
    <section className="social-preview" aria-label={COPY.title}>
      <header className="social-preview-head">
        <h4>{COPY.title}</h4>
        <p className="muted">{COPY.subtitle}</p>
      </header>

      <div className="social-card">
        <div className="social-card-image">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              className="social-card-img"
              loading="lazy"
            />
          ) : (
            <div className="social-card-placeholder" aria-hidden>
              🖼️ <span>{COPY.fallbackImage}</span>
            </div>
          )}
        </div>
        <div className="social-card-body">
          <div className="social-card-domain">{COPY.domain}</div>
          <div className="social-card-title">{effectiveTitle}</div>
          {description.trim() && (
            <div className="social-card-description">{description}</div>
          )}
        </div>
      </div>
    </section>
  );
}
