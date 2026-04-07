/**
 * Resource Templates — Plantillas pre-configuradas por tipologia
 *
 * Cada plantilla define defaults inteligentes y tips contextuales para
 * reducir friccion al crear un recurso turistico nuevo.
 */

export interface ResourceTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  /** rdfType from UNE 178503 */
  rdfType: string;
  /** Smart defaults pre-applied when template is selected */
  defaults: {
    isAccessibleForFree?: boolean;
    publicAccess?: boolean;
    visibleOnMap?: boolean;
    touristTypes?: string[];
    descEsExample?: string;
    seoTitleHint?: string;
  };
  /** Contextual tips shown in the wizard */
  tips: {
    name?: string;
    description?: string;
    photos?: string;
    contact?: string;
    extra?: string;
  };
  /** Highlights for the template card */
  highlights: string[];
}

export const RESOURCE_TEMPLATES: ResourceTemplate[] = [
  {
    id: 'hotel',
    name: 'Hotel',
    icon: '🏨',
    description: 'Establecimiento hotelero con habitaciones, servicios y reservas',
    rdfType: 'Hotel',
    defaults: {
      isAccessibleForFree: false,
      publicAccess: true,
      visibleOnMap: true,
      touristTypes: ['BUSINESS TOURISM', 'ROMANTIC TOURISM', 'FAMILY TOURISM'],
      descEsExample: 'Hotel de [X] estrellas situado en [ubicacion]. Ofrece [numero] habitaciones equipadas con [servicios]. Sus instalaciones incluyen [restaurante/spa/piscina/parking]. A [X] minutos de [punto de interes].',
      seoTitleHint: 'Hotel [Nombre] [estrellas]★ — [Municipio], O Salnes',
    },
    tips: {
      name: 'Usa el nombre comercial oficial del hotel',
      description: 'Menciona estrellas, ubicacion, numero de habitaciones, servicios destacados (spa, restaurante, vistas) y proximidad a puntos de interes',
      photos: 'Sube minimo 5 fotos: fachada, recepcion, habitacion tipo, baño, servicios comunes',
      contact: 'Telefono y web son obligatorios. Anade email y horario de recepcion 24h si aplica',
      extra: 'No olvides marcar la clasificacion (estrellas) en el paso 4',
    },
    highlights: ['Estrellas 1-5', 'Servicios completos', 'Reservas online'],
  },

  {
    id: 'casa-rural',
    name: 'Casa rural',
    icon: '🏡',
    description: 'Alojamiento rural, casa de aldea o turismo verde',
    rdfType: 'RuralHouse',
    defaults: {
      isAccessibleForFree: false,
      publicAccess: true,
      visibleOnMap: true,
      touristTypes: ['RURAL TOURISM', 'NATURE TOURISM', 'FAMILY TOURISM', 'ECOTOURISM'],
      descEsExample: 'Casa rural ubicada en [aldea/parroquia], rodeada de [paisaje]. Cuenta con [numero] habitaciones y [comedor/cocina/jardin]. Ideal para escapadas en [familia/pareja/grupo]. Punto de partida para [actividades en la zona].',
      seoTitleHint: 'Casa Rural [Nombre] — [Municipio] | O Salnes',
    },
    tips: {
      name: 'Suele incluir "Casa", "Pazo", "Quinta" o el nombre del lugar',
      description: 'Destaca la atmosfera rural, vistas, materiales tradicionales, jardin, zonas comunes y actividades cercanas (senderismo, gastronomia local)',
      photos: 'Las fotos del exterior y del entorno natural son clave. No olvides el interior de las habitaciones',
      extra: 'Marca tipos de turismo "rural" y "naturaleza" en el paso 4',
    },
    highlights: ['Turismo rural', 'Naturaleza', 'Tradicion gallega'],
  },

  {
    id: 'playa',
    name: 'Playa',
    icon: '🏖️',
    description: 'Playa, calo o zona de baño',
    rdfType: 'Beach',
    defaults: {
      isAccessibleForFree: true,
      publicAccess: true,
      visibleOnMap: true,
      touristTypes: ['BEACH AND SUN TOURISM', 'FAMILY TOURISM', 'NATURE TOURISM'],
      descEsExample: 'Playa de [arena/cantos] de [longitud] situada en [ubicacion]. De aguas [tranquilas/abiertas], cuenta con [bandera azul/socorrismo/duchas/aparcamiento]. Ideal para [bañarse/surf/familias/pasear]. Acceso [a pie/en coche] desde [referencia].',
      seoTitleHint: 'Playa de [Nombre] — [Municipio], Rias Baixas',
    },
    tips: {
      name: 'Usa el nombre oficial gallego (Praia de...)',
      description: 'Indica longitud, tipo de arena, condiciones del mar, servicios disponibles (socorrismo, banderas, accesibilidad) y publico recomendado',
      photos: 'Foto general desde un extremo o panoramica. Si tiene bandera azul, destacala',
      contact: 'Las playas no suelen tener telefono ni web — dejalos vacios',
      extra: 'No marques aforo a menos que sea una playa pequeña con limite oficial',
    },
    highlights: ['Acceso libre', 'Mapa visible', 'Coordenadas GPS'],
  },

  {
    id: 'restaurante',
    name: 'Restaurante',
    icon: '🍽️',
    description: 'Restaurante, marisqueria, taberna o gastrobar',
    rdfType: 'Restaurant',
    defaults: {
      isAccessibleForFree: false,
      publicAccess: true,
      visibleOnMap: true,
      touristTypes: ['FOOD TOURISM', 'WINE TOURISM', 'CULTURAL TOURISM'],
      descEsExample: 'Restaurante especializado en [tipo de cocina] situado en [ubicacion]. Ofrece [especialidades] elaborados con [productos locales]. Cuenta con [numero] plazas distribuidas en [salas/terraza]. Reservas recomendadas [siempre/fines de semana].',
      seoTitleHint: 'Restaurante [Nombre] — Cocina [tipo] | [Municipio]',
    },
    tips: {
      name: 'Nombre comercial del restaurante',
      description: 'Tipo de cocina, especialidades, ambiente (familiar/romantico/informal), productos destacados, reservas',
      photos: 'Fachada o entrada, vista de la sala, 2-3 platos estrella',
      contact: 'Telefono OBLIGATORIO para reservas. Web/redes si tienen menu online',
      extra: 'Rellena el campo "Tipo de cocina" en el paso 4 (gallega, mariscos, tapas...)',
    },
    highlights: ['Tipo de cocina', 'Reservas', 'Aforo'],
  },

  {
    id: 'museo',
    name: 'Museo / Patrimonio',
    icon: '🏛️',
    description: 'Museo, iglesia, pazo, monumento o edificio historico',
    rdfType: 'Museum',
    defaults: {
      isAccessibleForFree: false,
      publicAccess: true,
      visibleOnMap: true,
      touristTypes: ['CULTURAL TOURISM', 'HERITAGE TOURISM', 'FAMILY TOURISM'],
      descEsExample: 'Museo dedicado a [tematica] ubicado en [edificio historico]. Su coleccion incluye [tipos de piezas] de los siglos [periodo]. Destaca [obra/sala/elemento principal]. Visitas guiadas disponibles [horarios]. [Tarifa] o entrada gratuita.',
      seoTitleHint: '[Nombre del Museo] — [Municipio], Galicia',
    },
    tips: {
      name: 'Nombre oficial del museo o monumento',
      description: 'Origen historico, coleccion, periodos, piezas destacadas, tipos de visita (libres/guiadas), tarifas',
      photos: 'Fachada, salas principales, piezas mas representativas. Cuidado con fotos prohibidas en interiores',
      contact: 'Telefono y email para reservas de visitas guiadas. Horario es ESENCIAL',
      extra: 'Si hay tarifas, ponlas en la descripcion. Marca acceso gratuito solo si lo es',
    },
    highlights: ['Horario obligatorio', 'Cultura', 'Patrimonio'],
  },

  {
    id: 'mirador',
    name: 'Mirador / Punto de interes',
    icon: '🔭',
    description: 'Mirador, faro, cruce panoramico o elemento natural destacado',
    rdfType: 'Landform',
    defaults: {
      isAccessibleForFree: true,
      publicAccess: true,
      visibleOnMap: true,
      touristTypes: ['NATURE TOURISM', 'ECOTOURISM', 'CULTURAL TOURISM'],
      descEsExample: 'Mirador situado en [altitud/ubicacion] con vistas a [paisaje]. Desde aqui se puede contemplar [elementos visibles: ria, islas, montañas]. Acceso [a pie/en coche] desde [referencia]. [Mejor momento del dia] para visitarlo.',
      seoTitleHint: 'Mirador de [Nombre] — Vistas [Municipio], O Salnes',
    },
    tips: {
      name: 'Usa el nombre oficial gallego si lo tiene (Miradoiro de...)',
      description: 'Altitud, vistas, panorama (que se ve), accesibilidad, mejor momento del dia, dificultad de acceso',
      photos: 'Una panoramica desde el mirador es OBLIGATORIA. Anade alguna de la senda de acceso',
      contact: 'Los miradores no tienen telefono ni horario — dejalos vacios',
      extra: 'Las coordenadas GPS son lo MAS importante para que la gente pueda llegar',
    },
    highlights: ['Solo coordenadas', 'Acceso libre', 'Naturaleza'],
  },

  {
    id: 'evento',
    name: 'Evento / Festa',
    icon: '🎉',
    description: 'Festa popular, festival, mercado o evento cultural',
    rdfType: 'Festival',
    defaults: {
      isAccessibleForFree: true,
      publicAccess: true,
      visibleOnMap: true,
      touristTypes: ['EVENTS AND FESTIVALS TOURISM', 'CULTURAL TOURISM', 'FOOD TOURISM'],
      descEsExample: '[Festa/Festival] que se celebra anualmente en [fecha aproximada] en [lugar]. Incluye [actividades: musica, gastronomia, procesion, mercado]. [Producto destacado: marisco, vino, pulpo]. Origen [historico] y reconocimiento [Festa de Interes Turistico].',
      seoTitleHint: '[Nombre de la Festa] [año] — [Municipio] | O Salnes',
    },
    tips: {
      name: 'Nombre oficial de la festa (Festa do Marisco, Festa do Albariño...)',
      description: 'Fecha o periodo, programa de actividades, productos destacados, origen historico, reconocimientos oficiales',
      photos: 'Foto del cartel del año actual, foto de ediciones anteriores con publico/ambiente',
      contact: 'Telefono del concello/organizador, web oficial de la festa si existe',
      extra: 'IMPORTANTE: actualiza fechas y programa cada año en el paso 6 (SEO)',
    },
    highlights: ['Fechas anuales', 'Cultura local', 'Reconocimientos'],
  },

  {
    id: 'bodega',
    name: 'Bodega Albariño',
    icon: '🍷',
    description: 'Bodega de vino DO Rias Baixas con visitas y catas',
    rdfType: 'Winery',
    defaults: {
      isAccessibleForFree: false,
      publicAccess: true,
      visibleOnMap: true,
      touristTypes: ['WINE TOURISM', 'FOOD TOURISM', 'CULTURAL TOURISM', 'RURAL TOURISM'],
      descEsExample: 'Bodega DO Rias Baixas ubicada en [parroquia/concello]. Produce [variedades] elaborados con uva [Albariño]. Visitas guiadas [horarios] que incluyen [recorrido por viñedos/sala de elaboracion/cata]. Reservas previas [obligatorias/recomendadas].',
      seoTitleHint: 'Bodega [Nombre] — Albariño DO Rias Baixas | [Municipio]',
    },
    tips: {
      name: 'Nombre comercial de la bodega (Adega/Bodega...)',
      description: 'Pertenencia a DO Rias Baixas, variedades, tipo de viñedo, recorrido de visita, catas, productos a la venta',
      photos: 'Viñedos, sala de elaboracion/barricas, sala de cata. Si elabora vinos premiados, foto de las botellas',
      contact: 'Telefono y email para reservas son OBLIGATORIOS. Horario de visitas',
      extra: 'Marca turismo "wine" y "food". Si tienen experiencias enoturisticas, mencionalas',
    },
    highlights: ['DO Rias Baixas', 'Visitas guiadas', 'Enoturismo'],
  },

  {
    id: 'sendero',
    name: 'Ruta / Sendero',
    icon: '🥾',
    description: 'Ruta de senderismo, ciclovia o itinerario natural',
    rdfType: 'Trail',
    defaults: {
      isAccessibleForFree: true,
      publicAccess: true,
      visibleOnMap: true,
      touristTypes: ['TREKKING TOURISM', 'NATURE TOURISM', 'ECOTOURISM', 'ADVENTURE TOURISM'],
      descEsExample: 'Ruta de [longitud] km y dificultad [baja/media/alta] que recorre [zonas atravesadas]. Punto de inicio: [lugar]. Duracion estimada: [horas]. Atraviesa [bosques/costa/monte] con vistas a [puntos destacados]. Senalizacion [tipo].',
      seoTitleHint: 'Ruta [Nombre] — Senderismo en [Municipio] | O Salnes',
    },
    tips: {
      name: 'Nombre oficial de la ruta o sendero (PR-G..., Camiño de...)',
      description: 'Longitud, dificultad, duracion, desnivel, tipo de superficie, puntos destacados, senalizacion, equipamiento recomendado',
      photos: 'Mapa o panel inicial de la ruta, vistas representativas, puntos destacados del recorrido',
      extra: 'Las coordenadas son del PUNTO DE INICIO. Anade waypoints en la descripcion si hay puntos clave',
    },
    highlights: ['Aventura', 'Naturaleza', 'Sin contacto'],
  },

  {
    id: 'blank',
    name: 'Empezar en blanco',
    icon: '📄',
    description: 'Sin plantilla — rellena todos los campos manualmente',
    rdfType: 'TouristAttraction',
    defaults: {
      visibleOnMap: true,
    },
    tips: {},
    highlights: ['Maxima flexibilidad'],
  },
];

export function getTemplateById(id: string): ResourceTemplate | undefined {
  return RESOURCE_TEMPLATES.find((t) => t.id === id);
}
