# Checklist E2E · Listado de recursos fase B (SCR-03)

Estado tras aplicar las 5 tareas del prompt `12_listado_b.md`. Los
~30 puntos del `ResourcesListPage.listadoB.integration.md §5` se
evalúan aquí.

> ⚙ = verificado estáticamente en el código.
> 👁 = requiere smoke test manual.

## Estado de la migración 027

- Aplicada y verificada 2026-04-22: 6 RPCs + tabla saved_views con RLS.
- Funciones: `duplicate_resource`, `list_saved_views`,
  `upsert_saved_view`, `delete_saved_view`, `bulk_change_status`,
  `bulk_delete_resources`.
- `bulk_change_status(array[]::uuid[], 'borrador')` devuelve 0 ✓.
- `duplicate_resource(id)` devuelve UUID nuevo ✓.

## Acciones masivas

| # | Punto | Estado |
|---|---|---|
| 1 | Seleccionar 3 recursos → toolbar flotante abajo centrada. | ⚙ (`BulkActionsToolbar` renderizado condicional a `selectedIds.size > 0`) |
| 2 | Toolbar muestra "3 recursos seleccionados" + 5 acciones + ×. | ⚙ (Publish/Unpublish/Archive/Export/Delete + onClearSelection) |
| 3 | "Publicar" cambia los 3 a publicado y refresca tabla. | 👁 (RPC `bulk_change_status` con `'publicado'` + `state.refetch()` tras limpiar selección) |
| 4 | "Archivar" cambia los 3 a archivado. | 👁 (mismo con `'archivado'`) |
| 5 | "Eliminar" abre modal con los N nombres + botón "Archivar los N" como alternativa. | ⚙ (`BulkConfirmModal` recibe `selectedRowsArray.map(r => r.nameEs ?? r.nameGl ?? '(sin nombre)')`) |
| 6 | Pulsar "Sí, eliminar N" elimina y cierra modal. | ⚙ (`handleBulkDeleteConfirm` → onBulkDelete + setSelectedIds(new Set) + setBulkDeleteOpen(false)) |
| 7 | Botón × deselecciona todo y oculta toolbar. | ⚙ (`onClearSelection={() => setSelectedIds(new Set())}`) |
| 8 | Si hay >10 seleccionados, el modal muestra "+N más" sin saturar. | ⚙ (lógica interna del `BulkConfirmModal`) |

## Duplicar

| # | Punto | Estado |
|---|---|---|
| 9 | Menú "..." → "Duplicar" → aparece nueva fila "(copia)" con estado Borrador. | 👁 (RPC `duplicate_resource`; resetea estado_editorial='borrador') |
| 10 | El duplicado tiene imágenes, tags y documentos del original. | ⚙ (migración 027 copia resource_images + resource_videos + resource_documents + resource_tags) |
| 11 | Slug único: si origen `cafe-x`, duplicado `cafe-x-copia` o `cafe-x-copia-2`. | ⚙ (bucle while verifica colisión en slug base + sufijo incremental) |
| 12 | `scheduled_publish_at` del duplicado es NULL aunque el origen lo tuviera. | ⚙ (reset explícito en el INSERT) |

## Vistas guardadas

| # | Punto | Estado |
|---|---|---|
| 13 | Aplicar filtros → menú "Vistas" → "+ Guardar vista actual". | ⚙ (`SavedViewsMenu` con botón `onOpenSaveDialog`) |
| 14 | Dialog pide nombre + check "por defecto". | ⚙ (`SaveViewDialog` con props existingNames + hasExistingDefault) |
| 15 | Guardar → aparece en menú con estrella amarilla ★ si default. | ⚙ (`savedViewsState.views` ordenado `is_default desc, updated_at desc`) |
| 16 | F5 sin filtros en URL → se aplica vista por defecto. | ⚙ (effect en ResourcesListPage: si `urlHasFilters=false && defaultView`, llama `applyView`) |
| 17 | Abrir menú → pulsar la vista → filtros se cargan. | ⚙ (handler `onApplyView` del SavedViewsMenu llama a `applyView(view)`) |
| 18 | × en una vista → confirm → borrar. | ⚙ (`onDeleteView={savedViewsState.deleteView}`) |
| 19 | No dejar guardar vista con nombre duplicado. | ⚙ (SaveViewDialog comprueba contra `existingNames`) |

## Exportación CSV

