/**
 * Catálogo de plantillas del wizard ("¿Cómo quieres empezar?")
 *
 * Cada plantilla es un atajo que pre-rellena el wizard con:
 *   - Una tipología principal del catálogo UNE (clave `tipo-de-recurso.*`)
 *   - Un conjunto de etiquetas iniciales del catálogo real
 *   - Un conjunto de grupos del paso 4 que aparecen expandidos por defecto
 *
 * PRINCIPIO: las plantillas NO inventan tags nuevos. Cada `initialTagKeys`
 * debe ser una clave existente en `tag-catalog.ts`. Así el catálogo UNE
 * 178503 es la fuente de verdad única para tipologías y etiquetas.
 *
 * Si una plantilla necesita un tag que no existe en el catálogo, primero
 * se añade al catálogo (con su mapeo schema.org / PID correcto) y luego se
 * referencia aquí. Nunca al revés.
 */

import type { Tag } from './tag-catalog';
import { TAGS_BY_KEY } from './tag-catalog';

export interface ResourceTemplate {
  /** Clave estable (kebab-case) */
  key: string;
  /** Nombre visible en la tarjeta */
  label: string;
  /** Subtítulo / descripción corta */
  description: string;
  /** Emoji o icono que aparece en la tarjeta */
  icon: string;
  /** Tipología principal del catálogo UNE (clave `tipo-de-recurso.*`) */
  mainTagKey: string;
  /** Etiquetas pre-aplicadas al crear el recurso (claves del catálogo) */
  initialTagKeys: string[];
  /** Grupos del paso 4 expandidos por defecto */
  highlightedGroups: string[];
  /** Orden de aparición en la pantalla de selección */
  order: number;
  /** Si es la opción "empezar en blanco" — sin tipología preseleccionada */
  isBlank?: boolean;
}

export const RESOURCE_TEMPLATES: ResourceTemplate[] = [
  {
    key: 'hotel',
    label: 'Hotel',
    description: 'Establecimiento hotelero con habitaciones, servicios y reservas',
    icon: '🏨',
    mainTagKey: 'tipo-de-recurso.hotel',
    initialTagKeys: [],
    highlightedGroups: [
      'serv-alojamiento',
      'comodidades-hab',
      'instalaciones',
      'serv-huesped',
      'familiar',
    ],
    order: 1,
  },
  {
    key: 'casa-rural',
    label: 'Casa rural',
    description: 'Alojamiento rural, casa de aldea o turismo verde',
    icon: '🏡',
    mainTagKey: 'tipo-de-recurso.alojamiento-rural',
    initialTagKeys: ['entorno.entorno-rural'],
    highlightedGroups: [
      'serv-alojamiento',
      'comodidades-hab',
      'instalaciones',
      'entorno',
      'familiar',
    ],
    order: 2,
  },
  {
    key: 'playa',
    label: 'Playa',
    description: 'Playa, cala o zona de baño',
    icon: '🏖️',
    mainTagKey: 'tipo-de-recurso.playa',
    initialTagKeys: [
      'caracteristicas.al-aire-libre',
      'caracteristicas.todo-el-ano',
      'caracteristicas.gratuito',
    ],
    highlightedGroups: ['playas-extras', 'caracteristicas', 'publico'],
    order: 3,
  },
  {
    key: 'restaurante',
    label: 'Restaurante',
    description: 'Restaurante, marisquería, taberna o gastrobar',
    icon: '🍽️',
    mainTagKey: 'tipo-de-recurso.restaurante',
    initialTagKeys: [],
    highlightedGroups: ['gastronomia', 'caracteristicas', 'familiar'],
    order: 4,
  },
  {
    key: 'museo-patrimonio',
    label: 'Museo / Patrimonio',
    description: 'Museo, iglesia, pazo, monumento o edificio histórico',
    icon: '🏛️',
    mainTagKey: 'tipo-de-recurso.museo',
    initialTagKeys: ['experiencia.cultura'],
    highlightedGroups: ['caracteristicas', 'experiencia', 'publico'],
    order: 5,
  },
  {
    key: 'mirador',
    label: 'Mirador / Punto de interés',
    description: 'Mirador, faro, cruce panorámico o elemento natural destacado',
    icon: '🔭',
    mainTagKey: 'tipo-de-recurso.mirador',
    initialTagKeys: [
      'caracteristicas.al-aire-libre',
      'caracteristicas.gratuito',
      'experiencia.naturaleza',
    ],
    highlightedGroups: ['caracteristicas', 'experiencia', 'publico'],
    order: 6,
  },
  {
    key: 'evento-fiesta',
    label: 'Evento / Festa',
    description: 'Fiesta popular, festival, mercado o evento cultural',
    icon: '🎉',
    mainTagKey: 'tipo-de-recurso.fiesta-festival',
    initialTagKeys: ['experiencia.cultura'],
    highlightedGroups: ['fiestas-extras', 'experiencia', 'publico'],
    order: 7,
  },
  {
    key: 'bodega-albarino',
    label: 'Bodega Albariño',
    description: 'Bodega de vino DO Rías Baixas con visitas y catas',
    icon: '🍷',
    mainTagKey: 'tipo-de-recurso.bodega',
    initialTagKeys: ['experiencia.enoturismo', 'gastronomia.albarino'],
    highlightedGroups: ['gastronomia', 'experiencia', 'caracteristicas'],
    order: 8,
  },
  {
    key: 'ruta-sendero',
    label: 'Ruta / Sendero',
    description: 'Ruta de senderismo, ciclovía o itinerario natural',
    icon: '🥾',
    mainTagKey: 'tipo-de-recurso.ruta',
    initialTagKeys: [
      'caracteristicas.al-aire-libre',
      'caracteristicas.gratuito',
      'experiencia.naturaleza',
      'experiencia.turismo-activo',
    ],
    highlightedGroups: ['rutas-extras', 'experiencia', 'publico'],
    order: 9,
  },
  {
    key: 'blank',
    label: 'Empezar en blanco',
    description: 'Sin plantilla — elige la tipología y rellena los campos manualmente',
    icon: '📄',
    mainTagKey: '',
    initialTagKeys: [],
    highlightedGroups: [],
    order: 99,
    isBlank: true,
  },
];

