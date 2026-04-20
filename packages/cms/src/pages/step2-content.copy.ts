/**
 * Copy del Paso 2 del wizard de recursos ("Contenido")
 *
 * PRINCIPIO: Lenguaje del funcionario público, sin tecnicismos.
 *
 *   - Siempre con acentos correctos (Descripción, Castellano, Gallego, Inglés...)
 *   - Nunca: "Tipología", "Slug", "touristType", "UNE 178503", "amenityFeature"
 *   - Nunca: palabras en inglés salvo términos ya adoptados (SEO, web, email)
 *   - Tono: directo, útil, pedagógico. Ni impersonal ni infantilizante.
 *   - Siempre explica qué pasa después (qué ve el visitante, qué hace la IA...)
 */

export const STEP2_COPY = {
  // Cabecera del paso
  header: {
    title: 'Describe el recurso',
    subtitle:
      'Esta descripción es lo primero que verán los visitantes en la web pública.',
  },

  // Bloque pedagógico "Qué pedimos aquí"
  helpBlock: {
    title: 'Qué pedimos aquí',
    intro: 'Una descripción entre 100 y 300 palabras que explique:',
    bullets: [
      'Qué es el recurso y qué lo hace especial.',
      'Información práctica que ayude al visitante: horarios, cómo llegar, qué llevar.',
      'En lenguaje natural, como si se lo contaras a un amigo que visita por primera vez.',
    ],
    galFlow:
      'La versión en gallego la genera la IA cuando termines el castellano, y después podrás revisarla.',
    toggleHide: 'Ocultar esta ayuda',
    toggleShow: '¿Cómo escribir una buena descripción?',
  },

  // Editor castellano
  editorEs: {
    label: 'Descripción en castellano',
    placeholder:
      'Describe el recurso: qué es, qué lo hace especial, qué puede encontrar el visitante...',
    aiStartTitle: '¿No sabes por dónde empezar?',
    aiStartButton: 'Escribir un primer borrador con IA',
    aiStartHint:
      'La IA usará el nombre y el tipo de recurso que elegiste en el paso anterior para redactar un borrador inicial. Tú lo revisas después.',
    aiImproveTitle: '¿Ya tienes texto y quieres mejorarlo?',
    aiImproveButton: 'Mejorar el texto actual con IA',
    aiImproveHint:
      'La IA reescribirá tu descripción para hacerla más atractiva, manteniendo los datos que aportas. Podrás aceptar o descartar el resultado.',
  },

  // Bloque de traducción
  translation: {
    title: 'Traducción al gallego',
    description:
      'Cuando termines el castellano, la IA traducirá la descripción al gallego. Es una primera versión: podrás editarla después, porque conoces mejor los matices locales.',
    button: 'Traducir al gallego',
    buttonRetranslate: 'Volver a traducir',
    buttonDisabledHint:
      'Escribe primero la descripción en castellano para poder traducirla.',
    autoOnNextTitle: 'Traducción automática al gallego',
    autoOnNextBody:
      'Si avanzas al siguiente paso sin pulsar "Traducir al gallego", la IA hará la traducción en segundo plano y te avisaremos cuando esté lista para revisar.',
    autoOnNextToast: {
      title: 'Traducción al gallego lista',
      body: 'Vuelve al paso 2 cuando quieras para revisarla. Puedes seguir trabajando mientras tanto.',
      reviewLink: 'Revisar ahora',
      dismissLabel: 'Cerrar',
    },
    autoInFlight: {
      badge: 'Traduciendo al gallego…',
      hint: 'Puedes seguir con el siguiente paso; te avisaremos cuando esté lista.',
    },
    autoFailed:
      'No se ha podido traducir automáticamente. Vuelve al paso 2 para intentarlo de nuevo.',
  },

  // Editor gallego
  editorGl: {
    label: 'Descripción en gallego',
    placeholderEmpty: 'La traducción aparecerá aquí cuando uses el botón de arriba.',
    placeholderAfterTranslation:
      'Revisa la traducción y ajusta lo que consideres necesario.',
    aiImproveTitle: '¿Quieres mejorar el gallego?',
    aiImproveButton: 'Mejorar el texto en gallego con IA',
    /** Línea descriptiva debajo del editor GL (en lugar del badge) */
    status: {
      empty: 'Aún sin traducción.',
      /** {n} se sustituye por el conteo de palabras */
      translated: 'Traducción de la descripción en castellano ({n} palabras). Revísala cuando quieras.',
      edited: 'Traducción editada por ti ({n} palabras).',
    },
  },

  // Indicador de calidad (palabras)
  wordCount: {
    states: {
      empty:    { label: 'Pendiente',   tone: 'neutral' as const },
      short:    { label: 'Breve',       tone: 'warning' as const },
      good:     { label: 'Recomendada', tone: 'success' as const },
      long:     { label: 'Extensa',     tone: 'warning' as const },
    },
    ranges: {
      minShort: 1,
      minGood: 100,
      maxGood: 300,
    },
    rangeHint: '100–300 palabras recomendadas',
  },

  aiErrors: {
    generic:
      'No se ha podido completar la operación con IA. Inténtalo de nuevo en unos segundos.',
    timeout:
      'La IA está tardando más de lo habitual. Puedes esperar o cerrar este aviso y seguir escribiendo manualmente.',
    noApiKey:
      'La IA no está configurada en este entorno. Avisa al administrador del CMS.',
  },

  aiPreview: {
    heading: 'Propuesta de la IA',
    disclaimer:
      'Este borrador lo ha escrito una IA. Revísalo antes de guardar: tú conoces mejor el recurso.',
    applyButton: 'Usar este texto',
    discardButton: 'Descartar',
    regenerateButton: 'Volver a generar',
  },

  footer: {
    previous: '← Anterior',
    next: 'Siguiente →',
    saveAndExit: 'Guardar y salir',
  },
} as const;

export function computeWordCountState(
  text: string,
): { count: number; stateKey: keyof typeof STEP2_COPY.wordCount.states } {
  const count = text.trim().split(/\s+/).filter(Boolean).length;
  const r = STEP2_COPY.wordCount.ranges;
  let stateKey: keyof typeof STEP2_COPY.wordCount.states;
  if (count === 0) stateKey = 'empty';
  else if (count < r.minGood) stateKey = 'short';
  else if (count <= r.maxGood) stateKey = 'good';
  else stateKey = 'long';
  return { count, stateKey };
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export type GlStatus = 'empty' | 'translated' | 'edited';

export function formatGlStatus(status: GlStatus, text: string): string {
  const n = countWords(text);
  const tmpl = STEP2_COPY.editorGl.status[status];
  return tmpl.replace('{n}', String(n));
}
