# Integración · Listado de recursos fase B (SCR-03 · fase B)

Esta fase **amplía** el listado de la fase A (instalado previamente) con
4 bloques:

1. **Acciones masivas** — toolbar flotante + bulk_change_status / bulk_delete
2. **Duplicar recurso** — ya no placeholder, RPC real con copia profunda
3. **Vistas guardadas** — tabla saved_views + menu + dialog
4. **Exportación CSV/Excel** — del filtrado o de la selección

No reemplaza ni la migración 026 ni ningún componente del A: **añade**.

---

## 1) Aplicar migración 027

```bash
npx supabase db push
```

Verificar:
```sql
-- Duplicar debe existir:
select public.duplicate_resource(
  (select id from public.resources limit 1)
);

-- Tabla saved_views debe existir con RLS activada:
select count(*) from public.saved_views;

-- RPCs masivas:
select public.bulk_change_status(array['00000000-0000-0000-0000-000000000000'::uuid], 'draft');
```

## 2) Añadir import del CSS adicional

En `packages/cms/src/pages/ResourcesListPage.tsx` (fichero del A), al
principio, junto al import de `./listado.css`:

```tsx
import './listado.css';
import './listado-b.css'; // ← NUEVO
```

## 3) Ampliar `ResourcesListPage.tsx` con el patch

Seguir las 10 secciones de `ResourcesListPage.stepB.patch.ts`:

### 3.1 · Imports nuevos
```tsx
import BulkActionsToolbar from '../components/listado/BulkActionsToolbar';
import BulkConfirmModal from '../components/listado/BulkConfirmModal';
import SavedViewsMenu from '../components/listado/SavedViewsMenu';
import SaveViewDialog from '../components/listado/SaveViewDialog';
import ExportCsvDialog from '../components/listado/ExportCsvDialog';
import { useSavedViews } from '../hooks/useSavedViews';
import type { SavedView } from '@osalnes/shared/data/resources-list-b';
```

### 3.2 · Props nuevas
Añadir a `ResourcesListPageProps`:
```tsx
onBulkChangeStatus: (ids: string[], newStatus: ListResourceRow['publicationStatus']) => Promise<void>;
onBulkDelete: (ids: string[]) => Promise<void>;
onDuplicate: (id: string) => Promise<string>; // AHORA devuelve el nuevo ID
onFetchAllFilteredRows: () => Promise<ListResourceRow[]>;
supabase: SupabaseLike;
```

### 3.3 · Estado nuevo dentro del componente
```tsx
const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
const savedViewsState = useSavedViews({ supabase, enabled: true });
const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
const [exportDialogOpen, setExportDialogOpen] = useState(false);
```

### 3.4 · Aplicar vista por defecto al montar
```tsx
useEffect(() => {
  const urlHasFilters = window.location.search.length > 0;
  if (urlHasFilters) return;
  if (savedViewsState.defaultView) applyView(savedViewsState.defaultView);
}, [savedViewsState.defaultView]);

const applyView = useCallback((view: SavedView) => {
  state.setFilters(view.filters);
  if (view.sortOrderBy && view.sortOrderDir) {
    state.setSort({
      orderBy: view.sortOrderBy as ListSort['orderBy'],
      orderDir: view.sortOrderDir,
    });
  }
  if (view.pageSize) state.setPagination({ page: 1, pageSize: view.pageSize });
}, [state]);
```

### 3.5 · Handlers bulk
```tsx
const selectedRowsArray = state.rows.filter((r) => selectedIds.has(r.id));

const handleBulkPublish = async () => {
  await onBulkChangeStatus([...selectedIds], 'published');
  setSelectedIds(new Set());
  refresh();
};
// (idem Unpublish/Archive)

const handleBulkDeleteConfirm = async () => {
  setBulkDeleteLoading(true);
  try {
    await onBulkDelete([...selectedIds]);
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
    refresh();
  } finally {
    setBulkDeleteLoading(false);
  }
};
```