// ─── Validación en tiempo de carga ───────────────────────────────────────
// Verifica que todas las claves referenciadas existen en el catálogo UNE.
// Falla ruidosamente en desarrollo si alguien añade un tag inventado.
{
  const g = globalThis as { process?: { env?: { NODE_ENV?: string } } };
  const isProd = g.process?.env?.NODE_ENV === 'production';
  if (!isProd) {
    for (const tpl of RESOURCE_TEMPLATES) {
      if (tpl.isBlank) continue;
      if (tpl.mainTagKey && !TAGS_BY_KEY[tpl.mainTagKey]) {
        // eslint-disable-next-line no-console
        console.error(
          `[resource-templates] Plantilla "${tpl.key}" tiene mainTagKey "${tpl.mainTagKey}" que no existe en tag-catalog.ts`,
        );
      }
      for (const k of tpl.initialTagKeys) {
        if (!TAGS_BY_KEY[k]) {
          // eslint-disable-next-line no-console
          console.error(
            `[resource-templates] Plantilla "${tpl.key}" referencia tag "${k}" que no existe en tag-catalog.ts`,
          );
        }
      }
    }
  }
}

export const RESOURCE_TEMPLATE_BY_KEY: Readonly<Record<string, ResourceTemplate>> = Object.freeze(
  RESOURCE_TEMPLATES.reduce<Record<string, ResourceTemplate>>((acc, t) => {
    acc[t.key] = t;
    return acc;
  }, {}),
);

/** Devuelve todas las etiquetas (Tag completos) de una plantilla */
export function resolveTemplateTags(templateKey: string): Tag[] {
  const tpl = RESOURCE_TEMPLATE_BY_KEY[templateKey];
  if (!tpl) return [];
  const keys = tpl.mainTagKey ? [tpl.mainTagKey, ...tpl.initialTagKeys] : tpl.initialTagKeys;
  return keys.map((k) => TAGS_BY_KEY[k]).filter((t): t is Tag => !!t);
}
