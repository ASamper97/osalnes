/**
 * Copy del Paso 5 del wizard de recursos ("Multimedia")
 *
 * Principios:
 *   - Acentos correctos siempre (después, podrán, añadir, ubicación…).
 *   - Sin jerga técnica (nada de "MIME", "upload", "storage bucket").
 *   - Explica el "por qué" cada vez que pide algo del funcionario.
 *   - Tono pedagógico, pero directo (sin rollos largos).
 */

export const STEP5_COPY = {
  header: {
    title: 'Multimedia',
    subtitle:
      'Fotos, vídeos y documentos que ayuden a los visitantes a conocer el recurso antes de visitarlo.',
  },

  helpBlock: {
    title: 'Qué pedimos aquí',
    bullets: [
      'Sube fotos del recurso. La primera será la portada.',
      'Añade enlaces a vídeos de YouTube o Vimeo si los tienes.',
      'Sube documentos descargables como guías, menús o folletos.',
      'Escribe una descripción breve para cada foto (la IA te puede ayudar).',
    ],
    note:
      'Todos los bloques son opcionales, pero una foto de portada hace que el recurso aparezca mejor en la web pública.',
    toggleHide: 'Ocultar esta ayuda',
    toggleShow: '¿Cómo rellenar este paso?',
  },

  // ─── Estado "sin recurso guardado aún" (decisión 1-B) ───────────────
  unsavedState: {
    title: 'Guarda primero el recurso',
    description:
      'Las fotos, vídeos y documentos se asocian al recurso, así que primero necesitamos un ID. Tu trabajo de los pasos anteriores no se pierde: al guardar como borrador podrás seguir editando y volver aquí a subir contenido multimedia.',
    saveDraftButton: 'Guardar borrador y continuar',
    saveDraftLoading: 'Guardando…',
    skipButton: 'Saltar este paso',
    skipHint: 'Podrás volver más tarde cuando el recurso esté guardado.',
    errorGeneric:
      'No se ha podido guardar el borrador. Revisa tu conexión e inténtalo de nuevo.',
  },

  // ─── Bloque IMÁGENES ─────────────────────────────────────────────────
  images: {
    sectionTitle: 'Fotos',
    sectionDesc:
      'Sube una o varias fotos. La primera que aparece en la lista es la portada del recurso; puedes cambiarla pulsando la estrella en otra.',

    dropzoneLabel: 'Arrastra aquí tus fotos',
    dropzoneHint: 'o pulsa para seleccionar desde tu equipo',
    dropzoneAccepted: 'JPG, PNG, WebP · máximo 10 MB por foto',

    uploadProgressLabel: 'Subiendo',
    uploadErrorGeneric:
      'No se ha podido subir la foto. Comprueba el formato y el peso.',
    uploadErrorTooBig: 'La foto pesa demasiado. Máximo 10 MB.',
    uploadErrorWrongType: 'Formato no admitido. Usa JPG, PNG, WebP o AVIF.',
    uploadErrorTooMany: 'Máximo 30 fotos por recurso.',

    // Overlay de cada foto
    primaryBadge: 'Portada',
    setPrimaryLabel: 'Marcar como portada',
    removeLabel: 'Quitar foto',
    removeConfirm:
      '¿Seguro que quieres quitar esta foto? Se eliminará también del almacenamiento.',

    // Alt text
    altTextLabel: 'Descripción de la foto (alt text)',
    altTextPlaceholder:
      'Describe brevemente qué muestra la foto, como si se lo contaras por teléfono a alguien que no puede verla.',
    altTextHint:
      'Esta descripción la leen personas con discapacidad visual y los buscadores. Ayuda a la web a ser más accesible (WCAG 2.1 AA).',
    altTextMissingBadge: 'Sin descripción',
    altTextAiBadge: 'Generado por IA',
    altTextAiEditedBadge: 'Editado',
    altTextManualBadge: 'Manual',

    // Sugeridor IA (decisión 2-C: botón por lote con contador)
    aiSuggestTitle: 'Generar descripciones con IA',
    aiSuggestDescription:
      'La IA mira cada foto y te propone una descripción. Luego puedes editarla.',
    aiSuggestButtonEmpty:
      '✨ Generar descripciones para las {count} fotos sin descripción',
    aiSuggestButtonEmptySingular:
      '✨ Generar descripción para la foto sin descripción',
    aiSuggestButtonAllHave: 'Todas las fotos tienen descripción',
    aiSuggestButtonLoading:
      'Analizando {current} de {total}…',
    aiSuggestCompleted:
      '✓ Se han generado {count} descripciones. Revísalas y edita si es necesario.',
    aiSuggestErrorSome:
      'Se generaron {done} descripciones, pero {failed} fallaron. Inténtalo de nuevo.',
    aiSuggestErrorAll: 'No se han podido generar descripciones. Inténtalo más tarde.',
  },

  // ─── Bloque VÍDEOS (decisión 3-A: solo URL externa) ──────────────────
  videos: {
    sectionTitle: 'Vídeos',
    sectionDesc:
      'Pega enlaces a vídeos de YouTube o Vimeo. Se mostrarán embebidos en la ficha pública.',

    addPlaceholder: 'Pega la URL del vídeo aquí',
    addButton: 'Añadir vídeo',
    addButtonLoading: 'Comprobando…',
    addErrorInvalid:
      'Esa URL no es de un vídeo reconocido. Acepta YouTube (youtube.com o youtu.be) y Vimeo (vimeo.com).',
    addErrorDuplicate: 'Ese vídeo ya está añadido.',
    addErrorTooMany: 'Máximo 5 vídeos por recurso.',
    addErrorGeneric: 'No se ha podido añadir el vídeo.',

    removeLabel: 'Quitar vídeo',
    removeConfirm: '¿Seguro que quieres quitar este vídeo?',

    providerLabels: {
      youtube: 'YouTube',
      vimeo: 'Vimeo',
      other: 'Otro',
    },

    titleFallback: 'Vídeo sin título',
  },

  // ─── Bloque DOCUMENTOS (decisión 4-A: con metadata) ──────────────────
  documents: {
    sectionTitle: 'Documentos descargables',
    sectionDesc:
      'PDFs que los visitantes pueden descargar desde la ficha pública. Guías, menús, folletos, mapas de ruta, etc.',

    dropzoneLabel: 'Arrastra aquí tus PDFs',
    dropzoneHint: 'o pulsa para seleccionar desde tu equipo',
    dropzoneAccepted: 'Solo PDF · máximo 20 MB por documento',

    uploadErrorGeneric: 'No se ha podido subir el documento.',
    uploadErrorTooBig: 'El documento pesa demasiado. Máximo 20 MB.',
    uploadErrorWrongType: 'Formato no admitido. Solo PDF.',
    uploadErrorTooMany: 'Máximo 15 documentos por recurso.',

    // Metadata editable
    titleLabel: 'Título',
    titlePlaceholder: 'Ej: Guía de visita al pazo',
    titleHint: 'Lo que verá el visitante cuando se descargue el documento.',

    kindLabel: 'Tipo',
    langLabel: 'Idioma',
    sizeLabel: 'Peso',

    removeLabel: 'Quitar documento',
    removeConfirm: '¿Seguro que quieres quitar este documento?',
  },

  footer: {
    previous: '← Anterior',
    next: 'Siguiente →',
    skip: 'Saltar paso',
  },
} as const;
