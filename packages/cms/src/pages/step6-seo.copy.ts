/**
 * Copy del Paso 6 — "SEO e idiomas"
 *
 * Principios:
 *   - Tildes correctas siempre (título, descripción, traducción…).
 *   - Sin inglés innecesario ("chars" → "caracteres").
 *   - El funcionario no tiene por qué saber qué es "Open Graph" ni
 *     "meta description"; le explicamos el QUÉ (cómo aparece en Google,
 *     al compartir en WhatsApp…) y no el CÓMO técnico.
 */

export const STEP6_COPY = {
  header: {
    title: 'SEO e idiomas',
    subtitle:
      'Ayuda a que el recurso aparezca en Google y a que se vea bien cuando alguien comparte el enlace. También puedes traducirlo a otros idiomas.',
  },

  helpBlock: {
    title: 'Qué pedimos aquí',
    bullets: [
      'Un título y una descripción específicos para buscadores (se ven en los resultados de Google).',
      'Opcionalmente, la dirección web (slug) y palabras clave que definan el recurso.',
      'Traducciones del nombre y descripción para visitantes que no hablan castellano ni gallego.',
      'Una imagen para cuando alguien comparta el enlace en redes sociales.',
    ],
    note: 'Nada aquí es obligatorio, pero cuanto más rellenes, mejor posicionará el recurso.',
    toggleHide: 'Ocultar esta ayuda',
    toggleShow: '¿Cómo rellenar este paso?',
  },

  // ─── Preview de Google ──────────────────────────────────────────────
  googlePreview: {
    title: 'Vista previa en Google',
    subtitle: 'Así verán el recurso las personas que lo busquen.',
    fallbackTitle: '(Sin título SEO — se usará el nombre del recurso)',
    fallbackDescription:
      '(Sin descripción SEO — Google usará un extracto automático del contenido)',
    urlPrefix: 'osalnes.gal › recurso',
  },

  // ─── Preview de tarjeta de compartir ────────────────────────────────
  socialPreview: {
    title: 'Vista previa al compartir',
    subtitle: 'Así se verá cuando alguien comparta el enlace en WhatsApp, Facebook o X.',
    fallbackImage: 'Sin imagen',
    domain: 'osalnes.gal',
  },

  // ─── SEO por idioma ─────────────────────────────────────────────────
  seoFields: {
    sectionTitle: 'Título y descripción para buscadores',
    sectionDesc:
      'Estos textos aparecen en los resultados de Google y al compartir en redes. Un buen SEO atrae más visitantes.',

    titleLabelEs: 'Título SEO en castellano',
    titleLabelGl: 'Título SEO en gallego',
    titlePlaceholder: 'Título para los resultados de Google',

    descLabelEs: 'Descripción SEO en castellano',
    descLabelGl: 'Descripción SEO en gallego',
    descPlaceholder: 'Descripción que aparecerá bajo el título en Google',

    counterIdeal: 'ideal entre {min} y {max} caracteres',
    counterEmpty: 'vacío — se usará el nombre del recurso',
    counterShort: 'corto — puedes añadir algo más ({current}/{recommendedMin})',
    counterOk: 'longitud correcta ({current})',
    counterLong: 'largo — puede cortarse ({current}/{recommendedMax})',
    counterOverHard: 'demasiado largo — Google lo cortará ({current}/{hardMax})',

    aiSuggestButton: '✨ Generar SEO con IA',
    aiSuggestLoading: 'Generando…',
    aiSuggestHint:
      'La IA lee la descripción del paso 2 y te propone título y descripción optimizados.',
    aiSuggestError: 'No se ha podido generar el SEO. Revisa que hay descripción en el paso 2.',
  },

  // ─── Slug editable (decisión 3-B) ───────────────────────────────────
  slug: {
    sectionTitle: 'Dirección web (slug)',
    sectionDesc:
      'La parte final de la URL del recurso. Usa solo letras minúsculas, números y guiones.',
    urlPreviewPrefix: 'osalnes.gal/recurso/',
    regenerateButton: 'Regenerar desde el nombre',
    statusLocked:
      'Este recurso ya está publicado. Cambiar el slug romperá los enlaces actuales. Solo se puede editar en estado borrador.',
    statusInvalid: 'Solo letras minúsculas, números y guiones (sin acentos ni espacios).',
    statusDuplicate: 'Ya existe otro recurso con ese slug. Prueba otro.',
    statusOk: 'Disponible.',
    statusTooLong: 'Demasiado largo. Máximo {max} caracteres.',
  },

  // ─── Control de indexación (decisión 4-A) ───────────────────────────
  indexation: {
    sectionTitle: 'Visibilidad en buscadores',
    toggleLabel: 'Visible en buscadores (Google, Bing…)',
    toggleHintOn:
      'Activado: el recurso aparecerá en los resultados de búsqueda. Es lo habitual.',
    toggleHintOff:
      'Desactivado: el recurso no aparecerá en Google, pero las personas con el enlace directo sí podrán verlo. Útil para recursos privados o temporales.',
  },

  // ─── Imagen Open Graph (decisión 5-A) ───────────────────────────────
  ogImage: {
    sectionTitle: 'Imagen al compartir',
    sectionDesc:
      'La foto que aparece cuando alguien comparte el enlace en WhatsApp, Facebook o X.',
    usingPrimaryLabel: 'Usando la foto principal del paso 5',
    usingPrimaryEmpty:
      'Aún no hay foto principal en el paso 5. Subirás una ahí o puedes poner una distinta aquí.',
    usingOverrideLabel: 'Usando una imagen específica para redes',
    uploadButton: 'Subir otra imagen',
    removeOverrideButton: 'Volver a usar la foto principal',
    removeOverrideConfirm:
      '¿Seguro que quieres quitar la imagen específica y usar la principal del paso 5?',
    recommendedSize: 'Recomendado: 1200 × 630 píxeles, mínimo 600 × 315.',
  },

  // ─── Keywords (decisión 6-A) ────────────────────────────────────────
  keywords: {
    sectionTitle: 'Palabras clave',
    sectionDesc:
      'Pocas palabras que describan el recurso. Ayudan al buscador interno de la web a encontrar el recurso cuando alguien escribe términos parecidos.',
    addPlaceholder: 'Escribe una palabra y pulsa Enter',
    addButton: 'Añadir',
    removeLabel: 'Quitar',
    aiSuggestButton: '✨ Sugerir con IA',
    aiSuggestLoading: 'Pensando…',
    aiSuggestHint: 'La IA lee la descripción del paso 2 y propone 5-8 palabras clave.',
    applyAllSuggestions: 'Añadir todas las sugerencias',
    emptyState: 'No hay palabras clave todavía.',
    limitReached: 'Has llegado al máximo de {max} palabras clave.',
  },

  // ─── Traducciones adicionales ────────────────────────────────────────
  translations: {
    sectionTitle: 'Traducciones a otros idiomas',
    sectionDesc:
      'Traduce el nombre y la descripción corta a inglés, francés y portugués. El gallego ya lo rellenaste en el paso 2.',

    nameLabel: 'Nombre en {lang}',
    namePlaceholder: 'Traducción del nombre',
    descLabel: 'Descripción corta en {lang}',
    descPlaceholder: 'Traducción de la descripción',

    translateAllButton: '✨ Traducir todo a {langs}',
    translateAllLoading: 'Traduciendo…',
    translateAllHint:
      'Traduce todos los campos vacíos de golpe usando la descripción del paso 2 como origen.',
    translateOneButton: 'Traducir',
    translateOneLoading: '…',

    translateErrorGeneric: 'No se ha podido traducir. Vuelve a intentarlo en unos segundos.',
  },

  // ─── Auditoría inline (decisión 1-C) ────────────────────────────────
  audit: {
    sectionTitle: 'Revisión SEO automática',
    scoreLabel: 'Nota SEO',
    toggleShow: 'Ver auditoría detallada',
    toggleHide: 'Ocultar auditoría',
    summaryAllOk: 'Todo correcto. Buen trabajo.',
    summaryWarns: '{count} avisos a revisar.',
    summaryFails: '{count} errores a corregir antes de publicar.',
    statusLabels: {
      pass: 'Correcto',
      warn: 'A mejorar',
      fail: 'A corregir',
    },
  },

  footer: {
    previous: '← Anterior',
    next: 'Siguiente →',
    skip: 'Saltar paso',
  },
} as const;
