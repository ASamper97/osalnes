# Prompt maestro · SCR-10 Gestor de taxonomías

**Pega este contenido en Claude Code.**

Gestor unificado de catálogos (municipios, zonas, tipologías UNE,
categorías, productos turísticos) en una pantalla master-detail con
editor multi-tab, soft-delete y vista de uso.

Cumple el pliego 5.1.x:
- **FR-02** · taxonomías gobernadas sin contaminar trabajo editorial.
- **ENT-04** · taxonomías maestras (municipio, zona, categoría,
  tipología, producto).
- **NFR-03** · consistencia semántica con UNE 178503.

## Decisiones aplicadas

- **1-C**: 5 catálogos completos.
- **2-B**: jerarquía solo en categoría/zona/producto. Municipios y
  tipologías planas.
- **3-C**: editor multi-tab ES/GL/EN en una sola pantalla, vía tabla
  `traduccion` centralizada.
- **4-C**: URI semántica opcional con warning no bloqueante.
- **5-B**: contador + breakdown por estado.
- **6-C**: soft delete (is_active boolean).
- **7-C**: RBAC granular — admin+platform todo, tourist_manager solo
  zona/producto/categoría (no tipologías UNE), municipios readonly.
- **8-C**: master-detail (panel catálogos a la izquierda, lista a la
  derecha).

## Ficheros en el repo

```
osalnes-dti/
├── database/migrations/
│   ├── 032_taxonomies.PREFLIGHT.sql           (NUEVO · validación)
│   ├── 032_taxonomies.sql                     (NUEVO · 4 tablas + 6 RPCs)
│   └── 032_taxonomies.down.sql                (NUEVO)
│
├── packages/shared/src/data/
│   └── taxonomies.ts                          (NUEVO · tipos + metadata catálogos)
│
├── packages/cms/src/
│   ├── hooks/
│   │   └── useTaxonomies.ts                   (NUEVO)
│   ├── components/taxonomies/
│   │   ├── CatalogSelector.tsx                (NUEVO · panel master)
│   │   ├── TermsList.tsx                      (NUEVO · panel detail)
│   │   ├── TermEditorDialog.tsx               (NUEVO · editor multi-tab)
│   │   ├── UsageDrawer.tsx                    (NUEVO · ver uso)
│   │   └── ConfirmToggleDialog.tsx            (NUEVO · soft-delete)
│   └── pages/
│       ├── TaxonomiesPage.tsx                 (NUEVO · orquestador)
│       ├── TaxonomiesRoute.tsx                (NUEVO · wrapper con RBAC)
│       ├── taxonomies.copy.ts                 (NUEVO · copy ES completo)
│       ├── taxonomies.css                     (NUEVO)
│       └── TaxonomiesPage.integration.md      (docs)
│
└── prompts/
    └── 17_scr10_taxonomias.md                 (este fichero)
```

## Tareas en orden

### Tarea 1 · Ejecutar PREFLIGHT

**NO aplicar la migración 032 directamente.** Primero, ejecutar el
contenido de `database/migrations/032_taxonomies.PREFLIGHT.sql` en
el SQL Editor y validar que el output coincide con lo esperado en
`TaxonomiesPage.integration.md` sección 1.

Si algo difiere (p.ej. `tr_get` tiene firma distinta, o
`traduccion` no tiene unique constraint en las columnas asumidas),
**parar y reportar al usuario** antes de aplicar 032.

### Tarea 2 · Aplicar migración 032

Pegar el contenido de `database/migrations/032_taxonomies.sql` en el
SQL Editor. Pulsar Run.

Verificar con:
```sql
select count(*) from information_schema.tables
where table_schema='public'
  and table_name in ('zona','tipologia_une','categoria','producto_turistico');
-- Esperado: 4

select count(*) from pg_proc
where proname in ('taxonomy_list','taxonomy_get','taxonomy_upsert',
  'taxonomy_toggle_active','taxonomy_get_usage','taxonomy_get_tree')
  and pronamespace='public'::regnamespace;
-- Esperado: 6
```

