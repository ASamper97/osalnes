# Checklist E2E · Paso 8 · Relaciones entre recursos (UNE 178503)

Estado tras aplicar las 6 tareas del prompt `14_paso8_relaciones.md`.
Cumple el requisito del pliego 5.1.1 último bullet ("Relación entre
recursos, permitiendo la creación de estructuras jerárquicas o
vinculadas") y prepara la exportación al PID alineada con UNE 178503.

> ⚙ = verificado estáticamente en el código / BD.
> 👁 = requiere smoke test manual en el CMS desplegado.

## Migración 029 (BD)

Aplicada y verificada 2026-04-22 contra el proyecto O salnés (`oduglbxjcmmdexwplzvw`).

| # | Artefacto | Estado |
|---|---|---|
| 1 | Enum `public.relation_predicate` con 7 valores (is_part_of, contains, related_to, includes, near_by, same_category, follows). | ⚙ |
| 2 | Tabla `public.resource_relations` con FKs a `recurso_turistico`, RLS `resource_relations_rw`, índices source/target. | ⚙ |
| 3 | Trigger `trg_resource_relations_mirror`: crea automáticamente la relación inversa (is_part_of ↔ contains, related_to/near_by/same_category simétricos, includes → is_part_of, follows sin inverso). | ⚙ |
| 4 | Trigger `trg_resource_relations_mirror_delete`: elimina el mirror al borrar la original. | ⚙ |
| 5 | Trigger `trg_resource_relations_cycle_check`: detecta ciclos SOLO en jerárquicas (is_part_of / contains / includes) vía WITH RECURSIVE, rechaza con EXCEPTION. | ⚙ |
| 6 | Función `create_relation(source, target, predicate, note)` → uuid. | ⚙ |
| 7 | Función `delete_relation(relation_id)`. | ⚙ |
| 8 | Función `list_relations_for_resource(resource_id)` devuelve filas con is_mirror, nombre/tipología/municipio vía tr_get() (paso 6 · t5). | ⚙ |
| 9 | Función `search_resources_for_relation(query, exclude_id, type_filter, municipality_filter, status_filter, limit)`. | ⚙ |
| 10 | Función `generate_jsonld_relations(resource_id)` → jsonb con URIs `https://turismo.osalnes.gal/es/recurso/{slug}`. **Verificada en vivo:** devolvió `{"isRelatedTo":[{"@id":"https://turismo.osalnes.gal/es/recurso/torre-de-san-sadurnino","name":"Torre de San Sadurnino","@type":"Thing"}]}`. | ⚙👁 |

**Hotfix aplicado:** `generate_jsonld_relations` original usaba
`jsonb_object_agg(..., jsonb_agg(...))` — error 42803 "aggregate function
calls cannot be nested". Fixed con CTE en dos capas (`grouped` agrega por
predicado, `select` final objeto final). Commit `74cd98d`.

## Shared · modelo de predicados

| # | Punto | Estado |
|---|---|---|
| 11 | `packages/shared/src/data/resource-relations.ts` exporta los 7 predicados con descripción, icono, categoría (jerárquico/semántico), reverso, mapping a Schema.org. | ⚙ |
| 12 | Export `./data/resource-relations` registrado en `packages/shared/package.json` (añadido en paso8 · t2). | ⚙ |
| 13 | `mapRpcRelation` y `mapRpcSearchResult` convierten el shape RPC (snake_case) al tipo `ResourceRelation` (camelCase). | ⚙ |
| 14 | Función `detectSemanticWarning(sourceType, targetType, predicate)` devuelve mensaje castellano en combinaciones raras (ej. "Hotel is_part_of Restaurante"). | ⚙ |

## Wizard global · ampliación 7 → 8 pasos (paso8 · t2)

| # | Punto | Estado |
|---|---|---|
| 15 | `WIZARD_STEPS` en wizard-navigation.ts contiene 8 entradas con 'relations' en el número 7. | ⚙ |
| 16 | `TOTAL_STEPS = 8`. | ⚙ (derivado de `WIZARD_STEPS.length`) |
| 17 | `WizardStepNumber` = 1..8 (nuevo type exportado). | ⚙ |
| 18 | `WizardStepKey` incluye `'relations'` entre `'seo'` y `'review'`. | ⚙ |
| 19 | `computeProgressPercent(7)` → 88% (redondeo de 7/8). | ⚙ |
| 20 | `computeProgressPercent(8)` → 100%. | ⚙ |
| 21 | El stepper superior muestra 8 botones con icono 🔗 en Relaciones. | 👁 |

