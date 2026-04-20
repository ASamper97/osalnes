/**
 * SocialLinksEditor — editor de enlaces a redes sociales
 *
 * Guarda como array `SocialLink[]` que se mapea al campo `sameAs` de
 * UNE 178503 (array de URLs). Limitamos a un set de plataformas conocidas
 * para que el visitante vea un icono reconocible en la web pública.
 */

import { STEP3_COPY } from '../pages/step3-location.copy';

export type SocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'youtube'
  | 'twitter'
  | 'linkedin'
  | 'whatsapp';

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
}

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  twitter: 'X (Twitter)',
  linkedin: 'LinkedIn',
  whatsapp: 'WhatsApp',
};

const PLATFORM_ICONS: Record<SocialPlatform, string> = {
  instagram: '📷',
  facebook: '👥',
  tiktok: '🎵',
  youtube: '▶️',
  twitter: '✖️',
  linkedin: '💼',
  whatsapp: '💬',
};

export interface SocialLinksEditorProps {
  links: SocialLink[];
  onChange: (next: SocialLink[]) => void;
}

export default function SocialLinksEditor({ links, onChange }: SocialLinksEditorProps) {
  const COPY = STEP3_COPY.contact;

  const availablePlatforms = (Object.keys(PLATFORM_LABELS) as SocialPlatform[]).filter(
    (p) => !links.some((l) => l.platform === p),
  );

  const addLink = (platform: SocialPlatform) => {
    onChange([...links, { platform, url: '' }]);
  };

  const updateLink = (idx: number, url: string) => {
    onChange(links.map((l, i) => (i === idx ? { ...l, url } : l)));
  };

  const removeLink = (idx: number) => {
    onChange(links.filter((_, i) => i !== idx));
  };

  return (
    <div className="social-links-editor">
      {links.map((link, idx) => (
        <div key={`${link.platform}-${idx}`} className="social-link-row">
          <span className="social-link-icon" aria-hidden>
            {PLATFORM_ICONS[link.platform]}
          </span>
          <span className="social-link-platform">{PLATFORM_LABELS[link.platform]}</span>
          <input
            type="url"
            className="social-link-url"
            value={link.url}
            onChange={(e) => updateLink(idx, e.target.value)}
            placeholder={COPY.socialPlaceholders[link.platform]}
            aria-label={`URL de ${PLATFORM_LABELS[link.platform]}`}
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => removeLink(idx)}
          >
            {COPY.socialRemoveLabel}
          </button>
        </div>
      ))}

      {availablePlatforms.length > 0 && (
        <details className="social-link-add">
          <summary>+ {COPY.socialAddLabel}</summary>
          <div className="social-link-add-menu">
            {availablePlatforms.map((p) => (
              <button
                key={p}
                type="button"
                className="social-link-add-option"
                onClick={(e) => {
                  addLink(p);
                  // Cerrar el <details> después de añadir
                  const details = (e.currentTarget.closest('details') as HTMLDetailsElement | null);
                  if (details) details.open = false;
                }}
              >
                <span aria-hidden>{PLATFORM_ICONS[p]}</span>
                <span>{PLATFORM_LABELS[p]}</span>
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