Si el PREFLIGHT reveló que alguna tabla ya existía con columnas
distintas, adaptar la 032 antes de aplicar. El `create table if not
exists` no crea columnas que falten en tablas preexistentes.

### Tarea 3 · Registrar la ruta `/taxonomies`

En `App.tsx`:
```tsx
import TaxonomiesRoute from './pages/TaxonomiesRoute';

<Route path="/taxonomies" element={<TaxonomiesRoute />} />
```

Adaptar los `declare const supabase` / `declare const useAuth` de
`TaxonomiesRoute.tsx` al patrón real del proyecto (mismo patrón que
`ExportsRoute.tsx`).

### Tarea 4 · Importar CSS

Añadir donde estén los imports de CSS del CMS:
```tsx
import './pages/taxonomies.css';
```

### Tarea 5 · Añadir item de sidebar

```tsx
<NavLink to="/taxonomies">🏷 Taxonomías</NavLink>
```

Visible para roles: admin, platform, tourist_manager. El operador puro
también puede verlo (solo lectura).

### Tarea 6 · Migrar tipologías existentes (opcional pero recomendado)

Si los recursos productivos ya tienen `rdf_type` rellenado, ejecutar
el script de migración de la sección "Deuda abierta 3" del
`integration.md` para poblar `tipologia_une` automáticamente. Así el
gestor muestra de entrada las tipologías en uso con su código
schema.org.

### Tarea 7 · Checklist E2E

Ver `integration.md` sección 6. Los puntos más críticos:

1. Municipios aparecen readonly con los 9 concellos.
2. Crear tipología UNE → aparece en lista con chip de conteo 0.
3. Warning "Sin URI semántica" aparece si no se rellena URI.
4. Tabs ES/GL/EN funcionan independientemente con dot indicator.
5. Soft delete → término desaparece salvo "Mostrar inactivos".
6. Ver uso → drawer con recursos que usan la tipología.
7. RBAC — tourist_manager NO ve botones editar en Tipologías UNE.

### Tarea 8 · Commits

Uno por tarea:
```
feat(db): migración 032 · taxonomías + RPCs unificadas (scr10 · t2)
feat(shared): tipos taxonomías + metadata catálogos (scr10 · t3a)
feat(cms): useTaxonomies hook (scr10 · t3b)
feat(cms): CatalogSelector + TermsList + TermEditorDialog (scr10 · t3c)
feat(cms): UsageDrawer + ConfirmToggleDialog (scr10 · t3d)
feat(cms): TaxonomiesPage + TaxonomiesRoute con RBAC (scr10 · t3e)
feat(cms): ruta /taxonomies + sidebar (scr10 · t5)
feat(db): migración tipologías UNE desde rdf_type existentes (scr10 · t6)
docs: checklist E2E SCR-10 (scr10 · t7)
```

## Restricciones

- NO aplicar migraciones por CLI (403).
- NO modificar la tabla `municipio` existente.
- NO modificar la tabla `traduccion` existente.
- NO desplegar Edge Functions (no hay en este módulo).
- Typecheck con `tsc --strict` al terminar. Los errores preexistentes
  de `DocumentUploader.tsx` y `RelationsManager.tsx` se pueden seguir
  ignorando (son deuda de otro módulo).

## Lo que NO hacer en este entregable

- No crear tablas intermedias `recurso_zona`, `recurso_categoria`, etc.
  (decisión pendiente para futuro · ver deuda abierta 1 en integration.md).
- No añadir conexión en el wizard SCR-04 para que use estos catálogos
  (eso es otra tarea).
- No añadir el selector de zona/categoría en el listado SCR-03
  (también otra tarea).

SCR-10 en esta fase entrega la **herramienta de gestión de catálogos**.
Que los recursos los usen después es otra conversación.
