# Prompt maestro · Paso 0 · Limpieza conceptual del modelo de tipologías

**Pega este fichero (o su contenido) en Claude Code.**

Este prompt ejecuta el **paso cero** del rediseño: unificar los tres
vocabularios paralelos de tipología que conviven hoy en el wizard, antes
de integrar `TagSelector` en el paso 4 (que es lo que hacía el prompt
maestro anterior, `01_guia_burros_v2_master_prompt.md`).

**IMPORTANTE:** este prompt se ejecuta **ANTES** del
`01_guia_burros_v2_master_prompt.md`. No los combines — son cambios
independientes con criterios de aceptación distintos.

---

## Contexto del cambio

El wizard tiene hoy tres vocabularios de tipología sin conectar:

| Vocabulario | Dónde aparece | Tamaño | Problema |
|---|---|---|---|
| **A. Tipología principal** | Desplegable del paso 1 | ~40 valores | Mezcla schema.org, español, inglés; valores inventados (`Cave`, `Montana`, `District`) |
| **B. Tipologías secundarias** | Lista de checkboxes en paso 1 | ~50 valores | Otro vocabulario más, con `ApartHotel`, `LodgingBusiness`, `ExhibitionEvent`… |
| **C. Catálogo UNE 178503** | Ya metido en `packages/shared/src/data/tag-catalog.ts` por la migración 018 | 154 tags × 18 grupos | **La fuente correcta** |

Además las tarjetas de plantillas ("Hotel", "Playa", "Bodega Albariño"…)
tienen tags inventados tipo "Acceso libre", "Mapa visible", "DO Rias
Baixas" que no existen en el catálogo UNE.

Este paso 0 deja el **catálogo UNE como fuente única**, conecta las
plantillas al catálogo real, esconde el slug detrás de un plegable y
filtra las zonas por municipio.

## Ficheros ya escritos y colocados en el repo (commit pendiente)

```
osalnes-dti/
├── database/migrations/
│   ├── 019_single_type_vocabulary.sql       ← deprecación legacy + backfill
│   └── 019_single_type_vocabulary.down.sql
│
├── packages/shared/src/data/
│   └── resource-templates.ts                ← 9 plantillas + validación
│
└── packages/cms/src/
    ├── components/
    │   ├── MainTypeSelector.tsx             ← selector paso 1 (los 18 tipos UNE)
    │   └── main-type-selector.css
    └── pages/
        ├── TemplatePicker.tsx               ← pantalla "¿Cómo quieres empezar?"
        ├── template-picker.css
        └── ResourceWizardPage.step1.integration.tsx   ← snippets (NO commitear)
```

---

## Tareas que debes ejecutar (en orden)

### Tarea 1 · Verificar `resource-templates.ts` en shared

1. El fichero ya está en `packages/shared/src/data/`.
2. Añade al barrel (`packages/shared/src/index.ts`):
   ```ts
   export * from './data/resource-templates';
   ```
3. Reconstruye el paquete shared.

**Criterio:** desde CMS se importa sin errores:
```ts
import { RESOURCE_TEMPLATES, resolveTemplateTags } from '@osalnes/shared';
```

**IMPORTANTE:** el fichero incluye una **validación automática en dev** que
imprime `console.error` si alguna clave referenciada no existe en
`tag-catalog.ts`. Si la consola del navegador ya arroja errores, hay un
tag inventado que se ha colado — para eso está la validación. Arréglalo
antes de seguir, no lo silencies.

### Tarea 2 · Aplicar migración 019

1. Ejecuta el runner de migraciones del proyecto.
2. Verifica:
   ```sql
   -- La tabla puente existe con 25 mappings seed
   select count(*) from public._tipology_legacy_to_une;    -- ≥ 25
   -- La vista devuelve tipologías
   select * from public.v_resource_main_type limit 5;
   -- La función existe
   select proname from pg_proc where proname = 'backfill_resource_une_type';
   -- El trigger existe
   select tgname from pg_trigger where tgname = 'trg_warn_legacy_tipology';
   ```
3. Si tu esquema real no usa `tipology_main` como nombre de columna
   legacy, la migración 019 **no fallará** (los bloques `do $$ ... $$` son
   idempotentes y solo actúan si la columna existe). Identifica el nombre
   real mirando `\d public.resources` y, si hace falta, amplía el array
   `cols` al principio de la migración **en una nueva migración 020** —
   no edites la 019 una vez aplicada.

**Criterio:** `select 1 from v_resource_main_type limit 1` no da error.

### Tarea 3 · Reemplazar el picker de plantillas actual