### 3.6 · Duplicar real (reemplazar el placeholder)
```tsx
const handleDuplicate = async (id: string): Promise<void> => {
  const newId = await onDuplicate(id);
  refresh();
  // Opcional: navegar al recurso duplicado
  // onOpenEdit(newId);
};
```

### 3.7 · Handler guardar vista
```tsx
const handleSaveView = async ({ name, isDefault }) => {
  await savedViewsState.saveView({
    name,
    filters: state.filters,
    sort: state.sort,
    pageSize: state.pagination.pageSize,
    isDefault,
  });
  setSaveViewDialogOpen(false);
};
```

### 3.8 · Render · toolbar secundaria (justo debajo de ListFiltersPanel)
```tsx
<div className="list-toolbar-secondary">
  <SavedViewsMenu
    views={savedViewsState.views}
    loading={savedViewsState.loading}
    error={savedViewsState.error}
    onApplyView={applyView}
    onOpenSaveDialog={() => setSaveViewDialogOpen(true)}
    onDeleteView={savedViewsState.deleteView}
  />
  <button
    type="button"
    className="btn btn-ghost btn-sm"
    onClick={() => setExportDialogOpen(true)}
    disabled={state.totalCount === 0}
  >
    📄 Exportar
  </button>
</div>
```

### 3.9 · Render · al final del JSX (dentro del `<div>` raíz)
```tsx
{selectedIds.size > 0 && (
  <BulkActionsToolbar
    selectedCount={selectedIds.size}
    onPublish={handleBulkPublish}
    onUnpublish={handleBulkUnpublish}
    onArchive={handleBulkArchive}
    onExport={() => setExportDialogOpen(true)}
    onDelete={() => setBulkDeleteOpen(true)}
    onClearSelection={() => setSelectedIds(new Set())}
  />
)}

{bulkDeleteOpen && (
  <BulkConfirmModal
    title={`¿Eliminar ${selectedIds.size} recurso${selectedIds.size === 1 ? '' : 's'}?`}
    body="Esta acción no se puede deshacer. Si solo quieres dejarlos de publicar, usa 'Archivar en vez de eliminar'."
    names={selectedRowsArray.map((r) => r.nameEs || r.nameGl || '(sin nombre)')}
    confirmLabel={`Sí, eliminar ${selectedIds.size}`}
    confirmVariant="danger"
    alternativeLabel={`Archivar los ${selectedIds.size}`}
    onConfirm={handleBulkDeleteConfirm}
    onAlternative={handleBulkArchiveInsteadOfDelete}
    onCancel={() => setBulkDeleteOpen(false)}
    loading={bulkDeleteLoading}
  />
)}

{saveViewDialogOpen && (
  <SaveViewDialog
    filters={state.filters}
    sort={state.sort}
    pageSize={state.pagination.pageSize}
    existingNames={savedViewsState.views.map((v) => v.name)}
    hasExistingDefault={savedViewsState.defaultView != null}
    onSave={handleSaveView}
    onCancel={() => setSaveViewDialogOpen(false)}
  />
)}

{exportDialogOpen && (
  <ExportCsvDialog
    onFetchAllFiltered={onFetchAllFilteredRows}
    totalFilteredCount={state.totalCount}
    selectedRows={selectedRowsArray}
    resolveTypologyLabel={resolveTypologyLabel}
    onCancel={() => setExportDialogOpen(false)}
  />
)}
```

### 3.10 · Eliminar el placeholder `onDuplicate`
En la ruta (`ResourcesRoute.tsx`), reemplazar el `alert(...)` por:

```tsx
onDuplicate={async (id) => {
  const { data, error } = await supabase.rpc('duplicate_resource', {
    p_source_id: id,
  });
  if (error) throw error;
  return String(data);
}}
```

## 4) Conectar las 2 props nuevas en la ruta

