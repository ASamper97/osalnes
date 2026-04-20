/**
 * Cliente de geocoding contra Nominatim (OpenStreetMap)
 *
 * Nominatim es gratis, sin API key, pero tiene una política de uso justa:
 *   - Máximo 1 request/segundo por IP
 *   - User-Agent obligatorio con email de contacto
 *   - No pensado para aplicaciones de alto volumen
 *
 * Para el caso de O Salnés (<5 recursos/mes, creación manual), está
 * sobradamente en los límites. Si el volumen crece, migrar a un endpoint
 * propio cacheado o a Mapbox Geocoding (50k/mes gratis).
 *
 * Docs: https://nominatim.org/release-docs/latest/api/Overview/
 */

import { O_SALNES_BBOX } from '../../../shared/src/data/osalnes-geo';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

/** User-Agent obligatorio según ToS de Nominatim */
const USER_AGENT = 'osalnes-cms/1.0 (contacto: info@osalnes.gal)';

export interface GeocodeResult {
  /** Nombre completo devuelto por Nominatim */
  displayName: string;
  lat: number;
  lng: number;
  /** Componentes separados que podemos mapear a UNE 178503 */
  address: {
    streetAddress?: string;      // calle + número
    postalCode?: string;
    locality?: string;           // municipio/ciudad
    parroquia?: string;          // barrio / parroquia (si Nominatim la devuelve)
    province?: string;           // provincia
    region?: string;             // comunidad autónoma
    country?: string;            // país
    countryCode?: string;        // ISO-2
  };
  /** Tipo de resultado (house, road, locality, …) */
  type?: string;
}

/**
 * Búsqueda "forward": texto → resultados geográficos.
 *
 * Sesgada a O Salnés mediante `viewbox` (aumenta el ranking de resultados
 * dentro de la comarca, pero no los limita — si el usuario escribe "Madrid"
 * lo encontrará igualmente).
 */
export async function geocodeSearch(query: string): Promise<GeocodeResult[]> {
  if (!query.trim()) return [];

  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '8',
    'accept-language': 'es,gl,en',
    // viewbox: (west,south,east,north) en Nominatim es (left,top,right,bottom)
    // pero con bounded=0 solo sesga, no filtra.
    viewbox: `${O_SALNES_BBOX.west},${O_SALNES_BBOX.north},${O_SALNES_BBOX.east},${O_SALNES_BBOX.south}`,
    bounded: '0',
    countrycodes: 'es',
  });

  const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
  });

  if (!res.ok) throw new Error(`Nominatim search failed: ${res.status}`);

  const data: NominatimSearchResult[] = await res.json();

  return data.map(toGeocodeResult);
}

/**
 * Geocoding "reverso": lat/lng → dirección estructurada.
 *
 * Se dispara automáticamente cuando el usuario suelta el pin en el mapa.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'jsonv2',
    addressdetails: '1',
    'accept-language': 'es,gl,en',
    zoom: '18', // máximo detalle para capturar calle+número
  });

  const res = await fetch(`${NOMINATIM_BASE}/reverse?${params}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    },
  });

  if (!res.ok) throw new Error(`Nominatim reverse failed: ${res.status}`);

  const data: NominatimSearchResult | { error: string } = await res.json();

  if ('error' in data) return null;
  return toGeocodeResult(data);
}

/**
 * Extrae lat/lng de un URL de Google Maps o OpenStreetMap.
 *
 * Soporta los formatos más habituales:
 *   https://www.google.com/maps/@42.5123,-8.8124,15z
 *   https://www.google.com/maps/place/Name/@42.5,-8.8,15z/data=!3m1!...
 *   https://maps.app.goo.gl/xxxx  ← NO soportado (requiere resolver redirect)
 *   https://www.openstreetmap.org/?mlat=42.5&mlon=-8.8
 *   https://www.openstreetmap.org/#map=15/42.5/-8.8
 *
 * Devuelve null si no hay match. El enlace acortado de Google (maps.app.goo.gl)
 * requiere un HEAD request para resolver el redirect, se deja para una
 * iteración futura porque desde el browser CORS lo bloquea.
 */
export function parseMapUrl(url: string): { lat: number; lng: number } | null {
  try {
    const u = new URL(url.trim());

    // Google Maps · formato @lat,lng,zoom
    const atMatch = u.pathname.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (atMatch) {
      const lat = Number(atMatch[1]);
      const lng = Number(atMatch[2]);
      if (isValidCoord(lat, lng)) return { lat, lng };
    }

    // OpenStreetMap · query params mlat/mlon
    const mlat = u.searchParams.get('mlat');
    const mlon = u.searchParams.get('mlon');
    if (mlat && mlon) {
      const lat = Number(mlat);
      const lng = Number(mlon);
      if (isValidCoord(lat, lng)) return { lat, lng };
    }

    // OpenStreetMap · hash #map=zoom/lat/lng
    const hashMatch = u.hash.match(/#?map=\d+\/(-?\d+\.?\d*)\/(-?\d+\.?\d*)/);
    if (hashMatch) {
      const lat = Number(hashMatch[1]);
      const lng = Number(hashMatch[2]);
      if (isValidCoord(lat, lng)) return { lat, lng };
    }

    // Google Maps · query param q=lat,lng
    const q = u.searchParams.get('q') || u.searchParams.get('ll');
    if (q) {
      const parts = q.split(',').map((s) => Number(s.trim()));
      if (parts.length === 2 && isValidCoord(parts[0], parts[1])) {
        return { lat: parts[0], lng: parts[1] };
      }
    }

    return null;
  } catch {
    return null;
  }
}

function isValidCoord(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

// ─── Mapeo Nominatim → GeocodeResult ───────────────────────────────────

interface NominatimSearchResult {
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  address?: {
    house_number?: string;
    road?: string;
    street?: string;
    pedestrian?: string;
    neighbourhood?: string;
    suburb?: string;
    village?: string;
    town?: string;
    city?: string;
    municipality?: string;
    county?: string;
    province?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
}

function toGeocodeResult(raw: NominatimSearchResult): GeocodeResult {
  const a = raw.address ?? {};
  const road = a.road || a.street || a.pedestrian || '';
  const streetAddress = road
    ? a.house_number
      ? `${road}, ${a.house_number}`
      : road
    : undefined;

  return {
    displayName: raw.display_name,
    lat: Number(raw.lat),
    lng: Number(raw.lon),
    type: raw.type,
    address: {
      streetAddress,
      postalCode: a.postcode,
      locality: a.town || a.city || a.village || a.municipality,
      parroquia: a.suburb || a.neighbourhood,
      province: a.county || a.province,
      region: a.state,
      country: a.country,
      countryCode: a.country_code?.toUpperCase(),
    },
  };
}
