# Prompt maestro · Rediseño Paso 4 "Clasificación"

**Pega este contenido en Claude Code.**

Ejecuta el rediseño del paso 4 del wizard de recursos. Este prompt se
ejecuta **después** de los pasos 0, 2 y 3.

---

## Contexto del cambio

El paso 4 actual ("Clasificación") tiene tres problemas:

1. **El bloque "Clasificación del establecimiento" (estrellas, aforo,
   cocina) se muestra siempre**, aunque la tipología no lo necesite
   (playas, miradores, rutas…).

2. **El "Tipo de cocina" es un textarea libre** que no se puede exportar
   al PID — UNE 178503 §7.7 exige un vocabulario controlado (SPANISH,
   FISH AND SEAFOOD, TAPAS, etc.).

3. **Faltan tags de accesibilidad** que el pliego exige (WCAG 2.1 AA +
   indicadores PNE 178502 puntos 34, 40-42, 81-91).

## Solución

- **Visibilidad condicional**: el bloque de establecimiento aparece/
  desaparece según la tipología del paso 1.
- **Multi-select de cocina** con catálogo UNE 178503 oficial, ordenado
  por relevancia en O Salnés.
- **5 nuevas etiquetas de accesibilidad** en el grupo "Características":
  silla de ruedas, aseo adaptado, aparcamiento reservado, perros guía,
  bucle magnético.
- **Rename "Destacados" → "Curaduría editorial"** con separador visual
  (es una decisión editorial, no una característica del recurso).
- **Sugeridor IA de etiquetas** con explicación por cada propuesta
  (nueva acción `suggestTags` en Edge Function ai-writer).
- **Badges PID / SOLO CMS** se mantienen tal como están (decisión
  usuario 1-C).

## Ficheros ya escritos y colocados en el repo

```
osalnes-dti/
├── database/migrations/
│   ├── 022_establishment_and_editorial_rename.sql
│   └── 022_establishment_and_editorial_rename.down.sql
│
├── packages/shared/src/data/
│   ├── cuisine-catalog.ts                 ← 31 tipos UNE con relevancia
│   ├── establishment-fields.ts            ← visibility por tipología
│   └── tag-catalog.patch.ts               ← instrucciones patch
│
├── packages/cms/src/
│   ├── components/
│   │   ├── CuisineSelector.tsx            ← multi-select UNE
│   │   ├── EstablishmentDetails.tsx       ← bloque condicional
│   │   └── SuggestTagsButton.tsx          ← sugeridor IA + panel
│   ├── lib/
│   │   └── ai.suggestTags.patch.ts        ← instrucciones patch
│   └── pages/
│       ├── ResourceWizardStep4Classification.tsx  ← orquestador
│       ├── step4-classification.copy.ts
│       ├── step4-classification.css
│       └── ResourceWizardPage.step4.integration.md (doc)
│
├── supabase/functions/ai-writer/
│   └── index.suggestTags-action.patch.ts  ← instrucciones patch
│
└── prompts/
    └── 05_paso4_classification.md         ← este fichero
```

---

## Tareas en orden

### Tarea 1 · Aplicar migración 022

```bash
npx supabase db push
```

Verificar con:
```sql
\d public.resources
-- Debe mostrar accommodation_rating, occupancy, serves_cuisine
```

Además, comprobar que el rename de tags ha funcionado:
```sql
select distinct substring(tag_key from 1 for position('.' in tag_key) - 1) as grupo
from public.resource_tags;
-- No debe aparecer "destacados"; sí "curaduria-editorial" (si había datos)
```

**Criterio de aceptación**: las 3 columnas nuevas existen y no hay filas
con tag_key que empiece por `destacados.`.

### Tarea 2 · Aplicar patch al cliente AI

Abrir `packages/cms/src/lib/ai.ts` y añadir al final el contenido
descrito en `packages/cms/src/lib/ai.suggestTags.patch.ts`:

- Interfaces `AiTagSuggestion` y `AiSuggestTagsInput`.
- Función `aiSuggestTags`.

Verificar con:
```bash
pnpm --filter @osalnes/cms typecheck
```

**Criterio**: `import { aiSuggestTags } from '../lib/ai'` compila.

### Tarea 3 · Aplicar patch al catálogo de tags

