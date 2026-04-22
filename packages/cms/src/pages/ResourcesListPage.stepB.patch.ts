/**
 * PATCH · packages/cms/src/pages/ResourcesListPage.tsx
 *
 * Amplía la página existente del Listado A con todos los elementos de
 * la fase B. NO reemplaza el fichero — añade props y secciones.
 *
 * Sigue las instrucciones. Este fichero es documentación, no código
 * ejecutable — se elimina tras aplicar el patch manualmente (o Claude
 * Code aplica el patch leyendo esto como guía).
 *
 * Resumen de cambios:
 *   - Props nuevas para bulk actions + saved views + export + duplicate
 *     real (ya no placeholder).
 *   - Import de componentes nuevos.
 *   - Estado nuevo: modales + dialogs abiertos.
 *   - Lógica: wiring de todos los handlers.
 *   - Render: añadir toolbar bulk + menu saved views + dialogs.
 */


// ═══════════════════════════════════════════════════════════════════════
// 1. IMPORTS NUEVOS (al principio del fichero)
// ═══════════════════════════════════════════════════════════════════════

/*
import BulkActionsToolbar from '../components/listado/BulkActionsToolbar';
import BulkConfirmModal from '../components/listado/BulkConfirmModal';
import SavedViewsMenu from '../components/listado/SavedViewsMenu';
import SaveViewDialog from '../components/listado/SaveViewDialog';
import ExportCsvDialog from '../components/listado/ExportCsvDialog';
import { useSavedViews } from '../hooks/useSavedViews';
import type { SavedView } from '@osalnes/shared/data/resources-list-b';
import type { ListResourceRow } from '@osalnes/shared/data/resources-list';
*/


// ═══════════════════════════════════════════════════════════════════════
// 2. PROPS NUEVAS (en ResourcesListPageProps)
// ═══════════════════════════════════════════════════════════════════════

/*
export interface ResourcesListPageProps {
  // … (todas las existentes del Listado A)

  // ── NUEVAS en fase B ─────────────────────────────────────────────

  // Acciones masivas (RPCs bulk_*)
  onBulkChangeStatus: (ids: string[], newStatus: ListResourceRow['publicationStatus']) => Promise<void>;
  onBulkDelete: (ids: string[]) => Promise<void>;

  // Duplicar (ahora real, ya no placeholder)
  // El handler recibe el ID y devuelve el nuevo ID del recurso duplicado
  onDuplicate: (id: string) => Promise<string>;

  // Fetch de TODAS las filas filtradas (para exportar CSV sin paginación)
  onFetchAllFilteredRows: () => Promise<ListResourceRow[]>;

  // Supabase client para el hook useSavedViews
  supabase: SupabaseLike;
}
*/


// ═══════════════════════════════════════════════════════════════════════
// 3. ESTADO NUEVO (dentro del componente, junto al resto)
// ═══════════════════════════════════════════════════════════════════════

/*
// Bulk actions
const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

// Saved views
const savedViewsState = useSavedViews({ supabase, enabled: true });
const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);

// Export CSV
const [exportDialogOpen, setExportDialogOpen] = useState(false);
*/


// ═══════════════════════════════════════════════════════════════════════
// 4. APLICAR VISTA POR DEFECTO AL MONTAR
// ═══════════════════════════════════════════════════════════════════════

/*
// Si el usuario tiene una vista marcada como default, aplicarla al
// abrir el listado SALVO que la URL ya tenga filtros (en cuyo caso
// prevalece la URL).
useEffect(() => {
  const urlHasFilters = window.location.search.length > 0;
  if (urlHasFilters) return;
  if (savedViewsState.defaultView) {
    applyView(savedViewsState.defaultView);
  }
}, [savedViewsState.defaultView]);

const applyView = useCallback((view: SavedView) => {
  state.setFilters(view.filters);
  if (view.sortOrderBy && view.sortOrderDir) {
    state.setSort({
      orderBy: view.sortOrderBy as ListSort['orderBy'],
      orderDir: view.sortOrderDir,
    });
  }
  if (view.pageSize) {
    state.setPagination({ page: 1, pageSize: view.pageSize });
  }
}, [state]);
*/


// ═══════════════════════════════════════════════════════════════════════
// 5. HANDLERS BULK
// ═══════════════════════════════════════════════════════════════════════

/*
const selectedRowsArray = state.rows.filter((r) => selectedIds.has(r.id));

const handleBulkPublish = async () => {
  await onBulkChangeStatus([...selectedIds], 'published');
  setSelectedIds(new Set());
  refresh();
};

const handleBulkUnpublish = async () => {
  await onBulkChangeStatus([...selectedIds], 'draft');
  setSelectedIds(new Set());
  refresh();
};

const handleBulkArchive = async () => {
  await onBulkChangeStatus([...selectedIds], 'archived');
  setSelectedIds(new Set());
  refresh();
};

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

const handleBulkArchiveInsteadOfDelete = async () => {
  await onBulkChangeStatus([...selectedIds], 'archived');
  setSelectedIds(new Set());
  setBulkDeleteOpen(false);
  refresh();
};
*/


// ═══════════════════════════════════════════════════════════════════════
// 6. DUPLICAR AHORA REAL (ya no placeholder)
// ═══════════════════════════════════════════════════════════════════════

/*
// Reemplazar el handleDuplicate actual por:
const handleDuplicate = async (id: string): Promise<void> => {
  const newId = await onDuplicate(id);
  refresh();
  // Opcional: mostrar toast "Recurso duplicado" con link al nuevo
  // o navegar automáticamente al editor del nuevo:
  // onOpenEdit(newId);
};
*/


// ═══════════════════════════════════════════════════════════════════════
// 7. HANDLERS SAVED VIEWS
// ═══════════════════════════════════════════════════════════════════════

/*
const handleSaveView = async ({ name, isDefault }: { name: string; isDefault: boolean }) => {
  await savedViewsState.saveView({
    name,
    filters: state.filters,
    sort: state.sort,
    pageSize: state.pagination.pageSize,
    isDefault,
  });
  setSaveViewDialogOpen(false);
};
*/


// ═══════════════════════════════════════════════════════════════════════
// 8. RENDER · añadir tras los filtros (antes de la tabla)
// ═══════════════════════════════════════════════════════════════════════

/*
// Toolbar de vistas guardadas + botones de utilidad, justo debajo de los filtros:

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
*/


// ═══════════════════════════════════════════════════════════════════════
// 9. RENDER · añadir al final (dentro del JSX de ResourcesListPage)
// ═══════════════════════════════════════════════════════════════════════

/*
// Toolbar bulk (sticky bottom) · solo si hay selección
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

// Modal confirmación bulk delete
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

// Diálogo guardar vista
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

// Diálogo exportar CSV
{exportDialogOpen && (
  <ExportCsvDialog
    onFetchAllFiltered={onFetchAllFilteredRows}
    totalFilteredCount={state.totalCount}
    selectedRows={selectedRowsArray}
    resolveTypologyLabel={resolveTypologyLabel}
    onCancel={() => setExportDialogOpen(false)}
  />
)}
*/


// ═══════════════════════════════════════════════════════════════════════
// 10. CSS · añadir al final de listado.css
// ═══════════════════════════════════════════════════════════════════════
// (Los estilos completos están en wizard-b.css dentro del zip)
