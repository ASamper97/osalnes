/**
 * Catálogo de tipologías de recurso O Salnés
 * 
 * Conecta las tipologías del xlsx original (31 valores de la columna `Tipo`)
 * con las 18 etiquetas `tipo-de-recurso.*` del catálogo UNE 178503, e indica:
 *   - qué grupos del wizard deben aparecer para cada tipo
 *   - qué etiquetas auto-aplicar al importar
 *   - si la correspondencia es exacta o requiere revisión editorial
 * 
 * PRINCIPIO: este fichero NO extiende el catálogo UNE; para tipos sin match
 * exacto usa el más próximo + reviewRequired=true.
 */

import type { Tag, TagGroup } from './tag-catalog.js';

export interface ResourceTypeDefinition {
  /** Etiqueta en la columna `Tipo` del xlsx original */
  xlsxLabel: string;
  /** Nº de recursos con este tipo en el xlsx de entrada */
  xlsxCount: number;
  /** Clave de tag-catalog al que mapea (grupo tipo-de-recurso). `null` si no hay match y requiere revisión manual. */
  catalogTagKey: string | null;
  /** `true` si el match no es exacto — el wizard debe mostrar un aviso al editor */
  reviewRequired: boolean;
  /** Claves de grupo del catálogo que aparecen en el paso 4 del wizard para este tipo */
  wizardGroups: string[];
  /** Etiquetas auto-aplicadas al importar (además de la del tipo principal) */
  autoTags: string[];
  /** Notas editoriales sobre el mapping */
  notes?: string;
}