## ResourceWizardPage · conexión paso 7 Relaciones (paso8 · t3)

| # | Punto | Estado |
|---|---|---|
| 22 | Imports de `ResourceWizardStep8Relations`, `useRelations`, `step8-relations.css`. | ⚙ |
| 23 | Hook `useRelations({ supabase, resourceId: savedId })` al nivel del componente. Cast a `SupabaseLike` porque supabase-js devuelve `PostgrestFilterBuilder` (thenable). | ⚙ |
| 24 | Array `steps` legacy contiene una entrada "Relaciones" entre "SEO e idiomas" y "Revision" — el Wizard legacy (usado solo como motor de navegación por fallback, oculto vía `hideDefaultStepper`) también tiene 8 pasos coherentes. | ⚙ |
| 25 | `{currentStep === 6 && <ResourceWizardStep8Relations ...>}` — nuevo paso 7 (0-indexed 6). Props: state, resourceId, sourceType=mainTypeKey, typologies, municipalities, onOpenResource, onFetchJsonldPreview. | ⚙ |
| 26 | `onFetchJsonldPreview` llama a `supabase.rpc('generate_jsonld_relations', { p_resource_id: savedId })` y devuelve `data` (o `null` si aún no hay savedId). | ⚙ |
| 27 | Revisión desplazada a `{currentStep === 7 && ...}`. `onPrevious` regresa a step 6 (Relaciones), antes 5. | ⚙ |
| 28 | Sin `resourceId` guardado → banner amarillo en el paso Relaciones, formulario deshabilitado. | 👁 (contrato del componente) |

## Flujo funcional (smoke test manual)

| # | Punto | Estado |
|---|---|---|
| 29 | Crear recurso nuevo → abrir paso 7 antes de guardar → banner "Guarda el recurso antes de crear relaciones". | 👁 |
| 30 | Tras autosave del paso 1 → el banner desaparece y se habilitan predicado + autocomplete + nota. | 👁 |
| 31 | Elegir predicado "Forma parte de" → dropdown muestra icono 📂 + descripción. | 👁 |
| 32 | Autocomplete: teclear "playa" → aparecen ≤15 sugerencias con nombre + tipología + municipio. Debounce 250ms. | 👁 |
| 33 | El recurso actual NUNCA aparece en resultados (auto-exclusión en `search_resources_for_relation`). | ⚙ (param `p_exclude_id = resourceId` en el hook) |
| 34 | "Buscar más…" → abre `AdvancedRelationSearchModal` con filtros tipología/municipio/estado. | 👁 |
| 35 | Añadir nota + pulsar "Añadir relación" → aparece en `RelationsList` agrupada por predicado. | 👁 |

## Bidireccionalidad automática (3-A)

| # | Punto | Estado |
|---|---|---|
| 36 | Crear A `is_part_of` B → en el recurso B aparece automáticamente "Contiene: A" marcada `(automática)`. | ⚙ (trigger `fn_resource_relations_mirror`) + 👁 |
| 37 | Las filas `is_mirror = true` no tienen × de borrado (el componente filtra). | ⚙ (prop de RelationsList) |
| 38 | Borrar la relación original → el trigger de delete elimina también el mirror. | ⚙ (trigger `fn_resource_relations_mirror_delete`) + 👁 |
| 39 | `related_to`, `near_by`, `same_category` son simétricos: el mirror usa el mismo predicado. | ⚙ (CASE en trigger) |
| 40 | `includes` crea mirror con `is_part_of`; `follows` no crea mirror (stream temporal). | ⚙ |

## Validación de ciclos (7-C)

| # | Punto | Estado |
|---|---|---|
| 41 | Crear A `is_part_of` B, intentar B `is_part_of` A → error "No se puede crear una relación jerárquica circular". | ⚙ (trigger cycle_check) + 👁 |
| 42 | Crear A `is_part_of` B, B `is_part_of` C, intentar C `is_part_of` A → también error (ciclo indirecto detectado vía WITH RECURSIVE). | ⚙ + 👁 |
| 43 | Crear A `related_to` B, después B `related_to` A → permitido (no es jerárquico). | ⚙ + 👁 |

## Warnings semánticos (6-C)

