/**
 * Copy del Paso 3 del wizard de recursos ("Ubicación y contacto")
 *
 * Principios:
 *   - Lenguaje de funcionario, sin tecnicismos (nada de "geocoding",
 *     "Nominatim", "lat/lng").
 *   - Acentos correctos siempre.
 *   - Explica qué ve el visitante en la web pública (por qué importa
 *     cada campo).
 */

export const STEP3_COPY = {
  header: {
    title: 'Ubicación y contacto',
    subtitle:
      'Dónde está el recurso y cómo contactar con él. El mapa es lo más importante: si el punto está bien puesto, los visitantes sabrán llegar sin esfuerzo.',
  },

  helpBlock: {
    title: 'Qué pedimos aquí',
    bullets: [
      'La ubicación exacta del recurso (aparece como pin en el mapa público).',
      'Cómo contactar (teléfono, web, email, redes sociales).',
      'Cuándo está abierto o disponible (horarios, temporadas, cita previa).',
    ],
    note:
      'Puedes dejar vacío cualquier bloque si todavía no tienes esos datos, pero sin ubicación el recurso no aparecerá en el mapa.',
    toggleHide: 'Ocultar esta ayuda',
    toggleShow: '¿Cómo rellenar este paso?',
  },

  // ─── Ubicación y dirección ───────────────────────────────────────────
  location: {
    sectionTitle: 'Ubicación en el mapa',
    sectionDesc:
      'Puedes buscar la dirección, clicar directamente en el mapa o pegar un enlace de Google Maps. Ajusta la posición arrastrando el pin.',

    tabs: {
      search: 'Buscar dirección',
      click: 'Clicar en el mapa',
      url: 'Pegar enlace',
    },

    searchPlaceholder: 'Escribe una dirección o lugar (ej: Rúa Real, Cambados)',
    searchHint:
      'Escribe al menos 3 caracteres. Los resultados se ordenan por cercanía a O Salnés.',
    searchEmpty: 'No se han encontrado resultados. Prueba a reformular la búsqueda o a clicar directamente en el mapa.',
    searchError: 'No se ha podido buscar la dirección. Comprueba tu conexión.',

    clickHint:
      'Haz clic en cualquier parte del mapa para colocar el pin, o arrástralo para ajustar.',

    urlPlaceholder: 'Pega aquí un enlace de Google Maps u OpenStreetMap',
    urlHint:
      'Acepta enlaces del tipo "https://www.google.com/maps/@42.5,-8.8,15z". Los enlaces cortos "maps.app.goo.gl" no son compatibles de momento.',
    urlError:
      'No hemos podido extraer coordenadas de ese enlace. Prueba con el enlace completo (no el acortado), o cópialo con "compartir → copiar enlace".',

    coordsLabelPrefix: 'Coordenadas:',
    coordsPendingLabel: 'Aún sin coordenadas',
    editManuallyLabel: '⚙️ Editar coordenadas manualmente',
    editManualLatLabel: 'Latitud',
    editManualLngLabel: 'Longitud',
    editManualApplyLabel: 'Aplicar',
    editManualCancelLabel: 'Cancelar',

    outsideOSalnesWarning:
      'Este punto parece estar fuera de O Salnés. ¿Es correcto?',
  },

  // ─── Dirección postal ────────────────────────────────────────────────
  address: {
    sectionTitle: 'Dirección',
    sectionDesc:
      'Se rellena sola cuando colocas el pin. Ajusta los campos si el geocoder no ha detectado algo correctamente.',

    streetLabel: 'Calle y número',
    streetPlaceholder: 'Ej: Rúa do Príncipe, 25',

    postalCodeLabel: 'Código postal',
    postalCodePlaceholder: 'Ej: 36001',

    localityLabel: 'Municipio',
    localityPlaceholder: '— auto-detectado del pin —',

    parroquiaLabel: 'Parroquia o zona',
    parroquiaPlaceholder: '— opcional —',

    autoFilledHint: 'Auto-rellenado desde la posición del pin.',
  },

  // ─── Contacto ────────────────────────────────────────────────────────
  contact: {
    sectionTitle: 'Cómo contactar',
    sectionDesc: 'Aparecerá en la ficha pública. Todos los campos son opcionales.',

    phoneLabel: 'Teléfono principal',
    phonePlaceholder: '+34 986 123 456',
    phoneHint: 'Incluye el prefijo (+34 para España).',

    emailLabel: 'Correo electrónico',
    emailPlaceholder: 'reservas@ejemplo.com',

    webLabel: 'Sitio web',
    webPlaceholder: 'https://www.ejemplo.com',

    socialSectionTitle: 'Redes sociales',
    socialAddLabel: 'Añadir red social',
    socialPlaceholders: {
      instagram: 'URL del perfil de Instagram',
      facebook: 'URL de la página de Facebook',
      tiktok: 'URL del perfil de TikTok',
      youtube: 'URL del canal de YouTube',
      twitter: 'URL del perfil de X (Twitter)',
      linkedin: 'URL de la página de LinkedIn',
      whatsapp: 'Número de WhatsApp (con prefijo, ej: +34...)',
    },
    socialRemoveLabel: 'Quitar',
  },

  // ─── Horarios ────────────────────────────────────────────────────────
  hours: {
    sectionTitle: 'Horarios y disponibilidad',
    sectionDesc:
      'Ayuda a que los visitantes no lleguen cuando está cerrado. Si no sabes los horarios exactos, puedes marcar "Consultar web" o "Con cita previa".',

    kindLabel: '¿Cómo funciona este recurso?',
    kinds: {
      always:      { label: 'Siempre abierto (24 horas, todos los días)',
                     hint:  'Típico de miradores, playas o espacios al aire libre.' },
      weekly:      { label: 'Horario semanal fijo',
                     hint:  'Define apertura y cierre para cada día de la semana.' },
      seasonal:    { label: 'Diferente según la temporada',
                     hint:  'Horario distinto en verano e invierno. Muy común en O Salnés.' },
      appointment: { label: 'Solo con cita previa',
                     hint:  'El visitante llama para reservar visita.' },
      event:       { label: 'Evento con fechas concretas',
                     hint:  'Para fiestas populares, festivales, mercados con fechas.' },
      external:    { label: 'Sin horario definido · consultar web',
                     hint:  'Cuando los horarios cambian o hay muchas excepciones.' },
      closed:      { label: 'Cerrado temporalmente',
                     hint:  'Por obras, reforma o pausa indefinida.' },
    },

    // Plantilla semanal
    weeklyOpensAt: 'Abre',
    weeklyClosesAt: 'Cierra',
    weeklyAddRange: 'Añadir otro tramo',
    weeklyRemoveRange: 'Quitar tramo',
    weeklyClosedCheckbox: 'Cerrado',
    weeklyCopyToWeekdays: 'Copiar a días laborables (L–V)',
    weeklyCopyToAll: 'Copiar a todos los días',

    // Plantilla temporada
    seasonalAddPeriod: 'Añadir temporada',
    seasonalRemovePeriod: 'Quitar temporada',
    seasonalPeriodNameLabel: 'Nombre',
    seasonalPeriodNamePlaceholder: 'Verano, Invierno, Semana Santa…',
    seasonalPeriodStart: 'Desde',
    seasonalPeriodEnd: 'Hasta',

    // Plantilla evento
    eventNameLabel: 'Nombre del evento (opcional)',
    eventNamePlaceholder: 'Festa do Albariño, Mercado medieval…',
    eventStart: 'Fecha y hora de inicio',
    eventEnd: 'Fecha y hora de fin',

    // Plantilla cita previa
    appointmentUsesContactPhone:
      'Se usará el teléfono que hayas puesto en el bloque "Cómo contactar".',
    appointmentNoPhone:
      'Añade un teléfono en el bloque "Cómo contactar" para que los visitantes puedan pedir cita.',

    // Plantilla sin horario
    externalUsesContactWeb:
      'Se usará la web que hayas puesto en el bloque "Cómo contactar".',
    externalNoWeb:
      'Añade un sitio web en el bloque "Cómo contactar" para que los visitantes puedan consultar horarios.',

    // Plantilla cerrado
    closedReopeningLabel: 'Fecha prevista de reapertura (opcional)',
    closedReasonLabel: 'Motivo (opcional)',
    closedReasonPlaceholder: 'Ej: Obras de rehabilitación',

    // Cierres temporales (ortogonales a la plantilla)
    closuresTitle: 'Cierres puntuales',
    closuresDesc:
      'Vacaciones, festivos especiales u otras excepciones al horario normal.',
    closuresAdd: 'Añadir un cierre temporal',
    closuresRemove: 'Quitar',
    closureStart: 'Desde',
    closureEnd: 'Hasta',
    closureReason: 'Motivo (visible al visitante)',
    closureReasonPlaceholder: 'Ej: Vacaciones de agosto',

    // Nota libre
    noteLabel: 'Nota adicional (opcional)',
    notePlaceholder: 'Ej: En temporada alta recomendamos reservar con antelación.',

    // Errores de validación (se pintan en el banner rojo)
    validation: {
      tryAgain: 'Revisa los horarios antes de continuar:',
    },
  },

  footer: {
    previous: '← Anterior',
    next: 'Siguiente →',
  },
} as const;
