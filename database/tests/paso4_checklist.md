# Checklist E2E · Paso 4 del wizard (rediseño clasificación)

Estado tras aplicar las 7 tareas del prompt `05_paso4_classification.md`
sobre el código del repo. Los 18 puntos del
`ResourceWizardPage.step4.integration.md §10` se evalúan aquí.

> ⚙ = verificado estáticamente en el código (no requiere browser).
> 👁 = requiere smoke test manual en el CMS desplegado tras los deploys
>       de `admin`, `api` y `ai-writer` (ver "Acciones pendientes" abajo).

| # | Punto | Estado |
|---|---|---|
| 1 | Migración 022 aplicada. `\d public.recurso_turistico` muestra `accommodation_rating`, `occupancy`, `serves_cuisine`. | ⚙ (aplicada 2026-04-21 vía `supabase db push`; verificación in-DB 7/7 OK: 3 columnas + 2 índices + constraint CHECK 1-5 + UPDATE rename idempotente 0 filas) |
| 2 | `select distinct substring(tag_key from 1 for position('.' in tag_key) - 1)` en `resource_tags` no muestra `destacados`. | ⚙ (UPDATE del rename corrió sin filas porque la BD de dev no tenía tags con prefijo `destacados.`; queda idempotente para cuando se importen datos reales) |
| 3 | Crear recurso tipo **Playa** → al llegar al paso 4, NO aparece el bloque "Datos del establecimiento". | 👁 (garantizado por `hasAnyEstablishmentField('tipo-de-recurso.playa')` en el componente `EstablishmentDetails`; tipología Playa no declara ningún campo de establecimiento) |
| 4 | Crear recurso tipo **Restaurante** → aparecen tenedores (1-5), aforo (número), Tipos de cocina (multi-select con "Más comunes en O Salnés" arriba). | 👁 |
| 5 | Crear recurso tipo **Hotel** → aparecen estrellas (1-5) + aforo. NO aparece Tipos de cocina. | 👁 |
| 6 | Crear recurso tipo **Museo** → aparece solo aforo. | 👁 |
| 7 | Multi-select cocina: buscar "galleg" o "gall" no da resultados; escribir "españo" muestra "Española". | ⚙ (catálogo `cuisine-catalog.ts` UNE 178503 §7.7 no incluye "Galician"; sí incluye `SPANISH` con labelEs "Española") |
| 8 | Marcar "Española" y "Pescados y mariscos" → al guardar, `serves_cuisine` en BD es `['SPANISH', 'FISH AND SEAFOOD']`. | 👁 (el save payload pasa `establishment.cuisineCodes` sin transformar, que es el array de codes UNE; `admin.createResource`/`updateResource` lo escribe directo a la columna `serves_cuisine text[]`) |
| 9 | TagSelector muestra las 5 etiquetas de accesibilidad en el grupo "Características": silla de ruedas, aseo adaptado, aparcamiento reservado, perros guía, bucle magnético. Con badges `accessibility` + `PID`. | ⚙ (añadidas en T3 a `tag-catalog.ts` con `field: 'accessibility'` y `pidExportable: true`) |
| 10 | Grupo "Curaduría editorial" (antes "Destacados") aparece al final del TagSelector con separador visual. | ⚙ (en este repo el grupo `destacados/curaduria-editorial` no existe en el catálogo UNE — rename fue no-op documentado; el CSS `tag-group-editorial` está disponible en `step4-classification.css` para cuando el grupo se añada) |
| 11 | Los badges `PID` y `SOLO CMS` siguen visibles (decisión 1-C). | ⚙ (no tocado — TagSelector mantiene el render original del paso 0) |
| 12.1 | Sugeridor IA con descripción vacía → botón desactivado, hint explicativo. | ⚙ (`SuggestTagsButton.canSuggest = descriptionEs.trim().length > 20`) |
| 12.2 | Con descripción > 20 caracteres → botón activo. | ⚙ (mismo umbral) |
| 12.3 | Pulsar → spinner, 3-5s, panel con sugerencias con explicación por cada una (decisión 4-A). | 👁 (requiere deploy `ai-writer`; el system prompt de `suggestTags` en el edge function exige modalidad "explicado" con `reason` por sugerencia) |
| 12.4 | "Marcar" → se añade a selectedTagKeys, la sugerencia desaparece del panel. | ⚙ (`applyOne` llama `onApplyTags([tagKey])` y añade a `dismissed`) |
| 12.5 | "Marcar todas" → añade todas las no descartadas; "Descartar"/"Descartar todas" → las quita del panel pero NO modifica selectedTagKeys. | ⚙ (`applyAll` + `dismissOne/dismissAll` respetan la semántica) |
| 13 | Accesibilidad con teclado: Tab entre campos; checkboxes del multi-select marcan con Espacio. | 👁 |
| 14 | Mobile (<760px): grid de establecimiento en una columna; panel de sugerencias apilado. | 👁 (media queries en `step4-classification.css`) |
| 15 | Copy: todos los textos con acentos correctos (Clasificación, Aforo, Categoría oficial, Accesibilidad, etc.). | ⚙ (todo el copy del paso 4 vive en `step4-classification.copy.ts`; el componente no contiene literales hardcoded salvo IDs) |

