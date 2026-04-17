# Prompt maestro · Guía Burros v2 · catálogo UNE 178503

**Pega este fichero (o su contenido) en Claude Code** para que ejecute el
cambio completo sobre el repo `osalnes-dti`.

---

## Contexto del cambio

El wizard de recursos ("Guía Burros") tiene hoy un paso 4 "Clasificación"
con un desplegable plano de "tipos turismo UNE 178503". Esto es
insuficiente: el vocabulario real de la UNE 178503 define **154 etiquetas
× 18 grupos semánticos × 7 campos PID** (`type`, `touristType`,
`amenityFeature`, `accessibility`, `addressLocality`, `cuisine`,
`editorial`). Este cambio sustituye ese paso por un **selector contextual**
basado en el catálogo oficial, añade una **tarjeta de completitud
semántica PID** al paso 7 y crea la **tabla pivote `resource_tags`** que
alimentará el exportador PID y el import masivo del xlsx (siguiente
iteración).

## Ficheros ya escritos y colocados en el repo

Todos con `tsc --strict` limpio y convenciones del proyecto (banners en
migraciones, numeración secuencial, alias `@osalnes/*`).

```
osalnes-dti/
├── database/migrations/
│   ├── 018_resource_tags.sql              ← up: tabla + vista + RLS + función
│   └── 018_resource_tags.down.sql         ← down: rollback completo
│
├── packages/shared/src/data/
│   ├── tag-catalog.ts                     ← 154 tags × 18 grupos (SSOT)
│   └── resource-type-catalog.ts           ← 31 tipologías xlsx → catálogo
│
└── packages/cms/src/
    ├── components/
    │   ├── TagSelector.tsx                ← selector contextual (paso 4)
    │   ├── tag-selector.css
    │   ├── PidCompletenessCard.tsx        ← tarjeta (paso 7)
    │   └── pid-completeness-card.css
    └── pages/
        └── ResourceWizardPage.integration.tsx   ← snippets de referencia
                                                  (NO commitear tal cual)
```

---

## Tareas que debes ejecutar (en orden)

### Tarea 1 · Verificar catálogos en `@osalnes/shared`

1. Los ficheros `tag-catalog.ts` y `resource-type-catalog.ts` ya están en
   `packages/shared/src/data/`.
2. Abre `packages/shared/src/index.ts` (o el barrel que el paquete use como
   `main`/`exports`) y añade:
   ```ts
   export * from './data/tag-catalog';
   export * from './data/resource-type-catalog';
   ```
3. Si el paquete usa `exports` en `package.json` con subpath explícitos
   (`./data/*`), añade la entrada correspondiente. Si no, el re-export
   desde el index es suficiente.
4. Reconstruye el paquete (`pnpm --filter @osalnes/shared build` o el
   comando del proyecto).

**Criterio:** desde `packages/cms/src/*`, esto compila:
```ts
import { TAGS, TAG_GROUPS, RESOURCE_TYPES } from '@osalnes/shared';
```

**Nota sobre los imports en los componentes:** `TagSelector.tsx` y
`PidCompletenessCard.tsx` importan con subpath
`@osalnes/shared/data/tag-catalog`. Si el paquete no expone subpaths,
**cámbialos a `@osalnes/shared`** (import desde el barrel). Es un
find-and-replace de 4 líneas en los 2 ficheros. Verifica esto antes de
continuar.

### Tarea 2 · Aplicar migración 018

1. Inspecciona `018_resource_tags.sql` y `018_resource_tags.down.sql` en
   `database/migrations/`.
2. Ejecuta el runner de migraciones del proyecto (mira en
   `package.json` → `scripts` por algo tipo `db:migrate`, o si se usa
   Supabase CLI: `npx supabase db push`).
3. Verifica en la base de datos:
   - Tabla `public.resource_tags` existe con PK compuesta.
   - Enum `public.tag_field` con 8 valores.
   - Vista `public.v_resource_pid_tags`.
   - Función `public.resource_pid_completeness(uuid)`.
   - RLS habilitada con dos policies.
   - `resources` tiene 4 columnas nuevas: `xlsx_tipo_original`,
     `review_required`, `imported_from`, `imported_at`.

