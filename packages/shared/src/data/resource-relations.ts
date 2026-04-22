/**
 * Modelo de relaciones entre recursos (paso 8)
 *
 * Define los predicados soportados, sus metadatos, las reglas de
 * bidireccionalidad, el mapeo a schema.org (UNE 178503) para exportación
 * al PID, y las heurísticas de compatibilidad semántica (decisión 6-C).
 */

// ─── Predicados soportados (decisión 2-B: 6 predicados) ────────────────

export type RelationPredicate =
  | 'is_part_of'
  | 'contains'
  | 'related_to'
  | 'includes'
  | 'near_by'
  | 'same_category'
  | 'follows';

/** Metadatos visibles de cada predicado */
export interface PredicateMeta {
  key: RelationPredicate;
  /** Etiqueta corta en castellano */
  label: string;
  /** Frase de apoyo en la UI: "Este recurso ___" */
  uiPhrase: string;
  /** Frase inversa: "Es ___ por:" */
  uiPhraseInverse: string;
  /** Descripción breve para ayudar a elegir */
  description: string;
  /** Predicado inverso automático (null si no tiene) */
  inverse: RelationPredicate | null;
  /** Mapeo a schema.org / UNE 178503 */
  schemaOrgPredicate: string;
  /** Si es jerárquico, triggea validación de ciclos */
  isHierarchical: boolean;
  /** Si el predicado es simétrico, el inverso es el mismo */
  isSymmetric: boolean;
  /** Icono (emoji) */
  icon: string;
  /** Se puede crear manualmente (false para 'contains', que se genera) */
  canCreateManually: boolean;
}

export const PREDICATES: Record<RelationPredicate, PredicateMeta> = {
  is_part_of: {
    key: 'is_part_of',
    label: 'Forma parte de',
    uiPhrase: 'forma parte de',
    uiPhraseInverse: 'Contiene:',
    description: 'Jerarquía: el recurso es un elemento contenido en otro más grande. Ej: "Iglesia de Santa María" forma parte de "Conjunto histórico de Cambados".',
    inverse: 'contains',
    schemaOrgPredicate: 'isPartOf',
    isHierarchical: true,
    isSymmetric: false,
    icon: '📂',
    canCreateManually: true,
  },
  contains: {
    key: 'contains',
    label: 'Contiene',
    uiPhrase: 'contiene',
    uiPhraseInverse: 'Forma parte de:',
    description: 'Inverso automático de "Forma parte de". No se crea manualmente.',
    inverse: 'is_part_of',
    schemaOrgPredicate: 'containsPlace',
    isHierarchical: true,
    isSymmetric: false,
    icon: '🗃',
    canCreateManually: false,
  },
  related_to: {
    key: 'related_to',
    label: 'Se relaciona con',
    uiPhrase: 'se relaciona con',
    uiPhraseInverse: 'Se relaciona con:',
    description: 'Vínculo bidireccional sin jerarquía. Ej: un hotel relacionado con el pazo que se visita durante la estancia.',
    inverse: 'related_to',
    schemaOrgPredicate: 'isRelatedTo',
    isHierarchical: false,
    isSymmetric: true,
    icon: '🔗',
    canCreateManually: true,
  },
  includes: {
    key: 'includes',
    label: 'Incluye (ruta)',
    uiPhrase: 'incluye como parada',
    uiPhraseInverse: 'Es parada de:',
    description: 'Típico de rutas e itinerarios. El origen es una ruta que incluye el destino como parada.',
    inverse: 'is_part_of',
    schemaOrgPredicate: 'includesAttraction',
    isHierarchical: true,
    isSymmetric: false,
    icon: '🧭',
    canCreateManually: true,
  },
  near_by: {
    key: 'near_by',
    label: 'Está cerca de',
    uiPhrase: 'está cerca de',
    uiPhraseInverse: 'Está cerca de:',
    description: 'Proximidad geográfica. Ej: un restaurante cerca de una playa. Útil para recomendaciones.',
    inverse: 'near_by',
    schemaOrgPredicate: 'geographicallyRelatedTo',
    isHierarchical: false,
    isSymmetric: true,
    icon: '📍',
    canCreateManually: true,
  },
  same_category: {
    key: 'same_category',
    label: 'Misma categoría que',
    uiPhrase: 'es de la misma categoría que',
    uiPhraseInverse: 'Misma categoría que:',
    description: 'Recursos equivalentes. Ej: dos hoteles comparables del mismo rango.',
    inverse: 'same_category',
    schemaOrgPredicate: 'sameAs',
    isHierarchical: false,
    isSymmetric: true,
    icon: '🔁',
    canCreateManually: true,
  },
  follows: {
    key: 'follows',
    label: 'Sigue a (secuencial)',
    uiPhrase: 'sigue a',
    uiPhraseInverse: 'Precede a:',
    description: 'Orden secuencial en una ruta. La parada 2 sigue a la parada 1.',
    inverse: null, // sin inverso automático
    schemaOrgPredicate: 'followedBy',
    isHierarchical: false,
    isSymmetric: false,
    icon: '➡️',
    canCreateManually: true,
  },
};