export const RESOURCE_TYPES: ResourceTypeDefinition[] = [
  {
    xlsxLabel: "Playa",
    xlsxCount: 45,
    catalogTagKey: "tipo-de-recurso.playa",
    reviewRequired: false,
    wizardGroups: ["caracteristicas", "experiencia", "publico", "playas-extras", "rating", "municipio"],
    autoTags: [],
  },
  {
    xlsxLabel: "Mirador",
    xlsxCount: 23,
    catalogTagKey: "tipo-de-recurso.mirador",
    reviewRequired: false,
    wizardGroups: ["caracteristicas", "experiencia", "publico", "rating", "municipio"],
    autoTags: [],
  },
  {
    xlsxLabel: "Museo",
    xlsxCount: 14,
    catalogTagKey: "tipo-de-recurso.museo",
    reviewRequired: false,
    wizardGroups: ["caracteristicas", "experiencia", "publico", "rating", "municipio"],
    autoTags: ["experiencia.cultura"],
  },
  {
    xlsxLabel: "Arq. religiosa",
    xlsxCount: 14,
    catalogTagKey: "tipo-de-recurso.iglesia-capilla",
    reviewRequired: false,
    wizardGroups: ["caracteristicas", "experiencia", "publico", "rating", "municipio"],
    autoTags: ["experiencia.cultura"],
    notes: "Iglesias, capillas, ermitas y conventos (PlaceOfWorship)",
  },
  {
    xlsxLabel: "Pazo / Arq. civil",
    xlsxCount: 19,
    catalogTagKey: "tipo-de-recurso.pazo-arq-civil",
    reviewRequired: false,
    wizardGroups: ["caracteristicas", "experiencia", "publico", "rating", "municipio"],
    autoTags: ["experiencia.cultura"],
  },
  {
    xlsxLabel: "Yacimiento / Ruina",
    xlsxCount: 6,
    catalogTagKey: "tipo-de-recurso.yacimiento-ruina",
    reviewRequired: false,
    wizardGroups: ["caracteristicas", "experiencia", "publico", "rating", "municipio"],
    autoTags: ["experiencia.cultura"],
  },
  {
    xlsxLabel: "Ruta de molinos",
    xlsxCount: 13,
    catalogTagKey: "tipo-de-recurso.molino",
    reviewRequired: false,
    wizardGroups: ["caracteristicas", "experiencia", "publico", "rating", "municipio"],
    autoTags: ["experiencia.cultura", "experiencia.rural"],
  },
  {
    xlsxLabel: "Puerto / Lonja",
    xlsxCount: 11,
    catalogTagKey: "tipo-de-recurso.puerto-lonja",
    reviewRequired: false,
    wizardGroups: ["caracteristicas", "experiencia", "publico", "rating", "municipio"],
    autoTags: [],
    notes: "Separar FishingPort vs YachtingPort al exportar",
  },
  {
    xlsxLabel: "Espacio singular",
    xlsxCount: 11,
    catalogTagKey: "tipo-de-recurso.espacio-natural",
    reviewRequired: true,
    wizardGroups: ["caracteristicas", "experiencia", "publico", "rating", "municipio"],
    autoTags: ["experiencia.naturaleza"],
    notes: "Revisar: NaturePark (protegido) vs Park (urbano) vs TouristAttraction",
  },
  {
    xlsxLabel: "Paseo marítimo",
    xlsxCount: 9,
    catalogTagKey: "tipo-de-recurso.paseo-maritimo",
    reviewRequired: false,
    wizardGroups: ["caracteristicas", "experiencia", "publico", "rating", "municipio"],
    autoTags: [],
    notes: "Mapea a TouristAttraction (*) — verificar norma",
  },
  {
    xlsxLabel: "Ruta senderismo",
    xlsxCount: 20,
    catalogTagKey: "tipo-de-recurso.ruta",
    reviewRequired: false,
    wizardGroups: ["caracteristicas", "experiencia", "publico", "rutas-extras", "rating", "municipio", "camino-de-santiago"],
    autoTags: ["experiencia.naturaleza"],
    notes: "Mapea a Trail (senderismo)",
  },
  {
    xlsxLabel: "Trail / Ruta",
    xlsxCount: 13,
    catalogTagKey: "tipo-de-recurso.ruta",
    reviewRequired: true,
    wizardGroups: ["caracteristicas", "experiencia", "publico", "rutas-extras", "rating", "municipio"],
    autoTags: [],
    notes: "Revisar: Trail (senderismo) vs TrailMTB (BTT) vs TouristTrip (ruta turística)",
  },
  {
    xlsxLabel: "Bodega",
    xlsxCount: 37,
    catalogTagKey: "tipo-de-recurso.bodega",
    reviewRequired: false,
    wizardGroups: ["caracteristicas", "experiencia", "publico", "gastronomia", "rating", "municipio"],
    autoTags: ["experiencia.enoturismo"],
  },
  {
    xlsxLabel: "Restaurante",
    xlsxCount: 218,
    catalogTagKey: "tipo-de-recurso.restaurante",
    reviewRequired: false,
    wizardGroups: ["caracteristicas", "gastronomia", "familiar", "rating", "municipio"],
    autoTags: [],
  },
  {
    xlsxLabel: "Hotel",
    xlsxCount: 176,
    catalogTagKey: "tipo-de-recurso.hotel",
    reviewRequired: false,
    wizardGroups: ["caracteristicas", "serv-alojamiento", "comodidades-hab", "instalaciones", "serv-huesped", "entorno", "familiar", "alojam-extras", "rating", "municipio"],
    autoTags: [],
  },
  {
    xlsxLabel: "Pensión",
    xlsxCount: 35,
    catalogTagKey: "tipo-de-recurso.hotel",
    reviewRequired: true,
    wizardGroups: ["caracteristicas", "serv-alojamiento", "comodidades-hab", "instalaciones", "serv-huesped", "entorno", "familiar", "alojam-extras", "rating", "municipio"],
    autoTags: [],
    notes: "Revisar: ¿Hotel (pequeño) o GuestHouse (alojamiento-rural)?",
  },
  {
    xlsxLabel: "Hostal",
    xlsxCount: 24,
    catalogTagKey: "tipo-de-recurso.hotel",
    reviewRequired: true,
    wizardGroups: ["caracteristicas", "serv-alojamiento", "comodidades-hab", "instalaciones", "serv-huesped", "entorno", "familiar", "alojam-extras", "rating", "municipio"],
    autoTags: [],
    notes: "Revisar: ¿Hotel o GuestHouse?",
  },
  {
    xlsxLabel: "Parador",
    xlsxCount: 1,
    catalogTagKey: "tipo-de-recurso.hotel",
    reviewRequired: false,
    wizardGroups: ["caracteristicas", "serv-alojamiento", "comodidades-hab", "instalaciones", "serv-huesped", "entorno", "familiar", "alojam-extras", "rating", "municipio"],
    autoTags: ["alojam-extras.edificio-historico", "rating.destacado"],
    notes: "Parador Nacional → Hotel + edificio histórico + destacado",
  },
  {
    xlsxLabel: "Casa rural",
    xlsxCount: 20,
    catalogTagKey: "tipo-de-recurso.alojamiento-rural",
    reviewRequired: false,
    wizardGroups: ["caracteristicas", "serv-alojamiento", "comodidades-hab", "instalaciones", "serv-huesped", "entorno", "familiar", "alojam-extras", "rating", "municipio"],
    autoTags: ["entorno.entorno-rural"],
  },
  {
    xlsxLabel: "Apartamento",
    xlsxCount: 26,
    catalogTagKey: "tipo-de-recurso.alojamiento-rural",
    reviewRequired: true,
    wizardGroups: ["caracteristicas", "serv-alojamiento", "comodidades-hab", "instalaciones", "serv-huesped", "entorno", "familiar", "alojam-extras", "rating", "municipio"],
    autoTags: [],
    notes: "Revisar: mapping UNE 178503 no define \"Apartment\" explícito. Considerar extender catálogo si >20 unidades en producción",
  },
  {
    xlsxLabel: "Camping",
    xlsxCount: 29,
    catalogTagKey: "tipo-de-recurso.camping",
    reviewRequired: false,
    wizardGroups: ["caracteristicas", "serv-alojamiento", "instalaciones", "serv-huesped", "entorno", "familiar", "alojam-extras", "rating", "municipio"],
    autoTags: [],
  },
  {
    xlsxLabel: "Fiesta / Festival",
    xlsxCount: 52,
    catalogTagKey: "tipo-de-recurso.fiesta-festival",
    reviewRequired: false,
    wizardGroups: ["caracteristicas", "experiencia", "publico", "fiestas-extras", "rating", "municipio"],
    autoTags: ["experiencia.cultura"],
  },
  {
    xlsxLabel: "Actividad náutica",
    xlsxCount: 21,
    catalogTagKey: "tipo-de-recurso.paseo-maritimo",
    reviewRequired: true,
    wizardGroups: ["caracteristicas", "experiencia", "publico", "rating", "municipio"],
    autoTags: ["experiencia.nautica"],
    notes: "Mapping UNE 178503 no tiene type específico — usa TouristAttraction. Considerar extender catálogo.",
  },
  {
    xlsxLabel: "Turismo activo",
    xlsxCount: 18,
    catalogTagKey: "tipo-de-recurso.paseo-maritimo",
    reviewRequired: true,
    wizardGroups: ["caracteristicas", "experiencia", "publico", "rating", "municipio"],
    autoTags: ["experiencia.aventura"],
    notes: "TouristAttraction genérico — valorar ampliar catálogo con experiencia-turistica",
  },
  {
    xlsxLabel: "Golf",
    xlsxCount: 2,
    catalogTagKey: "tipo-de-recurso.paseo-maritimo",
    reviewRequired: true,
    wizardGroups: ["caracteristicas", "experiencia", "publico", "rating", "municipio"],
    autoTags: [],
    notes: "TouristAttraction genérico",
  },
  {
    xlsxLabel: "Casino",
    xlsxCount: 1,
    catalogTagKey: "tipo-de-recurso.paseo-maritimo",
    reviewRequired: true,
    wizardGroups: ["caracteristicas", "experiencia", "publico", "rating", "municipio"],
    autoTags: [],
    notes: "TouristAttraction genérico",
  },
  {
    xlsxLabel: "Termalismo / SPA",
    xlsxCount: 10,
    catalogTagKey: "tipo-de-recurso.paseo-maritimo",
    reviewRequired: true,
    wizardGroups: ["caracteristicas", "experiencia", "publico", "rating", "municipio"],
    autoTags: [],
    notes: "TouristAttraction genérico — valorar type específico HealthSpa",
  },
  {
    xlsxLabel: "Tren turístico",
    xlsxCount: 4,
    catalogTagKey: "tipo-de-recurso.paseo-maritimo",
    reviewRequired: true,
    wizardGroups: ["caracteristicas", "experiencia", "publico", "rating", "municipio"],
    autoTags: [],
    notes: "TouristAttraction genérico",
  },
  {
    xlsxLabel: "Visita guiada",
    xlsxCount: 4,
    catalogTagKey: "tipo-de-recurso.paseo-maritimo",
    reviewRequired: true,
    wizardGroups: ["caracteristicas", "experiencia", "publico", "rating", "municipio"],
    autoTags: [],
    notes: "TouristAttraction genérico — considerar TouristTrip",
  },
  {
    xlsxLabel: "Leyenda",
    xlsxCount: 35,
    catalogTagKey: "tipo-de-recurso.leyenda",
    reviewRequired: false,
    wizardGroups: ["caracteristicas", "municipio"],
    autoTags: [],
    notes: "Solo CMS (no exporta a PID)",
  },
  {
    xlsxLabel: "Otro",
    xlsxCount: 240,
    catalogTagKey: null,
    reviewRequired: true,
    wizardGroups: ["caracteristicas", "municipio"],
    autoTags: [],
    notes: "REQUIERE REVISIÓN MANUAL — 240 recursos sin tipo claro en el xlsx",
  },
];

export const RESOURCE_TYPE_BY_XLSX_LABEL: Readonly<Record<string, ResourceTypeDefinition>> = Object.freeze(
  RESOURCE_TYPES.reduce<Record<string, ResourceTypeDefinition>>((acc, t) => {
    acc[t.xlsxLabel] = t;
    return acc;
  }, {}),
);

/**
 * Devuelve los grupos del wizard a mostrar para una tipología, en orden canónico.
 * Si el tipo no se encuentra, devuelve los grupos mínimos (características + municipio).
 */
export function getWizardGroupsForType(xlsxLabel: string | null | undefined): string[] {
  if (!xlsxLabel) return ['caracteristicas', 'municipio'];
  const def = RESOURCE_TYPE_BY_XLSX_LABEL[xlsxLabel];
  return def?.wizardGroups ?? ['caracteristicas', 'municipio'];
}
