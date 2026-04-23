# Checklist E2E · SCR-10 Gestor de taxonomías (v2 adaptado)

Estado tras aplicar las 4 tareas del prompt `17_scr10_taxonomias.md`
(T1 migración, T2 route, T3 css, T4 sidebar; T5 = este documento,
T6 = commits atómicos por tarea).

Cumple el pliego 5.1.8: gestión unificada de tipologías, categorías,
productos turísticos, zonas geográficas y municipios como herramienta
autónoma del CMS.

> ⚙ = verificado estáticamente en el código / BD.
> 👁 = requiere smoke test manual en el CMS desplegado.

## Migración 032 v2 (adaptada al esquema real)

Aplicada por el usuario en SQL Editor (CLI da 403). PREFLIGHT validó
que `tipologia` tiene 69 filas productivas, `categoria` 17 filas,
`zona` 46 filas, `producto_turistico` 0 filas. No se destruye nada:
todas las ampliaciones usan `add column if not exists`.

| # | Artefacto | Estado |
|---|---|---|
| 1 | `tipologia` se amplía con columnas nuevas (name_es/gl/en inexistentes — el nombre vive en `traduccion`; se añaden `parent_id`, `semantic_uri`, etc.) sin tocar las 69 filas. | ⚙ |
| 2 | `producto_turistico` amplía con las columnas del master-detail. | ⚙ |
| 3 | `categoria` amplía si faltan columnas. | ⚙ |
| 4 | `zona` mantiene su trigger `set_updated_at` propio. No se tocan las 46 filas. | ⚙ |
| 5 | 6 RPCs creadas: `taxonomy_list`, `taxonomy_get`, `taxonomy_upsert`, `taxonomy_toggle_active`, `taxonomy_get_usage`, `taxonomy_get_tree`. | ⚙ (revisión estática) |
| 6 | 1 helper creado: `tr_upsert(entidad_tipo, entidad_id, campo, idioma, valor)` con `on conflict (entidad_tipo, entidad_id, campo, idioma)` — la constraint UNIQUE existe desde migración 001. | ⚙ |
| 7 | `tr_get(text, uuid, text, text) → text` SÍ existe (migración 026). La migración 032 no la toca. | ⚙ |
| 8 | `semantic_uri` autopoblado para las 69 tipologías con `https://schema.org/{schema_org_type}` mediante UPDATE controlado. | ⚙ |

**Smoke test post-aplicación:**
```sql
-- Las 6 RPCs + 1 helper existen
select count(*) from pg_proc
where proname in (
  'taxonomy_list','taxonomy_get','taxonomy_upsert',
  'taxonomy_toggle_active','taxonomy_get_usage','taxonomy_get_tree','tr_upsert'
) and pronamespace = 'public'::regnamespace;
-- Esperado: 7

-- semantic_uri autopoblado en las 69 tipologías
select count(*) from public.tipologia
where semantic_uri like 'https://schema.org/%';
-- Esperado: 69

-- taxonomy_list('tipologia') devuelve 69 filas con grupo
select count(*), count(distinct grupo)
from public.taxonomy_list('tipologia', 'es', false);
-- Esperado: 69 filas, ≥4 grupos (alojamiento/restauracion/recurso/evento)
```

## Shared · tipos y catálogo de catálogos

| # | Punto | Estado |
|---|---|---|
| 9 | `packages/shared/src/data/taxonomies.ts` exporta `TaxonomyCatalog`, `TaxonomyTerm`, `TaxonomyTermDetail`, `UsageItem`, `TipologiaGrupo`, `CATALOGS` metadata con readonly/rolesCanEdit por catálogo. | ⚙ |
| 10 | Export `./data/taxonomies` registrado en `packages/shared/package.json` (mismo patrón que los módulos previos). | ⚙ |
| 11 | `CATALOGS.municipio.readonly = true` (los 9 concellos del Salnés son datos productivos intocables). Bloquea edición en UI. | ⚙ |
| 12 | `CATALOGS.tipologia.rolesCanEdit = ['admin', 'platform']` — tourist_manager NO edita (decisión 7-C). | ⚙ |
| 13 | Mappers `mapRpcTaxonomyTerm` / `mapRpcTaxonomyDetail` / `mapRpcUsageItem` alinean los alias SQL (`type_code as slug`, `activo as is_active`) con los nombres lógicos del frontend. | ⚙ |

## Hook `useTaxonomies`