/** Lista ordenada de predicados para el selector, filtrando los que no se pueden crear */
export const CREATABLE_PREDICATES: PredicateMeta[] = Object.values(PREDICATES)
  .filter((p) => p.canCreateManually);

// ─── Registro de relación (shape que devuelve la RPC) ──────────────────

export interface ResourceRelation {
  id: string;
  predicate: RelationPredicate;
  targetId: string;
  targetName: string;
  targetSlug: string;
  targetType: string | null;
  targetMunicipality: string | null;
  targetStatus: string;
  note: string | null;
  isMirror: boolean;
  createdAt: string;
}

export function mapRpcRelation(r: Record<string, unknown>): ResourceRelation {
  return {
    id: String(r.id),
    predicate: r.predicate as RelationPredicate,
    targetId: String(r.target_id),
    targetName: String(r.target_name ?? '(sin nombre)'),
    targetSlug: String(r.target_slug ?? ''),
    targetType: (r.target_type as string) ?? null,
    targetMunicipality: (r.target_municipality as string) ?? null,
    targetStatus: String(r.target_status ?? 'draft'),
    note: (r.note as string) ?? null,
    isMirror: Boolean(r.is_mirror),
    createdAt: String(r.created_at ?? new Date().toISOString()),
  };
}

// ─── Resultado de búsqueda (autocomplete + modal) ──────────────────────

export interface RelationSearchResult {
  id: string;
  name: string;
  slug: string;
  type: string | null;
  municipalityName: string | null;
  status: string;
  qualityScore: number;
}

export function mapRpcSearchResult(r: Record<string, unknown>): RelationSearchResult {
  return {
    id: String(r.id),
    name: String(r.name ?? '(sin nombre)'),
    slug: String(r.slug ?? ''),
    type: (r.type as string) ?? null,
    municipalityName: (r.municipality_name as string) ?? null,
    status: String(r.status ?? 'draft'),
    qualityScore: Number(r.quality_score ?? 0),
  };
}

// ─── Compatibilidad semántica (decisión 6-C: warning no bloqueante) ────

/** Tipología raíz simplificada para warnings */
type TypeFamily = 'accommodation' | 'gastronomy' | 'nature' | 'heritage' | 'event' | 'route' | 'other';

function familyForType(type: string | null): TypeFamily {
  if (!type) return 'other';
  const t = type.toLowerCase();
  // Alojamiento
  if (['hotel', 'hostel', 'apartment', 'campground', 'ruralhotel', 'boutiquehotel',
       'resort', 'youthhostel', 'bedandbreakfast', 'cottage', 'guesthouse',
       'apartahotel', 'inn'].some((k) => t.includes(k.toLowerCase()))) {
    return 'accommodation';
  }
  // Gastronomía
  if (['restaurant', 'bar', 'cafe', 'pub', 'bakery', 'winery', 'brewery'].some((k) => t.includes(k))) {
    return 'gastronomy';
  }
  // Naturaleza
  if (['beach', 'park', 'naturepark', 'trail', 'waterfall', 'volcano', 'mountain', 'forest',
       'mirador', 'viewpoint'].some((k) => t.includes(k))) {
    return 'nature';
  }
  // Patrimonio
  if (['museum', 'church', 'castle', 'monument', 'historic', 'landmark', 'ruins',
       'pazo', 'archaeological'].some((k) => t.includes(k))) {
    return 'heritage';
  }
  // Eventos
  if (['event', 'festival', 'fair', 'concert'].some((k) => t.includes(k))) {
    return 'event';
  }
  // Rutas
  if (['trip', 'touristtrip', 'itinerary', 'trail', 'route'].some((k) => t.includes(k))) {
    return 'route';
  }
  return 'other';
}