Abrir `packages/shared/src/data/tag-catalog.ts` y seguir las 2
instrucciones descritas en `tag-catalog.patch.ts`:

1. Añadir 5 tags nuevos al grupo `caracteristicas` (accesibilidad).
2. Renombrar grupo `destacados` → `curaduria-editorial` (incluyendo el
   `groupKey` de los tags que lo usaban).

**Criterio**: typecheck pasa, y en la UI del paso 4 aparece el grupo
"Curaduría editorial" con separador visual.

### Tarea 4 · Aplicar patch al Edge Function

Abrir `supabase/functions/ai-writer/index.ts` y añadir la acción
`suggestTags` según `index.suggestTags-action.patch.ts`:

1. Añadir `'suggestTags'` al tipo `Action`.
2. Añadir `buildSuggestTagsPrompt` (+ helper `humanizeTypeKey` si no
   existe aún desde el paso 2).
3. Añadir el case `'suggestTags'` en el switch del handler.
4. Temperatura: `0.3` (baja para precisión).
5. Decisión sobre carga del catálogo de tags: opción A (duplicar
   array) para empezar; migrar a opción B (tabla Supabase) si el catálogo
   crece mucho.

Desplegar: `npx supabase functions deploy ai-writer`

Test manual:
```bash
curl -X POST "$SUPABASE_URL/functions/v1/ai-writer" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action":"suggestTags",
    "descriptionEs":"Mirador emblemático con vistas a la Ría de Arousa. Acceso accesible con rampa para sillas de ruedas y aseos adaptados.",
    "mainTypeKey":"tipo-de-recurso.mirador",
    "municipio":"Sanxenxo",
    "existingTagKeys":[]
  }'
```

Debe devolver `{ "suggestions": [...] }` con al menos una sugerencia de
accesibilidad (silla-ruedas, aseo-adaptado) y la explicación.

### Tarea 5 · Integrar paso 4 en `ResourceWizardPage.tsx`

Sigue la guía paso a paso en
`packages/cms/src/pages/ResourceWizardPage.step4.integration.md`
(secciones 3-8).

Resumen:

1. **Imports** nuevos.
2. **Estado `establishment`** con hidratación desde BD.
3. **Render** del paso 4 con `<ResourceWizardStep4Classification>`.
4. **Guardado** en BD con los nuevos campos.
5. **Borrar el código legacy** del paso 4 en `ResourceWizardPage.tsx`.
6. **Ajustar TagSelector** con className `tag-group-editorial` en el
   grupo `curaduria-editorial`.

### Tarea 6 · Exportación a PID

Localizar el exportador y añadir el mapeo descrito en la sección 9 del
integration.md:

- `accommodation_rating` → `accommodationRating`
- `occupancy` → `occupancy`
- `serves_cuisine` → `servesCuisine` (array de strings)
- Tags con prefijo `caracteristicas.*` → `amenityFeature[]`
- Tags con prefijo `curaduria-editorial.*` → **NO exportar**

**No bloqueante** — si la función exportadora aún no mapea estos campos,
el CMS sigue funcionando.

### Tarea 7 · Test E2E del flujo completo

Ejecutar el checklist de aceptación del integration.md (18 puntos).
Documentar en el commit cualquier punto que no pase.

---

## Lo que NO tocar

- Pasos 1, 2, 3, 5, 6, 7 — cada uno tiene su propio prompt.
- Columnas legacy (ej. `tipo_cocina_texto` si existe) — limpieza
  posterior en migración aparte.
- El TagSelector salvo el mínimo necesario para `tag-group-editorial`.

## Mensajes de commit sugeridos

```
feat(db): migración 022 establishment + curaduria-editorial (paso 4 · t1)
feat(cms): aiSuggestTags en cliente ai.ts (paso 4 · t2)
feat(shared): +5 tags accesibilidad · rename destacados → curaduria-editorial (paso 4 · t3)
feat(edge): ai-writer.suggestTags — sugeridor IA de tags explicado (paso 4 · t4)
feat(cms): rediseño paso 4 con visibilidad condicional y sugeridor IA (paso 4 · t5)
chore(pid): mapeo accommodation_rating + occupancy + servesCuisine (paso 4 · t6, opcional)
docs: checklist E2E paso 4 (paso 4 · t7)
```