```tsx
onBulkChangeStatus={async (ids, newStatus) => {
  const { error } = await supabase.rpc('bulk_change_status', {
    p_resource_ids: ids,
    p_new_status: newStatus,
  });
  if (error) throw error;
}}

onBulkDelete={async (ids) => {
  const { error } = await supabase.rpc('bulk_delete_resources', {
    p_resource_ids: ids,
  });
  if (error) throw error;
}}

onFetchAllFilteredRows={async () => {
  // Llama a list_resources con page_size alto para obtener TODAS las
  // filas del filtro actual (sin paginación).
  const { data, error } = await supabase.rpc('list_resources', {
    p_search: state.filters.search.trim() || null,
    p_status: state.filters.status === 'all' ? null : state.filters.status,
    p_type_keys: state.filters.typeKeys.length ? state.filters.typeKeys : null,
    p_municipality_ids: state.filters.municipalityIds.length ? state.filters.municipalityIds : null,
    // … resto de filtros igual que en useResourcesList
    p_page: 1,
    p_page_size: 5000, // suficiente para volcar todo
  });
  if (error) throw error;
  return (data ?? []).map(mapRpcRow); // usar el mismo mapper del hook
}}

supabase={supabase}
```

## 5) Checklist E2E

### Acciones masivas
- [ ] Seleccionar 3 recursos → aparece toolbar flotante abajo centrada.
- [ ] Toolbar muestra "3 recursos seleccionados" + 5 acciones + botón ×.
- [ ] "Publicar" cambia los 3 a publicado y refresca tabla.
- [ ] "Archivar" cambia los 3 a archivado.
- [ ] "Eliminar" abre modal con los 3 nombres listados + botón "Archivar los 3" como alternativa.
- [ ] Pulsar "Sí, eliminar 3" elimina y cierra modal.
- [ ] Botón × deselecciona todo y oculta toolbar.
- [ ] Si hay >10 seleccionados, el modal muestra "+N más" para no saturar.

### Duplicar
- [ ] En el menú "..." de una fila, pulsar "Duplicar".
- [ ] Aparece una nueva fila "Nombre (copia)" con estado "Borrador".
- [ ] El nuevo recurso tiene las imágenes, tags y documentos del original.
- [ ] El slug es único (si origen era `cafe-x`, el nuevo `cafe-x-copia` o `cafe-x-copia-2`).
- [ ] El campo "scheduled_publish_at" del nuevo recurso es NULL aunque el origen lo tuviera.

### Vistas guardadas
- [ ] Aplicar unos filtros (ej: playas de Sanxenxo sin inglés).
- [ ] Abrir menú "Vistas", pulsar "+ Guardar vista actual".
- [ ] Modal pide nombre, escribir "Playas sin inglés" y marcar "por defecto".
- [ ] Guardar → la vista aparece en el menú con estrella amarilla ★.
- [ ] Recargar F5 → la URL no tiene filtros → se aplica la vista por defecto automáticamente.
- [ ] Limpiar filtros → abrir menú → pulsar la vista → filtros vuelven.
- [ ] × en una vista → confirm del navegador → borrar.
- [ ] No dejar guardar vista con nombre duplicado.

### Exportación CSV
- [ ] Sin selección: botón "📄 Exportar" abre dialog.
- [ ] Dialog muestra "Todos los N recursos filtrados" como única opción.
- [ ] Por defecto 8 columnas marcadas.
- [ ] "Seleccionar todas" activa las 16. "Restablecer" vuelve a las 8.
- [ ] Descargar → se abre el CSV en Excel con tildes correctas (UTF-8 BOM).
- [ ] Con selección ≥1: dialog muestra 2 opciones de scope (seleccionados / filtrados).
- [ ] El filename por defecto es `recursos-YYYY-MM-DD.csv`.
- [ ] Si se cambian filtros y se reexporta, se actualiza el contenido.
