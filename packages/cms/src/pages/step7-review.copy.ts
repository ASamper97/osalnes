/**
 * Copy del Paso 7 — "Revisión" (paso 7a)
 *
 * Principios:
 *   - Todas las tildes correctas.
 *   - Tono positivo: "así de bien va", no "estas son las cosas mal".
 *   - Los mensajes de error dan acción concreta ("ve al paso N").
 */

export const STEP7_COPY = {
  header: {
    title: 'Revisión',
    subtitle: 'Comprueba el estado del recurso antes de publicar.',
  },

  helpBlock: {
    title: 'Cómo funciona esta pantalla',
    bullets: [
      'Revisa el resumen de calidad arriba. Te da una nota general del 0 al 100.',
      'Cada tarjeta de paso muestra si está completa, mejorable o con errores.',
      'Pulsa "Editar" en cualquier tarjeta para volver al paso y corregir.',
      'Cuando estés listo, elige publicar o guardar como borrador.',
    ],
    note:
      'Si intentas publicar con errores críticos, te avisaremos antes de hacerlo.',
    toggleHide: 'Ocultar esta ayuda',
    toggleShow: '¿Cómo funciona esta pantalla?',
  },

  dashboard: {
    scoreLabel: 'Calidad del recurso',
    allOk: 'Todo en orden. Puedes publicar con confianza.',
    warnings: 'Hay {count} punto{plural} a mejorar.',
    criticals: 'Hay {count} error{plural} a corregir antes de publicar.',
    mixed: '{criticals} error{criticalsPlural} y {warnings} aviso{warningsPlural}.',
  },

  stepCards: {
    stepLabels: {
      identification: 'Identificación',
      content: 'Contenido',
      location: 'Ubicación y contacto',
      classification: 'Clasificación',
      multimedia: 'Multimedia',
      seo: 'SEO e idiomas',
    },
    statusLabels: {
      ok: 'Completo',
      warn: 'Mejorable',
      incomplete: 'Incompleto',
      empty: 'Sin revisar',
    },
    editButton: 'Editar',
    checksCount: '{count} punto{plural} a revisar',
    allPassed: 'Todos los puntos revisados correctamente',
  },

  pidCard: {
    title: 'Completitud semántica PID',
    subtitle:
      'Detalles técnicos para exportar al PID de SEGITTUR. Solo de interés para el responsable técnico.',
    toggleHide: 'Ocultar detalles PID',
    toggleShow: 'Ver detalles PID',
    mandatoryLabel: 'OBLIGATORIO',
    optionalLabel: 'opcional',
    groupLabels: {
      schemaType: 'Tipo schema.org',
      mainType: 'Tipología turística',
      amenities: 'Servicios / características',
      accessibility: 'Accesibilidad',
      municipio: 'Municipio',
      gastronomy: 'Gastronomía',
      editorial: 'Curaduría editorial',
    },
    groupHints: {
      schemaType: 'Derivado automáticamente de la tipología del paso 1.',
      mainType: 'Etiquetas de segmento turístico.',
      amenities: 'Servicios y características del recurso.',
      accessibility:
        'Describe facilidades para personas con discapacidad. Importante pero opcional.',
      municipio: 'Asignado en el paso 1. Obligatorio para el PID.',
      gastronomy: 'Solo aplica a restaurantes y bodegas. Normal que esté a 0 en otros tipos.',
      editorial:
        'Uso interno del CMS (recursos destacados, colecciones). No se exporta al PID.',
    },
    exportableTotal: '{count} etiqueta{plural} exportable{plural} al PID en total',
  },

  publicationOptions: {
    title: 'Opciones de publicación',
    visibleOnMap: {
      label: 'Visible en el mapa público',
      hint:
        'Si lo dejas marcado, este recurso aparecerá como punto en el mapa de recursos turísticos de la web.',
      note:
        'Decide si este recurso debe aparecer en el mapa público. Puedes cambiarlo después en cualquier momento.',
    },
    indexableHint: 'Indexación en buscadores: ver paso 6.',
  },

  actions: {
    saveDraft: 'Guardar como borrador',
    saveDraftLoading: 'Guardando…',
    publish: 'Publicar recurso',
    publishLoading: 'Publicando…',
    previous: '← Anterior',
  },

  publishModal: {
    titleClean: '¿Publicar este recurso?',
    titleWithWarnings: 'Hay avisos antes de publicar',
    titleWithErrors: 'No se recomienda publicar con errores',
    summaryClean:
      'El recurso pasó todas las comprobaciones de calidad. Al publicar aparecerá en la web pública.',
    summaryWarnings:
      'El recurso tiene {count} aviso{plural} que puedes corregir para mejorar la calidad. Si publicas ahora, aparecerá en la web con esos puntos pendientes.',
    summaryErrors:
      'El recurso tiene {count} error{plural} crítico{plural}. Publicarlo ahora puede dejar la ficha incompleta o mal presentada en la web.',
    checksTitle: 'Puntos detectados:',
    confirmCleanButton: 'Publicar ahora',
    confirmWarningsButton: 'Publicar de todos modos',
    confirmErrorsButton: 'Publicar pese a los errores',
    cancelButton: 'Volver a corregir',
  },

  errors: {
    saveDraft: 'No se ha podido guardar el borrador. Inténtalo de nuevo.',
    publish: 'No se ha podido publicar. Inténtalo de nuevo.',
  },
} as const;
