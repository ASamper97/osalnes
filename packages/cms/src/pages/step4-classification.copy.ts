/**
 * Copy del Paso 4 del wizard de recursos ("Clasificación")
 *
 * Principios:
 *   - Lenguaje de funcionario, sin tecnicismos (nada de "touristType",
 *     "amenityFeature", "vocabulario controlado").
 *   - Acentos correctos siempre.
 *   - Explica qué hace cada cosa y por qué importa (el funcionario
 *     entiende el "por qué", pero no los términos técnicos).
 *   - Los badges "PID" / "SOLO CMS" se mantienen según decisión 1-C del
 *     usuario — los copy de abajo incluyen el tooltip explicativo.
 */

export const STEP4_COPY = {
  header: {
    title: 'Clasificación',
    subtitle:
      'Elige etiquetas que describan cómo es este recurso. Ayudan a que los visitantes lo encuentren cuando buscan filtrado por características.',
  },

  helpBlock: {
    title: 'Qué pedimos aquí',
    bullets: [
      'Rellena los datos específicos del tipo de recurso (estrellas, aforo, cocina…) solo si aplican.',
      'Marca todas las características que tenga el recurso: servicios, accesibilidad, idiomas, valoraciones.',
      'Puedes usar "Sugerir etiquetas con IA" para que Claude lea la descripción y proponga las más relevantes.',
    ],
    note:
      'Ninguna etiqueta es obligatoria, pero cuantas más marques, más fácil será para los visitantes encontrar este recurso.',
    toggleHide: 'Ocultar esta ayuda',
    toggleShow: '¿Cómo rellenar este paso?',
  },

  // ─── Bloque condicional: datos del establecimiento ──────────────────
  establishment: {
    sectionTitle: 'Datos del establecimiento',
    sectionDesc:
      'Datos específicos de este tipo de recurso. Se exportan como campos oficiales del PID.',

    ratingLabel: 'Clasificación oficial',
    ratingPlaceholder: '— Sin clasificar —',
    ratingHints: {
      stars:    'Categoría oficial del alojamiento.',
      forks:    'Clasificación oficial del restaurante.',
      category: 'Categoría del establecimiento según normativa.',
    },

    occupancyLabel: 'Aforo (personas)',
    occupancyPlaceholder: 'Ej: 50',
    occupancyHint: 'Número máximo de personas que pueden estar simultáneamente.',

    cuisineLabel: 'Tipos de cocina',
    cuisinePlaceholderEmpty: 'Selecciona uno o varios tipos',
    cuisineHint:
      'Se usa el catálogo oficial (UNE 178503). Los tipos más frecuentes en O Salnés aparecen arriba. Si no encuentras el tipo exacto, elige el más próximo.',
    cuisineRelevantHeading: 'Más comunes en O Salnés',
    cuisineOtherHeading: 'Otras cocinas',
    cuisineSelectedLabel: 'seleccionadas',
  },

  // ─── Bloque de etiquetas ─────────────────────────────────────────────
  tags: {
    sectionTitle: 'Características y servicios',
    sectionDesc:
      'Marca todo lo que aplique al recurso. Se usan para filtrar búsquedas en la web pública.',

    searchPlaceholder: 'Buscar etiqueta...',
    selectedCountLabel: 'etiquetas seleccionadas',
    selectedCountLabelSingular: 'etiqueta seleccionada',

    // Header de cada grupo (cuenta de marcados)
    groupCountFormat: '{count} marcadas',
    groupCountFormatSingular: '{count} marcada',

    // Mostrando grupos aplicables
    applicableGroupsNote:
      'Mostrando {count} grupos aplicables para {typeLabel}.',
    applicableGroupsNoteEmpty:
      'Todos los grupos están visibles porque no se ha seleccionado una tipología en el paso 1.',

    // Tooltips de los badges (decisión 1-C: mantener badges)
    badgeTooltips: {
      pid:
        'Esta etiqueta se exporta a la Plataforma Inteligente de Destinos (PID) de SEGITTUR. Aparecerá en búsquedas nacionales.',
      solocms:
        'Esta etiqueta es interna del CMS. Se usa solo dentro de la web de O Salnés; no se exporta al PID.',
      accessibility:
        'Etiqueta de accesibilidad. Ayuda a visitantes con necesidades especiales.',
      amenity:
        'Característica o servicio del recurso.',
      cuisine:
        'Tipo de cocina (solo aplica a restaurantes y bodegas).',
    },

    // Separador visual del grupo Curaduría editorial (decisión 3-B)
    editorialDivider: 'Uso interno del equipo del CMS',
    editorialDividerHint:
      'Lo que marques aquí afecta solo al portal de O Salnés; no viaja al PID ni aparece como característica del recurso.',
  },

  // ─── Sugeridor IA ────────────────────────────────────────────────────
  aiSuggest: {
    title: 'Sugerir etiquetas con IA',
    description:
      'La IA leerá la descripción del paso 2 y te propondrá etiquetas relevantes. Tú decides cuáles marcar.',
    button: 'Sugerir etiquetas',
    buttonLoading: 'Leyendo la descripción…',
    buttonRetry: 'Volver a sugerir',
    disabledHint:
      'Añade primero una descripción en el paso 2 para que la IA pueda trabajar.',
    errorGeneric:
      'No se han podido generar sugerencias. Inténtalo de nuevo en unos segundos.',

    // Panel de sugerencias (decisión 4-A: explicado)
    suggestionsTitle: 'Sugerencias de la IA',
    suggestionsSubtitle:
      'Revisa cada sugerencia y decide si marcarla. La IA ha explicado por qué te propone cada una.',
    suggestedApplyLabel: 'Marcar sugerencia',
    suggestedDismissLabel: 'Descartar',
    suggestedAlreadyMarked: 'Ya marcada',
    suggestedApplyAllLabel: 'Marcar todas las sugerencias',
    suggestedDismissAllLabel: 'Descartar todas',
    suggestedPanelClose: 'Cerrar sugerencias',
    suggestedEmpty:
      'La IA no ha encontrado etiquetas nuevas que proponer. La descripción ya parece cubrir lo esencial.',
  },

  footer: {
    previous: '← Anterior',
    next: 'Siguiente →',
  },
} as const;