**Criterio:** `select count(*) from resource_tags;` devuelve 0 sin error.

### Tarea 3 · Regla sobre CSS

El proyecto ya tiene CSS global en `packages/cms/src/styles.css` (el wizard
original metió +440 líneas ahí). Elige una estrategia consistente con lo
que ya usan el resto de componentes:

- **Si el proyecto usa `import './styles.css'` por componente** (revisa si
  otros .tsx como `AiWritingAssistant.tsx` hacen import de CSS): añade al
  principio de `TagSelector.tsx` y `PidCompletenessCard.tsx`:
  ```ts
  import './tag-selector.css';
  import './pid-completeness-card.css';
  ```
- **Si el proyecto concatena todo en `styles.css`:** abre
  `packages/cms/src/styles.css`, pega el contenido de `tag-selector.css`
  y `pid-completeness-card.css` al final, y borra los dos ficheros .css.

**Criterio:** `pnpm --filter @osalnes/cms typecheck` y
`pnpm --filter @osalnes/cms build` sin errores.

### Tarea 4 · Integrar `TagSelector` en el paso 4 del ResourceWizard

Abre `packages/cms/src/pages/ResourceWizardPage.tsx` y aplica los snippets
de `ResourceWizardPage.integration.tsx` (secciones 1–3):

1. Imports nuevos (sección 1).
2. Estado `tagKeys` con hidratación desde `initialResource?.tags` + efecto
   de limpieza cuando cambia la tipología (sección 2).
3. **Borra** el bloque actual del paso 4 con el select múltiple de "tipos
   turismo UNE 178503" + desplegable "categorías portal".
4. **Sustitúyelo** por el `<WizardFieldGroup>` con `<TagSelector>`
   (sección 3).
5. Ajusta la validación del paso 4: pasa a ser un paso opcional. El aviso
   de completitud se da en el paso 7.

**Criterio funcional:**
- Crear un recurso nuevo de tipo "Hotel" → en el paso 4 aparecen 10
  grupos aplicables (características, serv-alojamiento, comodidades-hab,
  instalaciones, serv-huesped, entorno, familiar, alojam-extras, rating,
  municipio).
- Cambiar el tipo a "Playa" → aparecen 6 grupos (características,
  experiencia, publico, playas-extras, rating, municipio) y las tags
  previamente marcadas de "serv-alojamiento" se limpian solas.
- Buscar "wifi" → filtra las dos entradas (serv-alojamiento.wifi y
  comodidades-hab.wifi) con badges distintos.

### Tarea 5 · Añadir `PidCompletenessCard` al paso 7

En el mismo fichero (`ResourceWizardPage.tsx`):

1. En el grid de CompletionCards del paso 7, añade `<PidCompletenessCard>`
   como primera tarjeta, antes de las 6 tarjetas existentes (sección 4 de
   integration.tsx).
2. Pasa como `onEdit` la función de navegación del `Wizard` al paso 4
   (averigua la API concreta de `Wizard.tsx`: `goToStep(4)` /
   `setCurrentStep(3)` / etc.).

**Criterio funcional:**
- Hotel sin etiquetas → estado "Incompleto" rojo con `type` y `municipio`
  marcados como obligatorio.
- Hotel con `tipo-de-recurso.hotel` + `municipio.sanxenxo` + 3 amenities
  → estado "Mejorable" amarillo.
- >5 etiquetas exportables PID → estado "Listo para PID" verde.

### Tarea 6 · Persistir y cargar tags

1. En el loader inicial del wizard (donde hoy se hace `select * from
   resources`), extiende el select:
   ```ts
   .select(`*, tags:resource_tags(tag_key, field, value, pid_exportable)`)
   ```
2. Crea el helper `packages/cms/src/lib/resource-tags.ts` con:
   ```ts
   export async function saveResourceTags(
     supabase: SupabaseClient,
     resourceId: string,
     keys: string[],
   ) { /* delete-all + insert · ver integration.tsx sección 5 */ }
   ```
3. En el `handleSubmit` del wizard, después del upsert de `resources`,
   invoca `saveResourceTags(supabase, saved.id, tagKeys)`.

