/**
 * Modelo de taxonomías · SCR-10 v2
 *
 * Adaptado al esquema real del proyecto O Salnés tras PREFLIGHT.
 *
 * CAMBIOS v2:
 *   · 'tipologia_une' → 'tipologia' (nombre real de tabla)
 *   · Campo `grupo` expuesto (alojamiento / restauracion / recurso / evento / transporte)
 *   · El RPC devuelve alias type_code→slug, schema_org_type→schema_code,
 *     activo→is_active · el frontend sigue usando estos nombres lógicos.
 */

export type TaxonomyCatalog =
  | 'municipio'
  | 'zona'
  | 'tipologia'          // ← antes tipologia_une
  | 'categoria'
  | 'producto_turistico';

// Grupos que la tabla `tipologia` tiene poblados en producción
export type TipologiaGrupo =
  | 'alojamiento'
  | 'restauracion'
  | 'recurso'
  | 'evento'
  | 'transporte';

export const GRUPO_LABELS: Record<TipologiaGrupo, string> = {
  alojamiento: 'Alojamiento',
  restauracion: 'Restauración',
  recurso: 'Recurso turístico',
  evento: 'Evento',
  transporte: 'Transporte',
};

export const ALL_GRUPOS: TipologiaGrupo[] = [
  'alojamiento', 'restauracion', 'recurso', 'evento', 'transporte',
];

// ─── Metadata por catálogo ─────────────────────────────────────────────

export interface CatalogMeta {
  key: TaxonomyCatalog;
  label: string;
  labelPlural: string;
  icon: string;
  hierarchical: boolean;
  rolesCanEdit: Array<'admin' | 'platform' | 'tourist_manager'>;
  readonly: boolean;
  hint: string;
  semanticUriExample: string | null;
  /** Solo para tipologia: mostrar campo grupo en el editor */
  hasGrupo: boolean;
}

export const CATALOGS: Record<TaxonomyCatalog, CatalogMeta> = {
  municipio: {
    key: 'municipio',
    label: 'Municipio',
    labelPlural: 'Municipios',
    icon: '🏘',
    hierarchical: false,
    rolesCanEdit: [],
    readonly: true,
    hint: 'Los 9 concellos oficiales de O Salnés. Puedes editar sus traducciones, pero no crear nuevos (códigos INE).',
    semanticUriExample: null,
    hasGrupo: false,
  },
  zona: {
    key: 'zona',
    label: 'Zona',
    labelPlural: 'Zonas',
    icon: '🗺',
    hierarchical: true,
    rolesCanEdit: ['admin', 'platform', 'tourist_manager'],
    readonly: false,
    hint: 'Subdivisiones operativas del destino: áreas turísticas, comarcas internas o agrupaciones temáticas.',
    semanticUriExample: null,
    hasGrupo: false,
  },
  tipologia: {
    key: 'tipologia',
    label: 'Tipología',
    labelPlural: 'Tipologías',
    icon: '🏛',
    hierarchical: false,
    rolesCanEdit: ['admin', 'platform'],
    readonly: false,
    hint: 'Clases semánticas según UNE 178503 / schema.org. El código tipo (ej. "Beach") coincide con el rdf_type del recurso.',
    semanticUriExample: 'https://schema.org/Beach',
    hasGrupo: true,
  },
  categoria: {
    key: 'categoria',
    label: 'Categoría',
    labelPlural: 'Categorías',
    icon: '🏷',
    hierarchical: true,
    rolesCanEdit: ['admin', 'platform', 'tourist_manager'],
    readonly: false,
    hint: 'Agrupaciones temáticas propias del destino. Admiten jerarquía: "Cultural > Patrimonio > Iglesias".',
    semanticUriExample: null,
    hasGrupo: false,
  },
  producto_turistico: {
    key: 'producto_turistico',
    label: 'Producto turístico',
    labelPlural: 'Productos turísticos',
    icon: '📦',
    hierarchical: true,
    rolesCanEdit: ['admin', 'platform', 'tourist_manager'],
    readonly: false,
    hint: 'Líneas comerciales o paquetes del destino. Ej: "Ruta del Albariño", "Turismo náutico".',
    semanticUriExample: null,
    hasGrupo: false,
  },
};

export const ALL_CATALOGS: TaxonomyCatalog[] = [
  'municipio', 'tipologia', 'categoria', 'zona', 'producto_turistico',
];

// ─── Término plano (listado) ──────────────────────────────────────────

export interface TaxonomyTerm {
  id: string;
  slug: string;
  parentId: string | null;
  semanticUri: string | null;
  schemaCode: string | null;
  grupo: string | null;   // solo relevante para tipologia
  sortOrder: number;
  isActive: boolean;
  name: string;
  description: string | null;
  usageCount: number;
  usagePublished: number;
  usageDraft: number;
  hasChildren: boolean;
  createdAt: string;
  updatedAt: string;
}

