/**
 * Modelo de datos de multimedia (Paso 5)
 *
 * Alineado con UNE 178503 §10.1.13 `hasMultimedia` y con los requisitos
 * del pliego (sección 5.1.5 "Gestión multimedia y documentos").
 *
 * El modelo distingue tres tipos de media, que se guardan en tablas
 * distintas en BD pero se muestran juntos en el paso 5:
 *
 *   - IMAGE      → `resource_images`      (foto/gallery)
 *   - VIDEO      → `resource_videos`      (URL externa: YouTube/Vimeo)
 *   - DOCUMENT   → `resource_documents`   (PDF u otro fichero descargable)
 */

// ─── IMAGE ─────────────────────────────────────────────────────────────

export interface ImageItem {
  id: string;
  /** Path en Supabase Storage, p.ej. "recursos/{resourceId}/{uuid}.jpg" */
  storagePath: string;
  /** URL pública derivada del storagePath (se computa en el backend) */
  publicUrl?: string;
  /** MIME. Soportados: image/jpeg, image/png, image/webp, image/avif */
  mimeType: string;
  /** Peso en bytes */
  sizeBytes: number;
  /** Dimensiones (opcional si no hemos hecho análisis) */
  width?: number;
  height?: number;
  /**
   * Alt text descriptivo (WCAG 2.1 AA · criterio 1.1.1).
   * Si es `null` significa que aún no se ha escrito ni generado.
   */
  altText: string | null;
  /**
   * Fuente del alt text:
   *   - `null`     → no se ha puesto alt todavía
   *   - 'manual'   → lo escribió el usuario
   *   - 'ai'       → lo generó la IA (pendiente de revisión manual)
   *   - 'ai-edited'→ la IA lo generó y el usuario lo editó después
   */
  altSource: null | 'manual' | 'ai' | 'ai-edited';
  /** Si es `true`, esta es la imagen principal del recurso (schema.org `image`) */
  isPrimary: boolean;
  /** Orden dentro de la galería (menor = antes) */
  sortOrder: number;
  createdAt: string;
}

// ─── VIDEO (URL externa) ────────────────────────────────────────────────

export type VideoProvider = 'youtube' | 'vimeo' | 'other';

export interface VideoItem {
  id: string;
  /** URL completa del vídeo externo */
  url: string;
  /** Proveedor detectado */
  provider: VideoProvider;
  /** ID del vídeo dentro del proveedor (p.ej. "dQw4w9WgXcQ" en YouTube) */
  externalId: string | null;
  /** Título extraído del proveedor si se pudo obtener */
  title: string | null;
  /** URL de miniatura (derivada del proveedor; YT la tiene pública sin API) */
  thumbnailUrl: string | null;
  /** Orden en la galería */
  sortOrder: number;
  createdAt: string;
}

// ─── DOCUMENT ──────────────────────────────────────────────────────────

/**
 * Tipo de documento según uso editorial. Alineado con los usos más
 * frecuentes en turismo municipal. Si en el futuro se necesita más,
 * añadir aquí y extender el enum en BD.
 */
export type DocumentKind =
  | 'guia'            // Guía de visita, libreto interpretativo
  | 'menu'            // Carta de restaurante, menú de bodega
  | 'folleto'         // Folleto turístico, díptico
  | 'mapa'            // Mapa de rutas, plano del recurso
  | 'normativa'       // Normas de visita, condiciones de uso
  | 'programa'        // Programa de fiesta, festival, concierto
  | 'otro';

/** Idioma declarado del documento (ISO 639-1) */
export type DocumentLang = 'es' | 'gl' | 'en' | 'fr' | 'pt' | 'de' | 'it';

export interface DocumentItem {
  id: string;
  /** Path en Supabase Storage */
  storagePath: string;
  publicUrl?: string;
  /** MIME. Soportados: application/pdf (principal), también docx/xlsx en raros */
  mimeType: string;
  sizeBytes: number;
  /** Nombre original del fichero tal como lo subió el usuario */
  originalFilename: string;
  /** Título editorial (lo que ve el visitante en la web); puede diferir del filename */
  title: string;
  kind: DocumentKind;
  lang: DocumentLang;
  /** Orden en la lista de descargas */
  sortOrder: number;
  createdAt: string;
}

// ─── Helpers de límites y validación ───────────────────────────────────

export const MEDIA_LIMITS = {
  image: {
    maxBytes: 10 * 1024 * 1024,         // 10 MB por imagen
    acceptedMimes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const,
    acceptedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.avif'] as const,
    maxPerResource: 30,
  },
  document: {
    maxBytes: 20 * 1024 * 1024,         // 20 MB por documento
    acceptedMimes: ['application/pdf'] as const,
    acceptedExtensions: ['.pdf'] as const,
    maxPerResource: 15,
  },
  video: {
    maxPerResource: 5,
  },
} as const;

/** Lista de etiquetas humanas para los tipos de documento */
export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  guia:      'Guía de visita',
  menu:      'Carta o menú',
  folleto:   'Folleto turístico',
  mapa:      'Mapa o plano',
  normativa: 'Normas o condiciones',
  programa:  'Programa de actividad',
  otro:      'Otro documento',
};

/** Idiomas soportados para documentos, con etiqueta legible */
export const DOCUMENT_LANG_LABELS: Record<DocumentLang, string> = {
  es: 'Castellano',
  gl: 'Gallego',
  en: 'Inglés',
  fr: 'Francés',
  pt: 'Portugués',
  de: 'Alemán',
  it: 'Italiano',
};

// ─── Detector de proveedor de vídeo ─────────────────────────────────────

/**
 * Extrae proveedor + ID externo de una URL de vídeo. Devuelve `null` si la
 * URL no es de un proveedor soportado.
 *
 * Patrones reconocidos:
 *   - YouTube: https://www.youtube.com/watch?v=ID
 *              https://youtu.be/ID
 *              https://www.youtube.com/embed/ID
 *              https://www.youtube.com/shorts/ID
 *   - Vimeo:   https://vimeo.com/ID
 *              https://player.vimeo.com/video/ID
 */
export function parseVideoUrl(
  url: string,
): { provider: VideoProvider; externalId: string } | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  // YouTube
  const ytPatterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/,
    /(?:https?:\/\/)?youtu\.be\/([A-Za-z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  ];
  for (const pattern of ytPatterns) {
    const m = trimmed.match(pattern);
    if (m) return { provider: 'youtube', externalId: m[1] };
  }

  // Vimeo
  const vimeoPatterns = [
    /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/,
    /(?:https?:\/\/)?player\.vimeo\.com\/video\/(\d+)/,
  ];
  for (const pattern of vimeoPatterns) {
    const m = trimmed.match(pattern);
    if (m) return { provider: 'vimeo', externalId: m[1] };
  }

  return null;
}

/** Devuelve la URL de miniatura pública sin necesidad de llamar a API */
export function getVideoThumbnailUrl(
  provider: VideoProvider,
  externalId: string | null,
): string | null {
  if (!externalId) return null;
  if (provider === 'youtube') {
    // YouTube expone miniaturas en hqdefault sin autenticación
    return `https://i.ytimg.com/vi/${externalId}/hqdefault.jpg`;
  }
  // Vimeo requiere oEmbed; lo dejamos para el Edge Function
  return null;
}