| # | Punto | Estado |
|---|---|---|
| 14 | `initialCatalog = 'tipologia'` (v2) — entra directamente al catálogo más útil con 69 valores poblados. | ⚙ |
| 15 | `upsert()` acepta `grupo` opcional (solo aplicable a tipologia; ignorado en otros catálogos). | ⚙ |
| 16 | `getDetail(null)` devuelve `emptyTaxonomyDetail` sin hacer roundtrip — permite abrir el editor en modo "crear". | ⚙ |
| 17 | `refetch()` es idempotente y no-op si el catálogo aún no ha cargado. | ⚙ |
| 18 | `includeInactive` toggle — por defecto false (soft-delete oculto por decisión 6-C). | ⚙ |
| 19 | `setCatalog()` resetea automáticamente el cursor de detalle para evitar mezclar términos entre catálogos. | ⚙ |

## TaxonomiesRoute · wiring + RBAC

| # | Punto | Estado |
|---|---|---|
| 20 | Imports reales: `supabase` desde `@/lib/supabase`, `useAuth` desde `@/lib/auth-context` (placeholders `declare const` del draft eliminados). | ⚙ |
| 21 | `resolveUserRole(legacyRole, userMetadata)` reduce los 2 sistemas RBAC al set que entiende TaxonomiesPage (`admin|platform|tourist_manager|operator|unknown`). Mapeo explícito: tecnico/editor/validador/analitica (legacy) → operator. | ⚙ |
| 22 | En conflicto legacy↔shared gana el más permisivo (p. ej. legacy='admin' + shared='operator' → admin). | ⚙ |
| 23 | Cast `supabase as unknown as SupabaseLike` — mismo patrón que ExportsRoute / DashboardRoute (PostgrestFilterBuilder thenable). | ⚙ |
| 24 | `handleOpenResource(id)` navega a `/resources/:id` del wizard (no `/edit`); con `id=""` cae al listado `/resources`. | ⚙ |
| 25 | `import '@/pages/taxonomies.css'` en el Route — mismo patrón que ExportsRoute con exports.css. | ⚙ |

## App.tsx · ruta

| # | Punto | Estado |
|---|---|---|
| 26 | `lazy(() => import('./pages/TaxonomiesRoute'))` (default export). | ⚙ |
| 27 | `<Route path="/taxonomies" element={<ErrorBoundary><TaxonomiesRoute /></ErrorBoundary>} />` dentro del layout protegido. | ⚙ |

## Sidebar (Layout.tsx)

| # | Punto | Estado |
|---|---|---|
| 28 | Item 🏷 Taxonomías añadido entre Zonas y Páginas (agrupado con catálogos). | ⚙ |
| 29 | Visibilidad OR de dos RBAC: legacy `['admin', 'editor', 'tecnico']` o shared `['admin', 'platform', 'tourism_manager', 'operator']`. | ⚙ |
| 30 | Operator ve el item (solo lectura; la edición queda deshabilitada por RBAC del catálogo). | ⚙ |
| 31 | Agency (shared) NO ve el item — fuera de ambos listados. | ⚙ |

## Flujo E2E (smoke test manual)

### Carga inicial + Tipologías

| # | Punto | Estado |
|---|---|---|
| 32 | Navegar a `/taxonomies` → carga con **Tipologías** seleccionado por defecto (initialCatalog='tipologia'). | 👁 |
| 33 | La lista muestra 69 términos con chip de color por grupo (alojamiento/restauracion/recurso/evento/transporte). | 👁 |
| 34 | Cada fila muestra: schema_code (type_code), nombre ES resuelto vía tr_get, grupo, is_active, usage_count. | 👁 |
| 35 | `includeInactive=false` por defecto: términos con `activo=false` ocultos. Toggle muestra los desactivados. | 👁 |
| 36 | Click "Editar" en Beach → modal abre con: schema_code="Beach", grupo="recurso", URI pre-rellenada "https://schema.org/Beach", tabs ES/GL/EN con traducciones actuales. | 👁 |

### Creación y edición

| # | Punto | Estado |
|---|---|---|
| 37 | Pulsar "Nueva tipología" → modal vacío con tabs ES/GL/EN, dropdown de grupo, campo schema_code opcional. | 👁 |
| 38 | Guardar sin nombre ES → error de validación, no crea. | 👁 |
| 39 | Guardar con nombre ES + grupo → aparece en la lista con chip correcto + usage_count=0. | 👁 |
| 40 | Editar término existente → cambios en ES/GL se persisten vía `tr_upsert` (on conflict funciona — sin duplicados). | 👁 |
| 41 | URI semántica vacía + schema_code relleno → warning no bloqueante "Sin URI semántica" (decisión 4-C). | 👁 |

### Jerarquía (zona / categoria / producto)

| # | Punto | Estado |
|---|---|---|
| 42 | Cambiar a catálogo "Zonas" → 46 zonas cargadas, algunas con parent_id. | 👁 |
| 43 | Crear zona hija seleccionando parent → aparece anidada en el editor. | 👁 |
| 44 | Tipologías NO exponen `parent_id` (decisión 2-B: planas). El dropdown de parent no aparece para el catálogo tipologia. | 👁 |
| 45 | `taxonomy_get_tree` para zona devuelve jerarquía completa con `depth`. | ⚙ (RPC creada) |

