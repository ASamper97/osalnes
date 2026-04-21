/**
 * PATCH · packages/shared/src/data/tag-catalog.ts
 *
 * Este fichero NO se copia directamente. Son instrucciones concretas para
 * ampliar el catálogo de tags existente, que Claude Code debe aplicar en
 * la tarea 3 del prompt maestro.
 *
 * Cambios:
 *
 *   1. Añadir 5 tags de accesibilidad al grupo existente "caracteristicas"
 *      (decisión 5-A del usuario).
 *   2. Renombrar el grupo "destacados" a "curaduria-editorial" para
 *      reflejar que no es una característica del recurso sino una
 *      decisión editorial del equipo CMS (decisión 3-B del usuario).
 *
 * El shape exacto de `tag-catalog.ts` varía según la implementación que
 * tenga Claude Code en el repo; adapta los campos si no coinciden 1:1
 * con los de este patch. Las claves de tag (`key`) y de grupo (`groupKey`)
 * son lo que debe coincidir.
 */

// ═══════════════════════════════════════════════════════════════════════
// 1. AÑADIR AL GRUPO "caracteristicas" (5 tags nuevos de accesibilidad)
// ═══════════════════════════════════════════════════════════════════════
//
// Añadir estos elementos al array `TAG_CATALOG` (o como se llame en tu
// implementación) con el `groupKey: 'caracteristicas'`. Ajusta campos
// según el shape real.

/* eslint-disable @typescript-eslint/no-unused-vars */
const ACCESIBILIDAD_TAGS_TO_ADD = [
  {
    key: 'caracteristicas.accesible-silla-ruedas',
    groupKey: 'caracteristicas',
    labelEs: 'Accesible en silla de ruedas',
    labelGl: 'Accesible en cadeira de rodas',
    description:
      'El recurso tiene al menos un acceso e itinerario interior practicable para personas con movilidad reducida.',
    // Mantén los mismos tipos de badge que el resto (no decisión 1-C: mantener como están)
    vocabularyKind: 'accessibility', // -> badge "accessibility" naranja
    exportsToPid: true,              // -> badge "PID" verde
  },
  {
    key: 'caracteristicas.aseo-adaptado',
    groupKey: 'caracteristicas',
    labelEs: 'Aseo adaptado',
    labelGl: 'Aseo adaptado',
    description:
      'Dispone al menos de un aseo accesible operativo para personas con discapacidad.',
    vocabularyKind: 'accessibility',
    exportsToPid: true,
  },
  {
    key: 'caracteristicas.aparcamiento-reservado',
    groupKey: 'caracteristicas',
    labelEs: 'Plaza de aparcamiento reservada',
    labelGl: 'Praza de aparcadoiro reservada',
    description:
      'Dispone de plaza de aparcamiento reservada para personas con discapacidad, conectada con un itinerario accesible al recurso.',
    vocabularyKind: 'accessibility',
    exportsToPid: true,
  },
  {
    key: 'caracteristicas.perro-guia-permitido',
    groupKey: 'caracteristicas',
    labelEs: 'Perros guía permitidos',
    labelGl: 'Cans guía permitidos',
    description:
      'Permite el acceso a perros guía acompañando a personas con discapacidad visual.',
    vocabularyKind: 'accessibility',
    exportsToPid: true,
  },
  {
    key: 'caracteristicas.bucle-magnetico',
    groupKey: 'caracteristicas',
    labelEs: 'Bucle magnético',
    labelGl: 'Bucle magnético',
    description:
      'Dispone de bucle magnético para personas con audífono o implante coclear (comunicación asistida).',
    vocabularyKind: 'accessibility',
    exportsToPid: true,
  },
];

// ═══════════════════════════════════════════════════════════════════════
// 2. RENOMBRAR GRUPO "destacados" → "curaduria-editorial"
// ═══════════════════════════════════════════════════════════════════════
//
// Buscar en el catálogo (o en el fichero que defina los grupos, como
// `TAG_GROUPS` o similar) el grupo con `key: 'destacados'`.
//
// Cambios:
//   - `key`        : 'destacados'          → 'curaduria-editorial'
//   - `labelEs`    : 'Destacados'          → 'Curaduría editorial'
//   - `labelGl'    : 'Destacados'          → 'Curadoría editorial'
//   - `description`: '...'                 → 'Decisiones del equipo CMS sobre
//                                             qué recursos promocionar. No es
//                                             una característica del recurso.'
//
// En cada TAG que use `groupKey: 'destacados'` (típicamente "destacado" y
// "muy valorado"), cambiar también `groupKey` a `'curaduria-editorial'`.
//
// En la BD, si hay datos existentes con esos tags, hacer UPDATE:
//   UPDATE resource_tags
//   SET tag_key = REPLACE(tag_key, 'destacados.', 'curaduria-editorial.')
//   WHERE tag_key LIKE 'destacados.%';
// (La migración 022 incluye este UPDATE idempotente.)

// ═══════════════════════════════════════════════════════════════════════
// 3. VERIFICACIÓN POST-PATCH
// ═══════════════════════════════════════════════════════════════════════
//
// Tras aplicar el patch:
//
//   pnpm --filter @osalnes/shared typecheck  # no debe fallar
//   pnpm --filter @osalnes/cms typecheck     # no debe fallar
//
// Y en el paso 4 de la UI debe aparecer:
//   - Grupo "Características" con 5 tags nuevos de accesibilidad al final
//   - Grupo "Curaduría editorial" (antes "Destacados") visualmente
//     separado con un subheading "Uso interno del equipo del CMS"