Hoy existe una pantalla en `/resources/new` que muestra las 9 plantillas
con tags inventados (Hotel, Casa rural, Playa, Restaurante, Museo,
Mirador, Evento, Bodega, Ruta, "Empezar en blanco" + bloque "Importar
desde URL con IA" + botón "Cancelar").

1. Localiza el componente actual de esa pantalla. Búscalo con:
   ```bash
   grep -rn "Como quieres empezar\|Importar desde una URL" packages/cms/src/
   ```
2. Si existe un `ResourceTemplatesPage.tsx` o similar, **renómbralo a
   `ResourceTemplatesPage.legacy.tsx`** para dejarlo como referencia
   durante unas semanas. No lo borres todavía.
3. Monta el nuevo `TemplatePicker.tsx` en la misma ruta que servía el
   anterior (probablemente `/resources/new`).
4. Cablea las 3 props:
   - `onPick(key)` → `navigate('/resources/new/wizard?template=' + key)`
     (o la ruta que use el wizard real; mira en `App.tsx` cuál es)
   - `onImportFromUrl()` → la ruta existente de import por IA (si
     existe; si no, deja un TODO y que el botón abra un modal vacío)
   - `onCancel()` → `navigate('/resources')`

**Criterio funcional:**
- Al hacer clic en "Playa", el URL cambia a
  `?template=playa` y el wizard arranca con `mainTypeKey` =
  `tipo-de-recurso.playa` y 3 etiquetas pre-marcadas (`caracteristicas.al-aire-libre`,
  `caracteristicas.todo-el-ano`, `caracteristicas.gratuito`).
- Al hacer clic en "Empezar en blanco", el wizard arranca sin
  tipología y el paso 1 obliga a elegir una antes de avanzar.

### Tarea 4 · Integrar el rediseño del paso 1

Abre `ResourceWizardPage.tsx` y aplica los cambios descritos en
`ResourceWizardPage.step1.integration.tsx`:

1. Imports nuevos (`MainTypeSelector`, su CSS).
2. Estado: sustituye `tipologyMain` + `tipologySecondary` (o los nombres
   que tenga tu modelo) por `mainTypeKey: string | null`. Hidrata desde
   `initialResource.tags` o desde `searchParams.get('template')`.
3. Sincroniza `mainTypeKey` con `tagKeys` del paso 4 (si el usuario elige
   Hotel en el paso 1, ese tag debe aparecer ya marcado en el paso 4).
4. **Reemplaza completamente el render del paso 1** con los 4 bloques:
   - `<MainTypeSelector>` (tipología)
   - Nombre ES/GL
   - Municipio y Zona (zona filtrada por municipio)
   - `<details>` con el slug escondido
5. Validación del paso 1: `mainTypeKey` + `nameEs` + `municipio`
   obligatorios. Zona opcional. Slug se auto-genera.
6. En `handleSubmit`: la función `saveResourceTags` persiste el
   `mainTypeKey` junto con los `tagKeys` del paso 4 (no duplicar).

**Criterio funcional:**
- Crear recurso nuevo tipo "Playa": el paso 1 muestra los 18 tipos como
  tarjetas visuales con iconos, sin desplegable.
- Cambiar municipio de "Sanxenxo" a "Cambados": el desplegable zona se
  refresca y muestra solo las parroquias de Cambados.
- El campo "slug" no se ve por defecto; al expandir `<details>` muestra
  el slug auto-generado y un aviso de que editarlo rompe enlaces.
- Al guardar, `select tag_key from resource_tags where resource_id = X`
  devuelve `tipo-de-recurso.playa` entre otras.

### Tarea 5 · Script de backfill (opcional pero recomendado)

Si ya tienes recursos en producción con la columna legacy poblada,
ejecuta el backfill:

```sql
-- Convierte todos los recursos con tipología legacy a tags UNE
-- donde haya mapeo en _tipology_legacy_to_une.
select
  id,
  public.backfill_resource_une_type(id) as mapped_to
from public.resources
where coalesce(
  (select tipology_main from public.resources r2 where r2.id = public.resources.id),
  ''
) <> '';
```

Luego corre un script TS para corregir el `value` de las filas con
`source='backfill-019'` (actualmente contienen el `tag_key` como
placeholder; deben contener el `value` schema.org real del catálogo):

```ts
// scripts/fix-backfill-values.ts
import { TAGS_BY_KEY } from '@osalnes/shared';
import { supabase } from '../packages/cms/src/lib/supabase';

const { data } = await supabase
  .from('resource_tags')
  .select('resource_id, tag_key')
  .eq('source', 'backfill-019');

for (const row of data ?? []) {
  const tag = TAGS_BY_KEY[row.tag_key];
  if (!tag) continue;
  await supabase
    .from('resource_tags')
    .update({ value: tag.value })
    .eq('resource_id', row.resource_id)
    .eq('tag_key', row.tag_key);
}
```

**Criterio:** tras ejecutar, `select count(*) from resource_tags where
source = 'backfill-019' and value = tag_key` devuelve 0.

---

## Lo que NO tocar todavía

- No borres las columnas legacy `tipology_main` / `tipology_secondary`
  (o como se llamen) — la limpieza física va en una migración 020
  posterior, cuando todos los recursos estén migrados y los consumidores
  downstream hayan dejado de leerlas.
- No toques el paso 4 del wizard — eso es el prompt maestro anterior
  (`01_guia_burros_v2_master_prompt.md`), que se ejecuta después de
  este.
- No toques `PageWizardPage.tsx`.
- No borres el fichero `ResourceTemplatesPage.legacy.tsx` ni el picker
  antiguo — lo dejamos de referencia unas semanas.

## Orden correcto de ejecución de los dos prompts

```
1. Ejecutar ESTE prompt (02_paso0_limpieza_conceptual.md)
   ↓
2. Commit → verificar todo funciona
   ↓
3. Ejecutar 01_guia_burros_v2_master_prompt.md (integra TagSelector en paso 4)
```

Si los ejecutas en orden inverso, el `TagSelector` del paso 4 recibirá
el `mainTypeKey` desde el estado legacy y las cosas se romperán sutilmente.

---

## Mensajes de commit sugeridos

```
feat(shared): catálogo de plantillas conectado a UNE 178503 (paso 0 · tarea 1)
feat(db): migración 019 · fuente única de tipologías (paso 0 · tarea 2)
feat(cms): TemplatePicker rediseñado con catálogo real (paso 0 · tarea 3)
feat(cms): MainTypeSelector + paso 1 limpio (paso 0 · tarea 4)
chore(db): backfill legacy→UNE (paso 0 · tarea 5)
```
