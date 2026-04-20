/**
 * Datos geográficos estáticos de O Salnés
 *
 * Centros aproximados de los 9 concellos de la Mancomunidade y bounding
 * box global. Sirven para:
 *   - Centrar el mapa al entrar al paso 3 si ya hay municipio del paso 1
 *   - Validar que un pin está dentro de O Salnés (warning no bloqueante)
 *   - Punto de partida por defecto si no hay municipio seleccionado aún
 *
 * Las coordenadas no son oficiales — son el centroide visual de cada
 * núcleo principal. Ajustables si se requiere precisión.
 */

export interface MunicipioGeo {
  /** Slug estable usado en la BD (coincide con `municipios.slug`) */
  slug: string;
  /** Nombre visible */
  name: string;
  lat: number;
  lng: number;
  /** Zoom recomendado al centrar */
  zoom: number;
}

export const O_SALNES_MUNICIPIOS: MunicipioGeo[] = [
  { slug: 'sanxenxo',              name: 'Sanxenxo',                 lat: 42.4025, lng: -8.8082, zoom: 13 },
  { slug: 'o-grove',               name: 'O Grove',                  lat: 42.4979, lng: -8.8657, zoom: 13 },
  { slug: 'vilagarcia-de-arousa',  name: 'Vilagarcía de Arousa',     lat: 42.5935, lng: -8.7676, zoom: 13 },
  { slug: 'cambados',              name: 'Cambados',                 lat: 42.5133, lng: -8.8119, zoom: 13 },
  { slug: 'vilanova-de-arousa',    name: 'Vilanova de Arousa',       lat: 42.5652, lng: -8.8287, zoom: 13 },
  { slug: 'meis',                  name: 'Meis',                     lat: 42.5417, lng: -8.7554, zoom: 13 },
  { slug: 'a-illa-de-arousa',      name: 'A Illa de Arousa',         lat: 42.5624, lng: -8.8647, zoom: 14 },
  { slug: 'meano',                 name: 'Meaño',                    lat: 42.4663, lng: -8.8127, zoom: 13 },
  { slug: 'ribadumia',             name: 'Ribadumia',                lat: 42.5249, lng: -8.7763, zoom: 13 },
];

/** Bounding box generoso de O Salnés (aprox. 5–10% de margen) */
export const O_SALNES_BBOX = {
  south: 42.35,
  north: 42.65,
  west: -8.95,
  east: -8.70,
} as const;

/** Centro geográfico aproximado de O Salnés */
export const O_SALNES_CENTER = {
  lat: 42.49,
  lng: -8.82,
  zoom: 11,
} as const;

/**
 * Busca el Geo de un municipio por su slug. Devuelve null si no existe.
 */
export function findMunicipio(slug: string | null | undefined): MunicipioGeo | null {
  if (!slug) return null;
  return O_SALNES_MUNICIPIOS.find((m) => m.slug === slug) ?? null;
}

/**
 * Busca el Geo de un municipio por su nombre (case-insensitive, sin acentos).
 */
export function findMunicipioByName(name: string | null | undefined): MunicipioGeo | null {
  if (!name) return null;
  const normalize = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const q = normalize(name);
  return O_SALNES_MUNICIPIOS.find((m) => normalize(m.name) === q) ?? null;
}

/**
 * ¿Está la coordenada dentro del bounding box de O Salnés?
 * Usado para el warning no bloqueante "parece estar fuera de O Salnés".
 */
export function isInOSalnes(lat: number, lng: number): boolean {
  return (
    lat >= O_SALNES_BBOX.south &&
    lat <= O_SALNES_BBOX.north &&
    lng >= O_SALNES_BBOX.west &&
    lng <= O_SALNES_BBOX.east
  );
}
