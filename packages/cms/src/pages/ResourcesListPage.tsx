/**
 * ResourcesListPage — Pantalla SCR-03 · Listado de recursos
 *
 * Orquesta todo el listado:
 *   1. Header con título + botón "Nuevo recurso"
 *   2. KPI dashboard (6 cards)
 *   3. Filtros facetados
 *   4. Tabla con todas las columnas del pliego
 *   5. Paginación
 *   6. Modales: delete confirm
 *
 * El componente es "dumb": recibe callbacks y opciones como props.
 * El padre (ruta) monta el hook useResourcesList y conecta con Supabase.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ListResourceRow, ListFilters, ListSort } from '@osalnes/shared/data/resources-list';
import { EMPTY_FILTERS } from '@osalnes/shared/data/resources-list';
import ListKpiDashboard from '../components/listado/ListKpiDashboard';
import ListFiltersPanel, {
  type MunicipalityOption,
  type TypologyOption,
} from '../components/listado/ListFiltersPanel';
import ResourcesTable from '../components/listado/ResourcesTable';
import ListPaginationBar from '../components/listado/ListPaginationBar';
import DeleteConfirmModal from '../components/listado/DeleteConfirmModal';
// ── Listado B · t2 — componentes + hook nuevos ──────────────────────
import BulkActionsToolbar from '../components/listado/BulkActionsToolbar';
import BulkConfirmModal from '../components/listado/BulkConfirmModal';
import SavedViewsMenu from '../components/listado/SavedViewsMenu';
import SaveViewDialog from '../components/listado/SaveViewDialog';
import ExportCsvDialog from '../components/listado/ExportCsvDialog';
import { useSavedViews, type SupabaseLike as SavedViewsSupabaseLike } from '../hooks/useSavedViews';
import type { SavedView } from '@osalnes/shared/data/resources-list-b';
import type { UseResourcesListState } from '../hooks/useResourcesList';
// ── SCR-13 Fase B · t5 — integración con centro de exportaciones ───
import ListExportButtons from '../components/exports/ListExportButtons';
import type { UseExportsState } from '../hooks/useExports';
import './listado-b.css';
import { LIST_COPY } from './listado.copy';

export interface ResourcesListPageProps {
  /** Estado del listado (del hook useResourcesList) */
  state: UseResourcesListState;

  /** Opciones de filtros (deben cargarse una vez al montar) */
  typologies: TypologyOption[];
  municipalities: MunicipalityOption[];

  /** Resolver etiqueta humana de tipología */
  resolveTypologyLabel: (key: string | null) => string;

  /** Acciones sobre recursos */
  onCreateNew: () => void;
  onOpenEdit: (id: string) => void;
  onOpenPreview: (id: string, slug: string) => void;
  onRenameResource: (id: string, newNameEs: string) => Promise<void>;
  onChangeStatus: (id: string, newStatus: ListResourceRow['publicationStatus']) => Promise<void>;

  /**
   * Listado B · t2/t3 — duplicar real: el handler ahora llama a la RPC
   * `duplicate_resource` y devuelve el ID del recurso nuevo para que el
   * listado pueda refrescar y/o navegar.
   */
  onDuplicate: (id: string) => Promise<string>;

  onViewHistory: (id: string) => void;
  onDeleteResource: (id: string) => Promise<void>;
  onArchiveResource: (id: string) => Promise<void>;

  // ── Listado B · t2 — handlers nuevos ───────────────────────────────

  /** Cambio de estado masivo (selección múltiple → toolbar inferior). */
  onBulkChangeStatus: (
    ids: string[],
    newStatus: ListResourceRow['publicationStatus'],
  ) => Promise<void>;

  /** Borrado masivo con confirmación. */
  onBulkDelete: (ids: string[]) => Promise<void>;

  /**
   * Fetch TODAS las filas del filtro actual (sin paginación) para exportar
   * a CSV. El consumidor llama a la RPC `list_resources` con el mismo
   * set de filtros pero con `p_page_size` alto (5000 típicamente).
   * Crítico para que el CSV incluya solo lo que el usuario ve filtrado.
   */
  onFetchAllFilteredRows: () => Promise<ListResourceRow[]>;

  /** Cliente Supabase — necesario para el hook useSavedViews. */
  supabase: SavedViewsSupabaseLike;

  // ── SCR-13 Fase B · t5 — exportaciones desde el listado ───────────

  /**
   * Estado del hook useExports. Si el caller lo pasa, se renderiza
   * ListExportButtons en la barra secundaria del listado. Si el caller
   * no conecta SCR-13, el prop queda undefined y los botones no aparecen.
   */
  exportsState?: UseExportsState;

  /** Permiso RBAC del usuario para lanzar exportaciones. */
  canExport?: boolean;
}

