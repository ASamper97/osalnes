import type { ResourceType } from '../constants/resource-types.js';
import type { TouristType } from '../constants/tourist-types.js';
import type { EditorialState } from '../constants/editorial-states.js';
import type { Locale } from '../constants/locales.js';

/** Valor localizado (multiidioma) */
export interface LocalizedValue {
  [lang: string]: string;
}

/** Ubicacion geografica */
export interface GeoLocation {
  latitude: number | null;
  longitude: number | null;
  streetAddress: string | null;
  postalCode: string | null;
}

/** Contacto */
export interface Contact {
  telephone: string[];
  email: string[];
  url: string | null;
  sameAs: string[];
}

/** Multimedia */
export interface MediaAsset {
  id: string;
  type: 'imagen' | 'video' | 'audio';
  url: string;
  alt: LocalizedValue;
  mimeType: string | null;
  sizeBytes: number | null;
  order: number;
}

/** Documento descargable */
export interface DownloadableDocument {
  id: string;
  url: string;
  name: LocalizedValue;
  mimeType: string | null;
  sizeBytes: number | null;
  order: number;
}

/** Relacion entre recursos */
export interface ResourceRelation {
  type: string;
  resourceId: string;
  resourceName?: string;
  order: number;
}

/** Municipio */
export interface Municipality {
  id: string;
  codigoIne: string;
  name: LocalizedValue;
}

/** Zona */
export interface Zone {
  id: string;
  name: LocalizedValue;
  municipioId: string;
}

/** Categoria */
export interface Category {
  id: string;
  slug: string;
  name: LocalizedValue;
  parentId: string | null;
}

/** Recurso turistico completo */
export interface TouristResource {
  id: string;
  uri: string;
  rdfType: ResourceType;
  rdfTypes: ResourceType[];
  slug: string;

  // Contenido localizado
  name: LocalizedValue;
  description: LocalizedValue;
  seoTitle: LocalizedValue;
  seoDescription: LocalizedValue;

  // Ubicacion
  location: GeoLocation;
  municipioId: string | null;
  zonaId: string | null;
  municipality?: Municipality;
  zone?: Zone;

  // Contacto
  contact: Contact;

  // Clasificacion
  touristTypes: TouristType[];
  categories: Category[];

  // Especificos
  ratingValue: number | null;
  servesCuisine: string[];
  isAccessibleForFree: boolean | null;
  publicAccess: boolean | null;
  occupancy: number | null;
  openingHours: string | null;

  // Extras UNE 178503
  extras: Record<string, unknown>;

  // Multimedia
  multimedia: MediaAsset[];
  documents: DownloadableDocument[];

  // Relaciones
  relations: ResourceRelation[];

  // Editorial
  status: EditorialState;
  visibleOnMap: boolean;
  publishedAt: string | null;

  // Auditoria
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
}

/** Input para crear/actualizar recurso */
export interface TouristResourceInput {
  rdfType: ResourceType;
  rdfTypes?: ResourceType[];
  slug?: string;
  name: LocalizedValue;
  description?: LocalizedValue;
  seoTitle?: LocalizedValue;
  seoDescription?: LocalizedValue;
  location?: Partial<GeoLocation>;
  municipioId?: string;
  zonaId?: string;
  contact?: Partial<Contact>;
  touristTypes?: TouristType[];
  categoryIds?: string[];
  ratingValue?: number;
  servesCuisine?: string[];
  isAccessibleForFree?: boolean;
  publicAccess?: boolean;
  occupancy?: number;
  openingHours?: string;
  extras?: Record<string, unknown>;
  visibleOnMap?: boolean;
}
