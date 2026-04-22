/**
 * Copy · Paso 8 del wizard · Relaciones entre recursos
 */

export const STEP8_COPY = {
  header: {
    title: 'Relaciones con otros recursos',
    subtitle: 'Conecta este recurso con otros para crear estructuras jerárquicas o vínculos semánticos.',
    badge: 'Paso 8 de 8 · Opcional',
    saveNeededBanner: 'Guarda el recurso como borrador antes de poder crear relaciones.',
  },

  infoBox: {
    title: 'Para qué sirven las relaciones',
    lines: [
      '🔗 Permiten conectar recursos formando rutas, grupos o jerarquías.',
      '🌐 Se exportan al PID siguiendo la norma UNE 178503 (schema.org).',
      '⚡ Mejoran las recomendaciones y los "Lugares relacionados" en la web.',
    ],
  },

  addSection: {
    title: 'Añadir una relación',
    predicateLabel: 'Tipo de relación',
    predicatePlaceholder: 'Elige cómo se conecta este recurso…',
    targetLabel: 'Con qué recurso',
    targetPlaceholder: 'Escribe el nombre del recurso…',
    advancedSearchButton: 'Buscar más…',
    noteLabel: 'Nota (opcional)',
    notePlaceholder: 'Aclaración para el editor (ej: "ubicado dentro del conjunto histórico")',
    addButton: 'Añadir relación',
    cancelButton: 'Cancelar',
  },

  warning: {
    title: 'Aviso semántico',
    ignoreButton: 'Continuar de todas formas',
    reconsiderButton: 'Cambiar',
  },

  list: {
    emptyTitle: 'Este recurso aún no tiene relaciones',
    emptyHint: 'Las relaciones ayudan a los visitantes a descubrir más lugares y mejoran la exportación al PID.',
    mirrorLabel: '(automática)',
    mirrorTooltip: 'Esta relación se creó automáticamente porque el otro recurso te conectó.',
    deleteTooltip: 'Eliminar relación',
    confirmDeleteTitle: '¿Eliminar esta relación?',
    confirmDeleteBody: 'La relación inversa también se eliminará. Esta acción no se puede deshacer.',
    confirmDeleteConfirm: 'Sí, eliminar',
    confirmDeleteCancel: 'Cancelar',
    visitLabel: 'Ver recurso',
  },

  advancedSearch: {
    title: 'Buscar recurso para relacionar',
    searchPlaceholder: 'Nombre del recurso…',
    typeFilterLabel: 'Tipología',
    typeFilterAny: 'Cualquier tipología',
    municipalityFilterLabel: 'Municipio',
    municipalityFilterAny: 'Cualquier municipio',
    statusFilterLabel: 'Estado',
    statusFilterAny: 'Cualquier estado',
    statusPublished: 'Publicados',
    statusDraft: 'Borradores',
    noResults: 'Sin coincidencias',
    selectButton: 'Seleccionar',
    cancelButton: 'Cancelar',
    resultsSummary: '{count} resultados',
  },

  jsonldPreview: {
    title: 'Vista previa JSON-LD (para PID)',
    hint: 'Así se exportará este bloque de relaciones al Sistema PID según UNE 178503.',
    toggleShow: 'Ver JSON-LD',
    toggleHide: 'Ocultar JSON-LD',
  },

  statusLabels: {
    draft: 'Borrador',
    published: 'Publicado',
    scheduled: 'Programado',
    archived: 'Archivado',
    in_review: 'En revisión',
  } as Record<string, string>,
} as const;
