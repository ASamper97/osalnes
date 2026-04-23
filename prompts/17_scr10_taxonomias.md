# Prompt maestro · SCR-10 Gestor de taxonomías (v2)

**Pega este contenido en Claude Code.**

Versión **v2 adaptada al esquema real** del proyecto. PREFLIGHT ya ejecutado
y validado — la migración 032 v2 se aplica directamente, sin más checks.

## Hallazgos clave del PREFLIGHT (ya resueltos en v2)

- **`tipologia`** es el nombre real (no `tipologia_une`). Tiene **69 filas
  productivas** ya pobladas con `type_code`, `schema_org_type`, `grupo`,
  `activo`. No se toca.
- **`producto_turistico`** existe con 4 columnas (0 filas). Se amplía.
- **`categoria`** existe con 17 filas. Se amplía si faltan columnas.
- **`zona`** existe con 46 filas y su propio trigger `set_updated_at`.
- **`tr_upsert`** NO existe. La migración la crea.
- La RPC `tr_get(text, uuid, text, text) → text` SÍ existe y funciona.
- La constraint unique de `traduccion` es `(entidad_tipo, entidad_id, campo, idioma)`,
  por lo que `on conflict` en `tr_upsert` funciona correctamente.

## Decisiones aplicadas

- **1-C**: 5 catálogos completos.
- **2-B**: jerarquía solo en zona/categoria/producto. Tipologías planas.
- **3-C**: editor multi-tab ES/GL/EN.
- **4-C**: URI semántica opcional con warning no bloqueante.
- **5-B**: contador + breakdown por estado.
- **6-C**: soft delete (activo/is_active según tabla).
- **7-C**: RBAC granular — tourist_manager NO edita tipologías.
- **8-C**: master-detail.

## Ficheros en el repo

```
osalnes-dti/
├── database/migrations/
│   ├── 032_taxonomies.sql                     (NUEVO · v2 adaptada)
│   └── 032_taxonomies.down.sql                (NUEVO)
│
├── packages/shared/src/data/
│   └── taxonomies.ts                          (NUEVO · con tipo TipologiaGrupo)
│
├── packages/cms/src/
│   ├── hooks/
│   │   └── useTaxonomies.ts                   (NUEVO · initialCatalog='tipologia')
│   ├── components/taxonomies/
│   │   ├── CatalogSelector.tsx                (NUEVO)
│   │   ├── TermsList.tsx                      (NUEVO · con chip de grupo)
│   │   ├── TermEditorDialog.tsx               (NUEVO · con selector de grupo)
│   │   ├── UsageDrawer.tsx                    (NUEVO)
│   │   └── ConfirmToggleDialog.tsx            (NUEVO)
│   └── pages/
│       ├── TaxonomiesPage.tsx                 (NUEVO)
│       ├── TaxonomiesRoute.tsx                (NUEVO)
│       ├── taxonomies.copy.ts                 (NUEVO · con copy de grupo)
│       ├── taxonomies.css                     (NUEVO · con estilos de chip grupo)
│       └── TaxonomiesPage.integration.md      (docs)
│
└── prompts/
    └── 17_scr10_taxonomias.md                 (este fichero)
```

## Tareas

### T1 · Aplicar migración 032 v2 (PREFLIGHT ya hecho, saltar validación)

Pegar el contenido de `database/migrations/032_taxonomies.sql` en SQL Editor
de Supabase y pulsar Run.

Verificar con:

```sql
-- 6 RPCs + 1 helper
select count(*) from pg_proc
where proname in ('taxonomy_list','taxonomy_get','taxonomy_upsert',
  'taxonomy_toggle_active','taxonomy_get_usage','taxonomy_get_tree','tr_upsert')
  and pronamespace='public'::regnamespace;
-- Esperado: 7

-- semantic_uri autopoblado en las 69 tipologías
select count(*) from public.tipologia where semantic_uri like 'https://schema.org/%';
-- Esperado: 69
```

**NO tocar**: la tabla `tipologia` tiene datos productivos, la migración
solo añade columnas con `add column if not exists`.

### T2 · Ruta `/taxonomies`

En `App.tsx`:
```tsx
import TaxonomiesRoute from './pages/TaxonomiesRoute';
<Route path="/taxonomies" element={<TaxonomiesRoute />} />
```

Ajustar `declare const supabase` / `declare const useAuth` en
`TaxonomiesRoute.tsx` al patrón real del CMS (mismo que `ExportsRoute.tsx`).

### T3 · Importar CSS

```tsx
import './pages/taxonomies.css';
```

### T4 · Item de sidebar

```tsx
<NavLink to="/taxonomies">🏷 Taxonomías</NavLink>
```

Visible para admin/platform/tourist_manager. Operator puede verlo
(solo lectura).

### T5 · Checklist E2E

1. `/taxonomies` carga con **Tipologías** seleccionado por defecto y
   muestra los 69 valores con chip de color por grupo.
2. Click "Editar" en Beach → modal con `schema_code=Beach`,
   `grupo=recurso`, URI preautomatizada.
3. Crear nueva tipología → aparece con chip correcto.
4. Crear zona hija de otra zona → jerarquía funciona.
5. Desactivar tipología → modal → desactiva → no aparece por defecto.
6. Tourist_manager NO ve botón editar en Tipologías, sí en Zonas.
7. Municipios readonly con los 9 concellos y usage_count real.

### T6 · Commits

```
feat(db): migración 032 v2 · taxonomías adaptadas al esquema real (scr10 · t1)
feat(shared): tipos taxonomías con grupo tipologia (scr10 · t2a)
feat(cms): useTaxonomies hook + CatalogSelector + dialogs (scr10 · t2b)
feat(cms): TermsList + TermEditor con grupo UNE (scr10 · t2c)
feat(cms): TaxonomiesPage + TaxonomiesRoute con RBAC (scr10 · t2d)
feat(cms): ruta /taxonomies + sidebar (scr10 · t4)
docs: checklist E2E SCR-10 v2 (scr10 · t5)
```

## Restricciones

- NO tocar la tabla `tipologia` en sí · tiene datos productivos.
- NO aplicar migraciones por CLI (403).
- NO desplegar Edge Functions.
- Typecheck con `tsc --strict`. Los errores preexistentes de
  `DocumentUploader.tsx` y `RelationsManager.tsx` son deuda de otro módulo.

## Lo que NO hacer

- No crear tablas intermedias `recurso_categoria`, `recurso_producto`
  (deuda abierta para otra sesión).
- No conectar SCR-04 al selector de tipologías todavía.
- No conectar SCR-03 al filtro por zona todavía.

Esta entrega cierra SCR-10 como herramienta autónoma de gestión de
catálogos. La integración con el wizard y listado es otra tarea.