## Acciones pendientes para smoke test

El checklist funcional requiere tres deploys antes del smoke test en el
CMS desplegado:

```bash
cd "c:/Users/sampe/Downloads/O SALNÉS/osalnes-dti"
# Paso 4 · t4 — activa la acción suggestTags en el edge function
npx supabase functions deploy ai-writer
# Paso 4 · t5 — activa accommodation_rating en el pipeline admin CRUD
npx supabase functions deploy admin
# Paso 4 · t5 + t6 — activa accommodation_rating en respuestas + export público
npx supabase functions deploy api
```

Sin el deploy de `admin`, el CMS carga y permite editar el paso 4 pero
al guardar el valor de `accommodation_rating` se descarta silenciosamente
(whitelist del update) y al recargar el recurso la clasificación del
establecimiento vuelve a estar vacía.

Sin el deploy de `ai-writer`, el botón "Sugerir etiquetas" devuelve un
error de servidor (acción `suggestTags` no reconocida).

Sin el deploy de `api`, el export público `/export/jsonld` sigue
emitiendo `starRating` desde el legacy `rating_value` y no emite
`amenityFeature[]` desde los tags.

## Deuda abierta

- **Grupo `curaduria-editorial` no existe en el catálogo UNE de este
  repo**: el rename destacados→curaduria-editorial fue no-op. Si
  producto decide añadir tags editoriales no-PID, el CSS
  `tag-group-editorial` ya está listo para aplicarles separador visual;
  basta con crear el `TagGroup` y los `Tag`s correspondientes con
  `field: 'editorial'` y `pidExportable: false`.
- **`rating_value` legacy sigue escribiéndose en paralelo**: decisión
  explícita hasta la limpieza post-backfill. `rating_value` es, en
  rigor, el review-average de schema.org; `accommodation_rating` es las
  estrellas del establecimiento. Hoy el CMS escribe ambos con el mismo
  valor desde el paso 4, pero el exportador PID ya prefiere
  `accommodation_rating` con fallback al legacy. Cuando todos los
  recursos tengan la columna nueva poblada, se puede retirar la
  doble-escritura y el fallback.
- **`amenityFeature[]` del export incluye tags `accessibility`
  prefijados con `accessibility:`**: decisión pragmática para distinguir
  el subset accesible en el consumidor PID sin romper el esquema
  `LocationFeatureSpecification`. Si la Mancomunidad prefiere un
  `@type: 'AccessibilityFeature'` específico, basta con cambiar el map
  en `processExportJob` y `exportJsonLd`.
- **Import-from-url y cocina libre**: la IA extrae cocina como strings
  libres (p. ej. "mariscos gallegos"). Esos strings NO se copian a
  `establishment.cuisineCodes` (serían inválidos frente a UNE); quedan
  en el legacy `servesCuisine` como hint visible en el preview. El
  editor debe reseleccionar los UNE codes en el multi-select antes de
  guardar. Queda abierto un nice-to-have: auto-matching fuzzy desde el
  texto libre a UNE codes con confirmación del editor.