**Criterio funcional:**
- Crear recurso con 5 tags → `select count(*) from resource_tags where
  resource_id = X` devuelve 5.
- Editar, quitar 2, añadir 3, guardar → count devuelve 6.
- Reload de la página de edición → los 6 checkboxes vuelven a aparecer
  marcados.

### Tarea 7 · Formulario clásico (opcional)

`ResourceFormPage.tsx` (ruta `/resources/:id/classic`) es fallback del
wizard. Decide:

- **Si se va a mantener:** añade un `<details>` plegable al final con
  `<TagSelector>` + misma lógica de guardado.
- **Si se va a deprecar:** deja un `// TODO legacy — sin TagSelector`
  comentado donde iría.

### Tarea 8 · Actualizar acción `categorize` de `ai-writer`

1. En `supabase/functions/ai-writer/index.ts`, acción `categorize`:
   - Añade `resource_type: string` al input.
   - Importa (o duplica en la función, si el runtime Edge no soporta
     `@osalnes/shared`) el catálogo de tags + el mapping tipo→grupos.
   - Filtra el catálogo al subconjunto aplicable a ese tipo antes de
     pasárselo al modelo (reduce alucinaciones).
   - Cambia el output a `{ "suggested_keys": string[] }` con claves del
     catálogo.
2. En `packages/cms/src/lib/ai.ts`, actualiza `aiCategorize` para devolver
   `{ suggested_keys: string[] }`.
3. En `AiQualityScore.tsx`, el botón "Aplicar tipos sugeridos" ahora hace:
   ```ts
   setTagKeys(current =>
     Array.from(new Set([...current, ...suggested_keys]))
   );
   ```
   (Requiere que `AiQualityScore` reciba `setTagKeys` por props desde el
   wizard.)

**Criterio funcional:** un Hotel con descripción "hotel familiar con
piscina climatizada y parking en Sanxenxo" debe devolver al menos:
`familiar.familias`, `instalaciones.piscina-climatizada`,
`serv-alojamiento.aparcamiento`, `municipio.sanxenxo`. Verifica con
`TAGS_BY_KEY[k] !== undefined` para cada clave devuelta.

### Tarea 9 · Test de aceptación end-to-end

Crea un recurso ficticio `test-hotel-integracion` con al menos 6 tags y
comprueba la vista de export:

```sql
select field, tag_key, value
from public.v_resource_pid_tags
where resource_slug = 'test-hotel-integracion'
order by field, tag_key;
```

**Debe devolver** al menos una fila con `field='type'` + `value='Hotel'`,
y una con `field='addressLocality'` + `value='"Sanxenxo"'`.

---

## Lo que NO tocar

- Paso 1 del wizard (selector de tipología) — cambio aparte cuando se
  haga el import del xlsx.
- `PageWizardPage.tsx` (páginas editoriales) — sin cambios.
- El exportador PID actual — solo dejamos el dato bien guardado. El
  exportador consumirá la nueva vista en su propia tarea.
- Columnas legacy de tipos/categorías en `resources` — seguir
  escribiéndolas en paralelo hasta que el dato se haya migrado. Marcar
  los sitios con `// TODO legacy`.

## Deuda conocida (para la próxima iteración, import del xlsx)

- 240 recursos xlsx con tipo `"Otro"` → revisión manual al importar.
- 8 tipologías xlsx (`Apartamento`, `Actividad náutica`, `Turismo activo`,
  `Golf`, `Casino`, `Termalismo / SPA`, `Tren turístico`, `Visita guiada`)
  mapean con `reviewRequired=true` al no existir `type` específico en la
  UNE. Decisión del comité técnico: ¿extender catálogo local con
  `apartamento-turistico` y `experiencia-turistica`?

---

## Mensajes de commit sugeridos

```
feat(cms): catálogo UNE 178503 y tipologías xlsx (tarea 1)
feat(db): migración 018 · resource_tags + vista PID (tarea 2)
feat(cms): TagSelector + PidCompletenessCard (tareas 3-5)
feat(cms): persistencia de tags en wizard (tarea 6)
feat(ai): categorize usa catálogo filtrado (tarea 8)
```