| # | Punto | Estado |
|---|---|---|
| 20 | Sin selección: botón "📄 Exportar" abre dialog. | ⚙ (en `list-toolbar-secondary`) |
| 21 | Dialog muestra "Todos los N recursos filtrados" como única opción. | ⚙ (`ExportCsvDialog` adapta UI si `selectedRows.length === 0`) |
| 22 | Por defecto 8 columnas marcadas. | ⚙ (`DEFAULT_EXPORT_COLUMNS`) |
| 23 | "Seleccionar todas" activa las 16. "Restablecer" vuelve a 8. | ⚙ |
| 24 | CSV con tildes correctas en Excel (UTF-8 BOM). | ⚙ (`rowsToCsv` incluye `﻿`) |
| 25 | Con selección ≥1: dialog muestra 2 opciones de scope. | ⚙ (`selectedRows.length > 0` → scope selector) |
| 26 | Filename por defecto `recursos-YYYY-MM-DD.csv`. | ⚙ (`defaultCsvFilename()`) |
| 27 | Si se cambian filtros y re-exporta, contenido actualizado. | ⚙ (el botón `onFetchAllFiltered` re-ejecuta RPC con filtros actuales) |

## Integridad del flujo

| # | Punto | Estado |
|---|---|---|
| 28 | `onFetchAllFilteredRows` replica TODOS los filtros del hook. | ⚙ (12 parámetros: search/status/type_keys/municipality_ids/languages_missing/visible_on_map/has_coordinates/incomplete_for_publish/owner_id/order_by/order_dir/page_size=5000) |
| 29 | Vista por defecto NO sobreescribe filtros de URL compartida. | ⚙ (effect comprueba `window.location.search.length > 0` → early return) |
| 30 | Todos los cambios masivos limpian selectedIds tras completar. | ⚙ (`setSelectedIds(new Set())` en cada handler bulk) |

## Smoke test sugerido

1. Ir a `/resources`.
2. Seleccionar 3 recursos con el checkbox de cabecera (o manualmente).
3. Aparece toolbar flotante abajo → "Publicar" → los 3 cambian a
   publicado.
4. Seleccionar uno → "..." → Duplicar → aparece "(copia)" en estado
   borrador con las imágenes del original.
5. Aplicar filtros (ej: tipología=Playa, municipio=Sanxenxo) → "Vistas"
   → "+ Guardar vista actual" → nombre "Playas Sanxenxo" + default.
6. F5 (sin query string en URL) → los filtros vuelven.
7. "📄 Exportar" → column picker → Descargar → abrir en Excel, verificar
   tildes (ñ, á, é, …) en la columna Nombre.
8. Seleccionar 5 recursos → "..." → "Eliminar" → modal con los 5
   nombres → "Archivar los 5" como alternativa segura.
9. `git push origin main`.

## Deuda abierta

- **Blob físico en Storage no se duplica** (aviso 3 del prompt): la
  RPC `duplicate_resource` clona las filas de `resource_images` y
  `resource_documents` pero `storage_path` apunta al mismo blob.
  Implicaciones:
  - Borrar el recurso original con su imagen de Storage deja la copia
    sin imagen.
  - Para cambiar la imagen del duplicado sin afectar al original hay
    que subir un archivo nuevo.
  Iteración futura: Edge Function que llame a Storage API para copiar
  el binario con nuevo path.
- **`og_image_override_path` reseteado a null en el duplicado**:
  decisión deliberada (el override solo tiene sentido en el original).
  Si el duplicado necesita uno, el editor lo sube manualmente.
- **Bulk actions masivo no registran en log_cambios**: `bulk_change_
  status` y `bulk_delete_resources` son UPDATEs/DELETEs directos sin
  llamar a logAudit. Mismo gap que paso 7b; trigger Postgres pendiente.
- **Sin "restaurar" explícito del duplicado**: si el editor duplica sin
  querer, tiene que borrar manualmente. Podría añadirse confirmación
  previa en `handleDuplicate` con el nombre del recurso origen.
- **Paginación del export limitada a 5000 filas**: suficiente para la
  comarca de O Salnés (1151 recursos en el xlsx) pero rompería en
  bases >5000. Para volúmenes mayores: paginar en el cliente o usar
  `copy to csv` nativo de Postgres via Edge Function.
- **Vista por defecto aplica filtros aunque el usuario luego los
  cambie**: si el usuario modifica un filtro tras cargar la vista,
  NO se actualiza la vista automáticamente — queda desalineada hasta
  que pulse "Guardar" de nuevo con el mismo nombre.