| # | Punto | Estado |
|---|---|---|
| 44 | Crear "Hotel `is_part_of` Restaurante" → warning amarillo "Es poco común…" antes de guardar. | ⚙ (detectSemanticWarning) + 👁 |
| 45 | Botón "Cambiar" → cierra warning, permite elegir otro predicado. | 👁 |
| 46 | Botón "Continuar de todas formas" → guarda la relación igual (warning no bloqueante). | 👁 |

## JSON-LD preview (5-C)

| # | Punto | Estado |
|---|---|---|
| 47 | Con ≥1 relación → botón "Ver JSON-LD" habilitado. | 👁 |
| 48 | Al abrirlo → bloque con `isPartOf`, `isRelatedTo`, `containsPlace`, etc. | ⚙ (mapping en generate_jsonld_relations) + 👁 |
| 49 | URIs con `https://turismo.osalnes.gal/es/recurso/{slug}` (dominio productivo del paso 6 · t5). | ⚙ |
| 50 | El JSON devuelto es válido (parseable por `JSON.parse`). | ⚙👁 (verificado en SQL con output real) |

## Stepper global (cumple pliego 5.1.1)

| # | Punto | Estado |
|---|---|---|
| 51 | El stepper superior muestra 8 pasos, Relaciones = 7 con icono 🔗, etiqueta "Relaciones", badge "opcional". | ⚙👁 |
| 52 | Paso 7 → porcentaje 88%. | ⚙ |
| 53 | Paso 8 → porcentaje 100%. | ⚙ |
| 54 | `canNavigateToStep(7, ctx)` requiere step1+step2+resourceId (mismo gating que pasos 3-6). | ⚙ (lógica genérica 3-N en wizard-navigation.ts) |

## Acciones pendientes antes del smoke test

Ninguna bloqueante. La migración 029 está aplicada y verificada.

## Deuda abierta

- **T4 opcional no aplicada** (resumen relaciones en la card de
  Revisión): el `ResourceWizardStep7Review` no tiene hoy un `StepCard`
  que muestre `N relación(es) con otros recursos` con botón "Editar" →
  `setCurrentStep(6)`. Bajo impacto: el stepper global ya permite saltar
  al paso 7 Relaciones con un clic, así que la info está a 2 clics del
  paso 8. Si se pide en revisión, añadir una tarjeta derivada de
  `relationsState.relations.length`.
- **URIs JSON-LD apuntan a dominio productivo** (`turismo.osalnes.gal`):
  si en el futuro se despliega un subdominio distinto para el portal
  público, ajustar el literal en `generate_jsonld_relations` (línea del
  `@id`). La migración 025 ya usó ese dominio; consistente con resto
  del repo.
- **`ResourceWizardStep8Relations` tolera resourceId null**: el componente
  muestra banner amarillo con instrucciones, pero no bloquea el flujo
  del wizard (el usuario puede saltar al paso 8 Revisión y publicar sin
  definir relaciones — son opcionales por contrato del pliego).
- **`generate_jsonld_relations` es informativo hasta SCR-13**: hoy
  devuelve JSON correcto pero nadie lo consume. El Centro de
  exportaciones (SCR-13, pendiente) lo inyectará en el payload del PID.
- **Cast `SupabaseLike` en ResourceWizardPage.tsx**: `supabase.rpc()`
  devuelve `PostgrestFilterBuilder` (thenable) en runtime pero TS no lo
  reconoce como `Promise`. El cast `supabase as unknown as
  Parameters<typeof useRelations>[0]['supabase']` es pragmático;
  eliminable si se reescribe `useRelations.ts` para aceptar
  `PromiseLike<...>` en lugar de `Promise<...>`.
- **Export `./data/resource-relations` del shared**: se añadió en paso8 · t2
  al package.json. Sin él, el tsc de cms fallaba con TS2307 en 6
  ficheros del paso 8 (PredicatePicker, TargetAutocomplete,
  RelationsList, AdvancedRelationSearchModal, useRelations,
  ResourceWizardStep8Relations). Checked.
- **Errores TS2345 preexistentes en `DocumentUploader.tsx` y
  `RelationsManager.tsx`**: son tipos viejos de `Document`/`Relation`
  del paso multimedia/relations legacy. No están en la ruta del paso 8
  actual ni se renderizan en el wizard rediseñado — deuda independiente.
