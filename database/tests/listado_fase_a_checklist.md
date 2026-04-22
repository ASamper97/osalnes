# Checklist E2E · Listado de recursos fase A (SCR-03)

Estado tras aplicar las 5 tareas del prompt `11_listado_a.md`. Los 30+
puntos del `ResourcesListPage.integration.md §5` se evalúan aquí.

> ⚙ = verificado estáticamente en el código.
> 👁 = requiere smoke test manual.

## Estado de la migración 026

- `list_resources()` aplicada y devuelve filas reales (verificado
  2026-04-22: 5 recursos del proyecto).
- Hotfixes aplicados en sesión (cast `varchar→text` en slug, rdf_type,
  estado_editorial, municipio.slug, municipio.name, usuario.email; ver
  commits 65b7c8a + 51b2518).
- RPCs disponibles: `list_resources`, `list_resources_kpis`,
  `change_resource_status`, `compute_resource_quality_score`,
  `count_pid_missing_required`, helper `tr_get`.
- Vista: `resources_list_view`.

## Dashboard KPI

| # | Punto | Estado |
|---|---|---|
| 1 | 6 cards arriba: Total · Publicados · Programados · Borradores · Archivados · Incompletos. | ⚙ (`ListKpiDashboard` renderiza 6 `KpiCard`) |
| 2 | Cada card clickable y filtra el listado. | ⚙ (`onApplyFilter({ status: 'publicado' })` etc., traducido al Spanish real en t2) |
| 3 | Card "Programados" con punto azul pulsante si hay alguno. | ⚙ (`pulse={kpis.scheduled > 0}`) |
| 4 | Card "Incompletos" resaltada si hay alguno. | ⚙ (`highlight={kpis.incompleteForPublish > 0}`) |

## Filtros

| # | Punto | Estado |
|---|---|---|
| 5 | Buscador por nombre con debounce 300ms. | ⚙ (el hook `useResourcesList` debounce las queries de filter.search) |
| 6 | Dropdown "Tipología" multi-select agrupado por categoría raíz. | ⚙ (`ListFiltersPanel` agrupa por `rootCategory` derivada de `TYPE_TO_GROUP` en ResourcesRoute) |
| 7 | Dropdown "Municipio" multi-select. | ⚙ |
| 8 | Botón "Filtros" con contador de activos. | ⚙ (`countActiveFilters(filters)` en shared) |
| 9 | Drawer con filtros avanzados (idiomas, visible, coordenadas, incompletos, mis recursos). | ⚙ (`ListFiltersPanel` en drawer modo) |
| 10 | Chips de filtros activos quitables. | ⚙ |
| 11 | Botón "Limpiar filtros" si hay alguno activo. | ⚙ |
| 12 | Filtros persisten en URL (F5 restaura). | ⚙ (`useResourcesList.syncWithUrl=true`) |

## Tabla

| # | Punto | Estado |
|---|---|---|
| 13 | 9 columnas: ☑ · Nombre · Tipología · Municipio · Estado · Idiomas · Mapa · Calidad · Actualizado · Acciones. | ⚙ (`ResourcesTable` renderiza las 10 cols — checkbox es la 1ª) |
| 14 | Columnas ordenables: Nombre, Municipio, Calidad, Actualizado. | ⚙ (sortable headers → `OrderByField`) |
| 15 | Subtítulo debajo del nombre muestra nombre del municipio. | ⚙ (`resources_list_view.municipio_name` resolvido desde traduccion con fallback a slug) |
| 16 | Badge de tipología coloreado. | ⚙ (labels resueltos via `resolveTypologyLabel` del `TypologyItem.name.es`) |
| 17 | Badge de estado clickable con menú de transiciones. | ⚙ (`StatusBadge` con `getPossibleTransitions` en Spanish) |
| 18 | Chips de idioma. | ⚙ (`LanguageChips` con has_lang_es/gl/en/fr/pt) |
| 19 | Chip de mapa. | ⚙ (`MapChip` con has_coordinates + visible_on_map) |
| 20 | Badge de calidad circular 0-100 + badge rojo ! si pid_missing_required > 0. | ⚙ (`QualityBadge`) |
| 21 | Fecha relativa <7 días, absoluta >7. | ⚙ (`formatUpdatedAt` del shared) |
| 22 | Si programado, fila extra con 📅 + cuenta atrás. | ⚙ (condición `row.publicationStatus === 'programado'` traducida en t2) |

## Acciones

