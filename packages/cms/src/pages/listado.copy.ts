/**
 * Copy de la pantalla SCR-03 · Listado de recursos
 *
 * Tildes correctas en todo. Tono práctico y directo.
 */

export const LIST_COPY = {
  header: {
    title: 'Recursos turísticos',
    subtitle: 'Busca, filtra y gestiona los recursos del destino.',
    newButton: '+ Nuevo recurso',
  },

  kpis: {
    total: 'Recursos totales',
    published: 'Publicados',
    scheduled: 'Programados',
    draft: 'Borradores',
    archived: 'Archivados',
    incompleteForPublish: 'Incompletos',
  },

  tabs: {
    all: 'Todos',
    published: 'Publicados',
    scheduled: 'Programados',
    draft: 'Borradores',
    inReview: 'En revisión',
    archived: 'Archivados',
  },

  search: {
    placeholder: 'Buscar por nombre…',
    clearLabel: 'Limpiar búsqueda',
  },

  filters: {
    toggleLabel: 'Filtros',
    toggleLabelWithCount: 'Filtros · {count} activos',
    clearAll: 'Limpiar filtros',
    applyButton: 'Aplicar',

    typologyLabel: 'Tipología',
    typologyPlaceholder: 'Todas las tipologías',
    typologyCountSuffix: '({count})',

    municipalityLabel: 'Municipio',
    municipalityPlaceholder: 'Todos los municipios',

    languagesMissingLabel: 'Sin traducir a',
    languagesMissingHint: 'Marca los idiomas que te faltan para detectar recursos sin traducir.',

    visibleOnMapLabel: 'Visible en mapa',
    visibleOnMapYes: 'Sí',
    visibleOnMapNo: 'No',
    visibleOnMapAny: 'Indiferente',

    hasCoordinatesLabel: 'Coordenadas',
    hasCoordinatesYes: 'Con coordenadas',
    hasCoordinatesNo: 'Sin coordenadas',
    hasCoordinatesAny: 'Indiferente',

    incompleteLabel: 'Solo incompletos para publicar',
    incompleteHint: 'Recursos que no tienen todos los campos obligatorios rellenados.',

    onlyMineLabel: 'Solo mis recursos',
  },

  columns: {
    select: 'Seleccionar',
    name: 'Nombre',
    typology: 'Tipología',
    municipality: 'Municipio',
    status: 'Estado',
    languages: 'Idiomas',
    map: 'Mapa',
    quality: 'Calidad',
    updatedAt: 'Actualizado',
    actions: 'Acciones',
  },

  rowActions: {
    edit: 'Editar',
    moreMenu: 'Más acciones',
    preview: 'Ver vista previa',
    duplicate: 'Duplicar recurso',
    changeStatus: 'Cambiar estado',
    statusPublish: 'Publicar',
    statusUnpublish: 'Despublicar (a borrador)',
    statusArchive: 'Archivar',
    statusRestore: 'Restaurar (a borrador)',
    viewHistory: 'Ver historial',
    delete: 'Eliminar…',
  },

  statusLabels: {
    draft: 'Borrador',
    published: 'Publicado',
    scheduled: 'Programado',
    archived: 'Archivado',
    in_review: 'En revisión',
  },

  inlineEdit: {
    namePlaceholder: 'Nombre del recurso',
    saveLabel: 'Guardar',
    cancelLabel: 'Cancelar',
    editTitle: 'Editar campo',
    saveError: 'No se ha podido guardar. Inténtalo de nuevo.',
  },

  languageChips: {
    es: 'ES',
    gl: 'GL',
    en: 'EN',
    fr: 'FR',
    pt: 'PT',
  },

  mapChip: {
    visible: 'Visible',
    hidden: 'Oculto',
    missingCoords: 'Sin coordenadas',
  },

  pagination: {
    pageSizeLabel: 'Por página',
    totalLabel: '{total} recursos · página {page} de {totalPages}',
    previousPage: 'Anterior',
    nextPage: 'Siguiente',
  },

  emptyStates: {
    noResults: {
      title: 'No hay recursos que coincidan',
      hint: 'Prueba ajustando los filtros o la búsqueda.',
      cta: 'Limpiar filtros',
    },
    noResourcesYet: {
      title: 'Aún no hay recursos',
      hint: 'Crea el primero para empezar a gestionar el contenido turístico.',
      cta: '+ Crear primer recurso',
    },
    error: {
      title: 'No se han podido cargar los recursos',
      hint: 'Comprueba tu conexión y vuelve a intentarlo.',
      cta: 'Reintentar',
    },
  },

  deleteModal: {
    title: '¿Eliminar este recurso?',
    body: 'El recurso "{name}" se eliminará permanentemente. Esta acción no se puede deshacer. Si solo quieres dejarlo de publicar, usa "Archivar".',
    confirmButton: 'Sí, eliminar',
    cancelButton: 'Cancelar',
    archiveInsteadButton: 'Archivar en vez de eliminar',
  },
} as const;