### Soft delete (decisión 6-C)

| # | Punto | Estado |
|---|---|---|
| 46 | Desactivar tipología → `ConfirmToggleDialog` con warning si hay usos asociados. | 👁 |
| 47 | Aceptar → `taxonomy_toggle_active(id, false)` → el término desaparece de la lista por defecto. | 👁 |
| 48 | Toggle "Ver inactivos" → reaparece con chip "inactivo" gris. | 👁 |
| 49 | Reactivar → `taxonomy_toggle_active(id, true)` → vuelve a la lista principal. | 👁 |

### Usage drawer

| # | Punto | Estado |
|---|---|---|
| 50 | Click "Ver uso" en un término → `UsageDrawer` abre con la lista de recursos que lo usan. | 👁 |
| 51 | Click en un recurso del drawer → navega a `/resources/:id` (wizard). | 👁 |
| 52 | `taxonomy_get_usage(term_id, catalog)` filtra por la tabla intermedia correspondiente (vacía por ahora en recurso_categoria/recurso_producto — deuda declarada). | ⚙ |

### RBAC granular por catálogo (decisión 7-C)

| # | Punto | Estado |
|---|---|---|
| 53 | Usuario admin: ve botón "Editar" en los 5 catálogos excepto Municipios (readonly). | 👁 |
| 54 | Usuario platform: ve botón "Editar" en tipologia/categoria/producto/zona, NO en municipio. | 👁 |
| 55 | Usuario tourist_manager: ve botón "Editar" en categoria/producto/zona, **NO en tipologia**. El botón queda deshabilitado (decisión 7-C). | 👁 |
| 56 | Usuario operator (legacy tecnico/editor): NO ve botón "Editar" en ningún catálogo — solo lectura. La lista sí se muestra. | 👁 |
| 57 | Usuario sin rol (unknown): no ve el item del sidebar — no llega a la página. | ⚙ |

### Municipios readonly

| # | Punto | Estado |
|---|---|---|
| 58 | Cambiar a catálogo "Municipios" → lista con los 9 concellos del Salnés (desde tabla `municipio`). | 👁 |
| 59 | Nombre resuelto vía `tr_get('municipio', id, 'name', 'es')` — si falta traducción, fallback al slug. | ⚙ |
| 60 | `usage_count` real (recursos con `municipio_id = m.id`). | 👁 |
| 61 | Ningún botón "Editar" o "Nuevo" visible (readonly=true en CATALOGS.municipio). | 👁 |

## Deuda abierta (no bloqueante)

- **Tablas intermedias `recurso_categoria` y `recurso_producto` vacías**:
  la 001 las creó pero el wizard no las rellena. Mientras no haya
  integración SCR-04 (wizard paso 4 clasificación) con el selector
  multi-categoría/producto, `taxonomy_get_usage` devolverá 0 para
  esos dos catálogos. Deuda explícita del prompt: "No crear tablas
  intermedias recurso_categoria, recurso_producto (deuda abierta
  para otra sesión)".
- **Integración del selector de tipologías con el wizard SCR-04 pendiente**:
  el wizard paso 1 (Identificación) y paso 4 (Clasificación) hoy usan
  los catálogos legacy por `api.getTypologies()`. Cuando se migren a
  `taxonomy_list('tipologia')`, podremos retirar el endpoint legacy
  sin deuda técnica.
- **Integración con filtro por zona en SCR-03 pendiente**: el listado
  de recursos no filtra por `zona_id`. Deuda declarada en el prompt.
- **Migración de Categorias/Productos/Zonas antiguas**: el sidebar
  mantiene los items legacy (`/categories`, `/products`, `/zones`)
  además del nuevo `/taxonomies`. Cuando el gestor unificado cubra
  todos los flujos, los items viejos pueden retirarse. Hasta entonces
  conviven.
- **`TipologiaGrupo` hardcodeado en el frontend**: el enum de grupos
  (alojamiento/restauracion/recurso/evento/transporte/servicio) vive
  en `packages/shared/src/data/taxonomies.ts`. Si se añade un grupo
  nuevo en BD hay que actualizar el tipo. Alternativa: generar el
  enum desde SQL con `unnest(enum_range(null::tipologia_grupo))` —
  requiere convertir el text libre a enum en la migración 032.
- **Dos sistemas RBAC coexistiendo** (legacy `profile.role` vs shared
  `user_metadata.role`) — unificación pendiente en SCR-14. El
  resolveUserRole del Route sigue la misma estrategia "OR permisivo"
  que el resto del CMS.
- **Errores TS2345 preexistentes** en `DocumentUploader.tsx` y
  `RelationsManager.tsx` siguen sin afectar rutas vivas.