export default function ResourcesListPage({
  state,
  typologies,
  municipalities,
  resolveTypologyLabel,
  onCreateNew,
  onOpenEdit,
  onOpenPreview,
  onRenameResource,
  onChangeStatus,
  onDuplicate,
  onViewHistory,
  onDeleteResource,
  onArchiveResource,
  onBulkChangeStatus,
  onBulkDelete,
  onFetchAllFilteredRows,
  supabase,
  exportsState,
  canExport = false,
}: ResourcesListPageProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Listado B · t2 — estado nuevo ────────────────────────────────
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const savedViewsState = useSavedViews({ supabase, enabled: true });
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Wrapper que refresca tras acciones
  const refresh = () => void state.refetch();

  // ── Listado B · t2 — aplicar vista por defecto al montar ─────────
  //
  // Si el usuario tiene una vista marcada como `is_default`, se aplica
  // al abrir /resources. EXCEPTO si la URL ya trae filtros (share
  // links, atrás del navegador): entonces la URL prevalece.
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

  useEffect(() => {
    const urlHasFilters = typeof window !== 'undefined' && window.location.search.length > 0;
    if (urlHasFilters) return;
    if (savedViewsState.defaultView) {
      applyView(savedViewsState.defaultView);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedViewsState.defaultView]);

  const handleRename = async (id: string, newNameEs: string): Promise<void> => {
    await onRenameResource(id, newNameEs);
    refresh();
  };

  const handleChangeStatus = async (
    id: string,
    newStatus: ListResourceRow['publicationStatus'],
  ): Promise<void> => {
    await onChangeStatus(id, newStatus);
    refresh();
  };

  const handleDuplicate = async (id: string): Promise<void> => {
    // Listado B · t2 — duplicar real (ya no placeholder fase A). El
    // handler del padre llama a la RPC duplicate_resource y devuelve el
    // UUID nuevo; refrescamos la tabla para que la copia aparezca
    // inmediatamente.
    await onDuplicate(id);
    refresh();
  };

  // ── Listado B · t2 — Handlers bulk ────────────────────────────────

  const selectedRowsArray = useMemo(
    () => state.rows.filter((r) => selectedIds.has(r.id)),
    [state.rows, selectedIds],
  );

  const handleBulkPublish = async () => {
    await onBulkChangeStatus([...selectedIds], 'publicado');
    setSelectedIds(new Set());
    refresh();
  };

  const handleBulkUnpublish = async () => {
    await onBulkChangeStatus([...selectedIds], 'borrador');
    setSelectedIds(new Set());
    refresh();
  };

  const handleBulkArchive = async () => {
    await onBulkChangeStatus([...selectedIds], 'archivado');
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
    await onBulkChangeStatus([...selectedIds], 'archivado');
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
    refresh();
  };

  // ── Listado B · t2 — Handler guardar vista ────────────────────────

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

  const handleApplyKpiFilter = (patch: Partial<ListFilters>) => {
    state.setFilters({ ...state.filters, ...patch });
  };

  const handleClearAllFilters = () => {
    state.setFilters(EMPTY_FILTERS);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await onDeleteResource(deleteTarget.id);
      setDeleteTarget(null);
      refresh();
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleArchiveInstead = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await onArchiveResource(deleteTarget.id);
      setDeleteTarget(null);
      refresh();
    } finally {
      setDeleteLoading(false);
    }
  };

  // ─── Empty states ──────────────────────────────────────────────────
  const isEmpty = !state.loading && state.rows.length === 0;
  const hasAnyFiltersOrSearch =
    state.filters !== EMPTY_FILTERS &&
    (state.filters.search ||
      state.filters.status !== 'all' ||
      state.filters.typeKeys.length > 0 ||
      state.filters.municipalityIds.length > 0 ||
      state.filters.languagesMissing.length > 0 ||
      state.filters.visibleOnMap !== null ||
      state.filters.hasCoordinates !== null ||
      state.filters.incompleteForPublish !== null ||
      state.filters.onlyMine);

  return (
    <div className="resources-list-page">
      <header className="list-page-header">
        <div>
          <h1>{LIST_COPY.header.title}</h1>
          <p className="muted">{LIST_COPY.header.subtitle}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={onCreateNew}>
          {LIST_COPY.header.newButton}
        </button>
      </header>

      {/* KPIs */}
      <ListKpiDashboard
        kpis={state.kpis}
        loading={state.loading}
        onApplyFilter={handleApplyKpiFilter}
      />

      {/* Filtros */}
      <ListFiltersPanel
        filters={state.filters}
        onUpdate={state.updateFilter}
        onClearAll={handleClearAllFilters}
        typologies={typologies}
        municipalities={municipalities}
      />

      {/* Listado B · t2 — barra secundaria: vistas guardadas + exportar */}
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

        {/* SCR-13 Fase B · t5 — botones de exportación al PID. Solo
            aparecen si el padre conecta exportsState y canExport=true.
            ListExportButtons decide internamente cuál mostrar:
            · "Exportar al PID (N)" si hay selección
            · "Exportar filtrados" si hay filtros activos sin selección
            · nada en caso contrario */}
        {exportsState && (
          <ListExportButtons
            state={exportsState}
            selectedIds={Array.from(selectedIds)}
            currentFilters={(() => {
              const f = state.filters;
              const out: Record<string, unknown> = {};
              if (f.status && f.status !== 'all') out.status = f.status;
              if (f.typeKeys.length > 0) out.typeKeys = f.typeKeys;
              if (f.municipalityIds.length > 0) out.municipalityIds = f.municipalityIds;
              return Object.keys(out).length > 0 ? out : null;
            })()}
            canExport={canExport}
          />
        )}
      </div>

      {/* Error */}
      {state.error && (
        <div className="list-error" role="alert">
          <p>⚠️ {LIST_COPY.emptyStates.error.title}</p>
          <p className="muted">{LIST_COPY.emptyStates.error.hint}</p>
          <button type="button" className="btn btn-ghost" onClick={() => void state.refetch()}>
            {LIST_COPY.emptyStates.error.cta}
          </button>
        </div>
      )}

      {/* Empty states */}
      {isEmpty && !state.error && hasAnyFiltersOrSearch && (
        <div className="list-empty-state">
          <h3>{LIST_COPY.emptyStates.noResults.title}</h3>
          <p className="muted">{LIST_COPY.emptyStates.noResults.hint}</p>
          <button type="button" className="btn btn-ghost" onClick={handleClearAllFilters}>
            {LIST_COPY.emptyStates.noResults.cta}
          </button>
        </div>
      )}

      {isEmpty && !state.error && !hasAnyFiltersOrSearch && (
        <div className="list-empty-state">
          <h3>{LIST_COPY.emptyStates.noResourcesYet.title}</h3>
          <p className="muted">{LIST_COPY.emptyStates.noResourcesYet.hint}</p>
          <button type="button" className="btn btn-primary" onClick={onCreateNew}>
            {LIST_COPY.emptyStates.noResourcesYet.cta}
          </button>
        </div>
      )}

      {/* Tabla */}
      {!isEmpty && !state.error && (
        <>
          <ResourcesTable
            rows={state.rows}
            sort={state.sort}
            onSortChange={state.setSort}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            resolveTypologyLabel={resolveTypologyLabel}
            onRenameResource={handleRename}
            onChangeStatus={handleChangeStatus}
            onOpenEdit={onOpenEdit}
            onOpenPreview={onOpenPreview}
            onDuplicate={handleDuplicate}
            onViewHistory={onViewHistory}
            onDelete={(id, name) => setDeleteTarget({ id, name })}
          />

          <ListPaginationBar
            pagination={state.pagination}
            totalCount={state.totalCount}
            onChange={state.setPagination}
          />
        </>
      )}

      {/* Modal delete */}
      {deleteTarget && (
        <DeleteConfirmModal
          resourceName={deleteTarget.name}
          onConfirmDelete={handleDelete}
          onArchiveInstead={handleArchiveInstead}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}

      {/* Listado B · t2 — Toolbar bulk (sticky bottom). Solo con selección. */}
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

      {/* Listado B · t2 — Modal confirmación bulk delete */}
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

      {/* Listado B · t2 — Diálogo guardar vista */}
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

      {/* Listado B · t2 — Diálogo exportar CSV */}
      {exportDialogOpen && (
        <ExportCsvDialog
          onFetchAllFiltered={onFetchAllFilteredRows}
          totalFilteredCount={state.totalCount}
          selectedRows={selectedRowsArray}
          resolveTypologyLabel={resolveTypologyLabel}
          onCancel={() => setExportDialogOpen(false)}
        />
      )}
    </div>
  );
}