| # | Punto | Estado |
|---|---|---|
| 23 | Botón "Editar" abre `/resources/{id}`. | ⚙ (`navigate(`/resources/${id}`)` → ResourceWizardPage en modo edición) |
| 24 | Doble clic en nombre activa edición inline. | ⚙ (`InlineNameEditor`) |
| 25 | Enter guarda, Escape cancela. | ⚙ |
| 26 | Menú "..." con 7 acciones. | ⚙ (Preview · Duplicar · Publicar/Despublicar · Archivar/Restaurar · Ver historial · Eliminar) |
| 27 | "Duplicar" muestra alert placeholder (fase B). | ⚙ (`onDuplicate` inline, documentado en ResourcesRoute) |
| 28 | "Eliminar" abre `DeleteConfirmModal` con 3 botones: Cancelar / Archivar / Eliminar. | ⚙ |
| 29 | Todo cambio recarga tabla automáticamente. | ⚙ (`state.refetch()` en cada handler) |

## Paginación

| # | Punto | Estado |
|---|---|---|
| 30 | Selector tamaño: 10/25/50/100. | ⚙ (`ListPaginationBar`) |
| 31 | Info "15 recursos · página 1 de 1". | ⚙ |
| 32 | Botones ant/sig deshabilitados en extremos. | ⚙ |

## Estados especiales

| # | Punto | Estado |
|---|---|---|
| 33 | Empty state "No hay recursos que coincidan" con CTA Limpiar filtros. | ⚙ |
| 34 | Empty state "Aún no hay recursos" con CTA "Crear primer recurso" si BD vacía. | 👁 |
| 35 | Error state con botón "Reintentar". | ⚙ (`state.error` + onRetry) |

## Responsive

| # | Punto | Estado |
|---|---|---|
| 36 | <1000px: tabla scroll horizontal, filtros adaptados. | ⚙ (media queries en `listado.css`) |
| 37 | <700px: barra y paginación apiladas. | ⚙ |

## Smoke test sugerido

1. Abrir `/resources` → verificar 6 KPIs (Total, Publicados,
   Programados, Borradores, Archivados, Incompletos) con números
   reales de BD.
2. Clic en "Publicados" → tabla filtrada.
3. Buscar "mirador" → debounce → resultados.
4. Clic en cabecera "Calidad" → orden asc → re-clic → desc.
5. Doble clic en el nombre de un recurso → escribir → Enter → nombre
   actualizado en `traduccion.valor`.
6. Clic en badge de estado "Borrador" → seleccionar "Publicado" → el
   recurso pasa a publicado (RPC change_resource_status).
7. Menú "..." → "Duplicar" → alert "pendiente fase B".
8. Menú "..." → "Eliminar" → modal → "Archivar" → estado pasa a
   archivado; "Eliminar" → DELETE + refetch.
9. Aplicar filtro "Sin traducir EN" + "Visible en mapa" → F5 → los
   filtros vuelven intactos (URL sync).

## Deuda abierta

- **onDuplicate placeholder**: la feature real con RPC
  `duplicate_resource` (clona recurso + imágenes + tags + videos +
  docs + SEO + translations con nuevo UUID + slug con sufijo `-copia`)
  va en la fase B del listado. Hoy es un `alert(...)` explicativo.
- **Calidad aproximada en SQL vs motor completo del paso 7a**: la nota
  puede variar ±5 puntos entre listado y ficha. Aceptable (listado
  prioriza velocidad; ficha usa motor completo). Documentado en el
  comment de `compute_resource_quality_score`.
- **Conteo de recursos por tipología (`TypologyOption.count`)**: no se
  expone hoy (el `api.getTypologies()` no devuelve el count). Para
  poblarlo habría que extender el edge function api con un JOIN a
  recurso_turistico. Nice-to-have.
- **`onRenameResource` no actualiza `updated_at` del recurso**: upsertea
  `traduccion` pero `recurso_turistico.updated_at` no cambia, así que
  la fila puede aparecer desactualizada en el orden por fecha.
  Workaround: el hook refetchea tras el rename así que el orden se
  restablece. Mejora: trigger `AFTER UPDATE OR INSERT ON traduccion`
  que actualice el `updated_at` del recurso padre.
- **`app.tsx` aún menciona ResourcesPage en un comentario**: dead
  reference textual, no importa para build. Cleanup opcional.
- **Bulk AI actions y vistas guardadas**: en el legacy existían;
  pendientes de la fase B.
- **Acciones masivas con toolbar flotante**: pospuesto a fase B.
