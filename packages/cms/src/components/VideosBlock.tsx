/**
 * VideosBlock — vídeos del recurso por URL externa (Paso 5)
 *
 * Solo URL externa (decisión 3-A del usuario). El CMS detecta el proveedor
 * (YouTube / Vimeo), extrae el ID externo y la miniatura. En un mundo
 * ideal también extraeríamos el título, pero eso requiere una llamada al
 * oEmbed del proveedor que pospónemos a un Edge Function en una iteración
 * futura.
 *
 * Por ahora, el título se puede editar a mano.
 */

import { useState } from 'react';
import {
  parseVideoUrl,
  getVideoThumbnailUrl,
  MEDIA_LIMITS,
  type VideoItem,
} from '@osalnes/shared/data/media';
import { STEP5_COPY } from '../pages/step5-multimedia.copy';

const COPY = STEP5_COPY.videos;

export interface VideosBlockProps {
  videos: VideoItem[];
  /**
   * Añade un vídeo al recurso. Recibe URL + provider + externalId detectados
   * y devuelve el VideoItem persistido.
   */
  onAdd: (input: {
    url: string;
    provider: VideoItem['provider'];
    externalId: string | null;
    thumbnailUrl: string | null;
  }) => Promise<VideoItem>;

  onRemove: (videoId: string) => Promise<void>;
  onUpdateTitle: (videoId: string, title: string) => Promise<void>;
}

export default function VideosBlock({
  videos,
  onAdd,
  onRemove,
  onUpdateTitle,
}: VideosBlockProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAddMore = videos.length < MEDIA_LIMITS.video.maxPerResource;

  const handleAdd = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setError(null);

    if (!canAddMore) {
      setError(COPY.addErrorTooMany);
      return;
    }

    const parsed = parseVideoUrl(trimmed);
    if (!parsed) {
      setError(COPY.addErrorInvalid);
      return;
    }

    // Duplicado: mismo externalId
    if (videos.some((v) => v.externalId === parsed.externalId && v.provider === parsed.provider)) {
      setError(COPY.addErrorDuplicate);
      return;
    }

    setLoading(true);
    try {
      const thumbnailUrl = getVideoThumbnailUrl(parsed.provider, parsed.externalId);
      await onAdd({
        url: trimmed,
        provider: parsed.provider,
        externalId: parsed.externalId,
        thumbnailUrl,
      });
      setInput('');
    } catch {
      setError(COPY.addErrorGeneric);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="videos-block">
      <header>
        <h3>{COPY.sectionTitle}</h3>
        <p className="muted">{COPY.sectionDesc}</p>
      </header>

      {/* Añadir vídeo */}
      <div className="videos-add">
        <input
          type="url"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={COPY.addPlaceholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleAdd();
            }
          }}
          aria-label={COPY.sectionTitle}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleAdd}
          disabled={loading || !input.trim() || !canAddMore}
        >
          {loading ? COPY.addButtonLoading : COPY.addButton}
        </button>
      </div>

      {error && (
        <p role="alert" className="videos-error">
          ⚠️ {error}
        </p>
      )}

      {/* Grid */}
      {videos.length > 0 && (
        <ul className="videos-list" role="list">
          {videos.map((v) => (
            <VideoCard
              key={v.id}
              video={v}
              onRemove={onRemove}
              onUpdateTitle={onUpdateTitle}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function VideoCard({
  video,
  onRemove,
  onUpdateTitle,
}: {
  video: VideoItem;
  onRemove: (id: string) => Promise<void>;
  onUpdateTitle: (id: string, title: string) => Promise<void>;
}) {
  const [titleLocal, setTitleLocal] = useState(video.title ?? '');

  const commitTitle = async () => {
    const trimmed = titleLocal.trim();
    if (trimmed === (video.title ?? '')) return;
    await onUpdateTitle(video.id, trimmed);
  };

  const handleRemove = () => {
    if (window.confirm(COPY.removeConfirm)) void onRemove(video.id);
  };

  const providerLabel = COPY.providerLabels[video.provider];

  return (
    <li className="video-card">
      <div className="video-thumb-wrap">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={`Miniatura del vídeo ${video.title ?? ''} (${providerLabel})`}
            className="video-thumb"
            loading="lazy"
          />
        ) : (
          <div className="video-thumb video-thumb-placeholder" aria-hidden>
            ▶️
          </div>
        )}
        <span className="video-play-badge" aria-hidden>▶</span>
      </div>
      <div className="video-meta">
        <input
          type="text"
          className="video-title-input"
          value={titleLocal}
          onChange={(e) => setTitleLocal(e.target.value)}
          onBlur={commitTitle}
          placeholder={COPY.titleFallback}
          aria-label="Título del vídeo"
        />
        <div className="video-meta-row">
          <span className="video-provider-badge">{providerLabel}</span>
          <a
            href={video.url}
            target="_blank"
            rel="noreferrer"
            className="video-url-link"
          >
            Abrir en {providerLabel} ↗
          </a>
        </div>
      </div>
      <button
        type="button"
        className="video-remove"
        onClick={handleRemove}
        aria-label={COPY.removeLabel}
        title={COPY.removeLabel}
      >
        ×
      </button>
    </li>
  );
}