/**
 * Detecta combinaciones semánticamente raras.
 * Devuelve un mensaje si hay warning, o null si es OK.
 *
 * Decisión 6-C: solo WARNING, no bloqueante.
 */
export function detectSemanticWarning(
  sourceType: string | null,
  targetType: string | null,
  predicate: RelationPredicate,
): string | null {
  const srcFamily = familyForType(sourceType);
  const tgtFamily = familyForType(targetType);

  // includes solo tiene sentido si el origen es una ruta
  if (predicate === 'includes' && srcFamily !== 'route') {
    return 'El predicado "Incluye (ruta)" se usa normalmente cuando el origen es una ruta o itinerario.';
  }

  // is_part_of: combinaciones raras
  if (predicate === 'is_part_of') {
    if (srcFamily === 'accommodation' && tgtFamily === 'gastronomy') {
      return 'Es poco común que un alojamiento "forme parte" de un restaurante. ¿Querías decir "se relaciona con"?';
    }
    if (srcFamily === 'event' && tgtFamily !== 'heritage' && tgtFamily !== 'other') {
      return 'Un evento suele "celebrarse en" un lugar más que "formar parte" de él. Considera usar "se relaciona con".';
    }
  }

  // follows entre recursos de familias muy distintas
  if (predicate === 'follows') {
    if (srcFamily !== tgtFamily && srcFamily !== 'route' && tgtFamily !== 'route') {
      return 'El predicado "Sigue a" se usa típicamente entre paradas de una misma ruta.';
    }
  }

  // same_category entre familias distintas
  if (predicate === 'same_category' && srcFamily !== tgtFamily && srcFamily !== 'other' && tgtFamily !== 'other') {
    return `"${sourceType}" y "${targetType}" pertenecen a categorías diferentes. ¿Seguro que son equivalentes?`;
  }

  return null;
}

// ─── Agrupación por predicado para visualización ───────────────────────

export interface GroupedRelations {
  predicate: RelationPredicate;
  meta: PredicateMeta;
  relations: ResourceRelation[];
  /** Si es mirror, se muestra en un grupo aparte con etiqueta inversa */
  isMirrorGroup: boolean;
}

/**
 * Agrupa las relaciones por predicado, separando outgoing (creadas
 * por el usuario) de incoming (mirrors). Útil para el visor de relaciones.
 */
export function groupRelations(rels: ResourceRelation[]): GroupedRelations[] {
  const groups = new Map<string, GroupedRelations>();

  for (const rel of rels) {
    const key = `${rel.predicate}-${rel.isMirror ? 'in' : 'out'}`;
    if (!groups.has(key)) {
      groups.set(key, {
        predicate: rel.predicate,
        meta: PREDICATES[rel.predicate],
        relations: [],
        isMirrorGroup: rel.isMirror,
      });
    }
    groups.get(key)!.relations.push(rel);
  }

  // Ordenar: outgoing primero, luego incoming, por orden de predicados
  const ORDER: RelationPredicate[] = [
    'is_part_of', 'contains', 'includes', 'related_to', 'near_by', 'same_category', 'follows',
  ];

  return Array.from(groups.values()).sort((a, b) => {
    if (a.isMirrorGroup !== b.isMirrorGroup) {
      return a.isMirrorGroup ? 1 : -1;
    }
    return ORDER.indexOf(a.predicate) - ORDER.indexOf(b.predicate);
  });
}
