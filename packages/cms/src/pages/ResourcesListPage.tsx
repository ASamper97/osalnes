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

import { useMemo, useState } from 'react';
import type { ListResourceRow, ListFilters } from '@osalnes/shared/data/resources-list';
import { EMPTY_FILTERS } from '@osalnes/shared/data/resources-list';
import ListKpiDashboard from '../components/listado/ListKpiDashboard';
import ListFiltersPanel, {
  type MunicipalityOption,
  type TypologyOption,
} from '../components/listado/ListFiltersPanel';
import ResourcesTable from '../components/listado/ResourcesTable';
import ListPaginationBar from '../components/listado/ListPaginationBar';
import DeleteConfirmModal from '../components/listado/DeleteConfirmModal';
import type { UseResourcesListState } from '../hooks/useResourcesList';
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
  onDuplicate: (id: string) => Promise<void>;
  onViewHistory: (id: string) => void;
  onDeleteResource: (id: string) => Promise<void>;
  onArchiveResource: (id: string) => Promise<void>;
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
}: ResourcesListPageProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Wrapper que refresca tras acciones
  const refresh = () => void state.refetch();

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
    await onDuplicate(id);
    refresh();
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
    </div>
  );
}