export function mapRpcTaxonomyTerm(r: Record<string, unknown>): TaxonomyTerm {
  return {
    id: String(r.id),
    slug: String(r.slug ?? ''),
    parentId: (r.parent_id as string) ?? null,
    semanticUri: (r.semantic_uri as string) ?? null,
    schemaCode: (r.schema_code as string) ?? null,
    grupo: (r.grupo as string) ?? null,
    sortOrder: Number(r.sort_order ?? 0),
    isActive: Boolean(r.is_active ?? true),
    name: String(r.name ?? r.slug ?? ''),
    description: (r.description as string) ?? null,
    usageCount: Number(r.usage_count ?? 0),
    usagePublished: Number(r.usage_published ?? 0),
    usageDraft: Number(r.usage_draft ?? 0),
    hasChildren: Boolean(r.has_children),
    createdAt: String(r.created_at ?? new Date().toISOString()),
    updatedAt: String(r.updated_at ?? new Date().toISOString()),
  };
}

// ─── Término detallado ────────────────────────────────────────────────

export interface TaxonomyTermDetail {
  id: string;
  slug: string;
  parentId: string | null;
  semanticUri: string | null;
  schemaCode: string | null;
  grupo: string | null;
  sortOrder: number;
  isActive: boolean;
  translations: {
    name: { es: string; gl: string; en: string };
    description: { es: string; gl: string; en: string };
  };
  usageCount: number;
}

export function mapRpcTaxonomyDetail(r: Record<string, unknown>): TaxonomyTermDetail {
  return {
    id: String(r.id),
    slug: String(r.slug ?? ''),
    parentId: (r.parent_id as string) ?? null,
    semanticUri: (r.semantic_uri as string) ?? null,
    schemaCode: (r.schema_code as string) ?? null,
    grupo: (r.grupo as string) ?? null,
    sortOrder: Number(r.sort_order ?? 0),
    isActive: Boolean(r.is_active ?? true),
    translations: {
      name: {
        es: (r.name_es as string) ?? '',
        gl: (r.name_gl as string) ?? '',
        en: (r.name_en as string) ?? '',
      },
      description: {
        es: (r.description_es as string) ?? '',
        gl: (r.description_gl as string) ?? '',
        en: (r.description_en as string) ?? '',
      },
    },
    usageCount: Number(r.usage_count ?? 0),
  };
}

export function emptyTaxonomyDetail(): TaxonomyTermDetail {
  return {
    id: '',
    slug: '',
    parentId: null,
    semanticUri: null,
    schemaCode: null,
    grupo: null,
    sortOrder: 0,
    isActive: true,
    translations: {
      name: { es: '', gl: '', en: '' },
      description: { es: '', gl: '', en: '' },
    },
    usageCount: 0,
  };
}

// ─── Resultado "ver uso" ──────────────────────────────────────────────

export interface UsageItem {
  resourceId: string;
  resourceSlug: string;
  resourceName: string;
  estadoEditorial: string;
}

export function mapRpcUsageItem(r: Record<string, unknown>): UsageItem {
  return {
    resourceId: String(r.resource_id),
    resourceSlug: String(r.resource_slug ?? ''),
    resourceName: String(r.resource_name ?? ''),
    estadoEditorial: String(r.estado_editorial ?? 'borrador'),
  };
}

// ─── Validación de URI semántica ──────────────────────────────────────

export function validateSemanticUri(uri: string | null): {
  valid: boolean;
  warning: string | null;
} {
  if (!uri || uri.trim() === '') {
    return {
      valid: true,
      warning: 'Sin URI semántica: este término no se podrá exportar al PID.',
    };
  }
  const trimmed = uri.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return { valid: false, warning: 'La URI debe empezar por http:// o https://' };
  }
  return { valid: true, warning: null };
}

// ─── Códigos schema.org comunes para autocomplete ─────────────────────

export const SCHEMA_ORG_CODES = [
  'Beach', 'Hotel', 'Restaurant', 'Museum', 'TouristAttraction',
  'Park', 'NaturePark', 'Mountain', 'LandmarksOrHistoricalBuildings',
  'Church', 'PlaceOfWorship', 'CivilBuilding', 'MilitaryBuilding',
  'Campground', 'Winery', 'BarOrPub', 'Cafe', 'CafeOrCoffeeShop',
  'ArtGallery', 'Library', 'Aquarium', 'Zoo', 'GolfCourse',
  'SportsActivityLocation', 'TouristTrip', 'TouristDestination',
  'Waterfall', 'Volcano', 'Cave', 'BodyOfWater', 'Square',
  'LodgingBusiness', 'BedAndBreakfast', 'Hostel', 'RuralHotel',
  'ViewPoint', 'Trail', 'City', 'Landform', 'ApartHotel', 'Apartment',
  'Brewery', 'BusinessEvent', 'BusStation', 'BusStop',
] as const;
