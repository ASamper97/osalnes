/**
 * ResourcesTable — tabla del listado (SCR-03)
 *
 * Columnas según pliego: Nombre · Tipología · Municipio · Estado ·
 * Idiomas · Mapa · Calidad · Actualizado · Acciones
 *
 * Features:
 *   - Orden por columna (clic en cabecera)
 *   - Edición inline de nombre + estado (decisión 5-A)
 *   - Menú "..." con preview/duplicar/cambiar estado/historial/eliminar
 *   - Selección múltiple (checkboxes) · se usará en Listado B
 */

import { useState } from 'react';
import {
  type ListResourceRow,
  type ListSort,
  type OrderByField,
  formatUpdatedAt,
} from '@osalnes/shared/data/resources-list';
import {
  formatScheduleForDisplay,
  timeUntilSchedule,
} from '@osalnes/shared/data/publication-status';
import QualityBadge from './QualityBadge';
import LanguageChips from './LanguageChips';
import MapChip from './MapChip';
import StatusBadge from './StatusBadge';
import RowActionsMenu from './RowActionsMenu';
import InlineNameEditor from './InlineNameEditor';
import { LIST_COPY } from '../../pages/listado.copy';

const COPY = LIST_COPY.columns;

export interface ResourcesTableProps {
  rows: ListResourceRow[];
  sort: ListSort;
  onSortChange: (s: ListSort) => void;
  /** IDs seleccionados (para acciones masivas en Listado B) */
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;

  /** Nombre del tipo (humano) dado el key (ej. 'restaurante' → 'Restaurante') */
  resolveTypologyLabel: (key: string | null) => string;

  /** Callbacks de edición inline */
  onRenameResource: (id: string, newNameEs: string) => Promise<void>;
  onChangeStatus: (id: string, newStatus: ListResourceRow['publicationStatus']) => Promise<void>;

  /** Callbacks del menú "..." */
  onOpenEdit: (id: string) => void;
  onOpenPreview: (id: string, slug: string) => void;
  onDuplicate: (id: string) => Promise<void>;
  onViewHistory: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}

export default function ResourcesTable({
  rows,
  sort,
  onSortChange,
  selectedIds,
  onSelectionChange,
  resolveTypologyLabel,
  onRenameResource,
  onChangeStatus,
  onOpenEdit,
  onOpenPreview,
  onDuplicate,
  onViewHistory,
  onDelete,
}: ResourcesTableProps) {
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const someSelected = rows.some((r) => selectedIds.has(r.id));

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(rows.map((r) => r.id)));
    }
  };

  const toggleRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const handleSortClick = (field: OrderByField) => {
    if (sort.orderBy === field) {
      onSortChange({ orderBy: field, orderDir: sort.orderDir === 'asc' ? 'desc' : 'asc' });
    } else {
      onSortChange({ orderBy: field, orderDir: 'asc' });
    }
  };

  return (
    <div className="list-table-wrapper" role="region" aria-label="Tabla de recursos">
      <table className="list-table">
        <thead>
          <tr>
            <th scope="col" className="list-th-select">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = !allSelected && someSelected;
                }}
                onChange={toggleAll}
                aria-label={COPY.select}
              />
            </th>
            <SortableTh field="name" currentSort={sort} onClick={handleSortClick}>
              {COPY.name}
            </SortableTh>
            <th scope="col">{COPY.typology}</th>
            <SortableTh field="municipality" currentSort={sort} onClick={handleSortClick}>
              {COPY.municipality}
            </SortableTh>
            <th scope="col">{COPY.status}</th>
            <th scope="col">{COPY.languages}</th>
            <th scope="col">{COPY.map}</th>
            <SortableTh field="quality_score" currentSort={sort} onClick={handleSortClick}>
              {COPY.quality}
            </SortableTh>
            <SortableTh field="updated_at" currentSort={sort} onClick={handleSortClick}>
              {COPY.updatedAt}
            </SortableTh>
            <th scope="col" className="list-th-actions">
              {COPY.actions}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <ResourceRow
              key={row.id}
              row={row}
              selected={selectedIds.has(row.id)}
              onToggleSelect={() => toggleRow(row.id)}
              resolveTypologyLabel={resolveTypologyLabel}
              onRenameResource={onRenameResource}
              onChangeStatus={onChangeStatus}
              onOpenEdit={onOpenEdit}
              onOpenPreview={onOpenPreview}
              onDuplicate={onDuplicate}
              onViewHistory={onViewHistory}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Sortable header ─────────────────────────────────────────────────

function SortableTh({
  field,
  currentSort,
  onClick,
  children,
}: {
  field: OrderByField;
  currentSort: ListSort;
  onClick: (f: OrderByField) => void;
  children: React.ReactNode;
}) {
  const isActive = currentSort.orderBy === field;
  const arrow = isActive ? (currentSort.orderDir === 'asc' ? '▲' : '▼') : '';
  return (
    <th scope="col">
      <button
        type="button"
        className={`list-th-sortable ${isActive ? 'is-active' : ''}`}
        onClick={() => onClick(field)}
        aria-sort={isActive ? (currentSort.orderDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        {children} <span className="list-th-arrow">{arrow}</span>
      </button>
    </th>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────

interface ResourceRowProps {
  row: ListResourceRow;
  selected: boolean;
  onToggleSelect: () => void;
  resolveTypologyLabel: (key: string | null) => string;
  onRenameResource: (id: string, newNameEs: string) => Promise<void>;
  onChangeStatus: (id: string, newStatus: ListResourceRow['publicationStatus']) => Promise<void>;
  onOpenEdit: (id: string) => void;
  onOpenPreview: (id: string, slug: string) => void;
  onDuplicate: (id: string) => Promise<void>;
  onViewHistory: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}

function ResourceRow({
  row,
  selected,
  onToggleSelect,
  resolveTypologyLabel,
  onRenameResource,
  onChangeStatus,
  onOpenEdit,
  onOpenPreview,
  onDuplicate,
  onViewHistory,
  onDelete,
}: ResourceRowProps) {
  const [editingName, setEditingName] = useState(false);

  // Nombre principal legible: ES preferente, GL fallback
  const displayName = row.nameEs || row.nameGl || '(sin nombre)';

  // Subtítulo: municipio (nombre legible, NO slug — decisión bug #1)
  const subtitle = row.municipalityName ?? '—';

  return (
    <tr className={`list-row ${selected ? 'is-selected' : ''}`}>
      <td className="list-td-select">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Seleccionar ${displayName}`}
        />
      </td>

      <td className="list-td-name">
        {editingName ? (
          <InlineNameEditor
            initialValue={row.nameEs}
            onSave={async (newName) => {
              await onRenameResource(row.id, newName);
              setEditingName(false);
            }}
            onCancel={() => setEditingName(false)}
          />
        ) : (
          <>
            <button
              type="button"
              className="list-td-name-button"
              onDoubleClick={() => setEditingName(true)}
              onClick={() => onOpenEdit(row.id)}
              title="Clic: editar ficha · Doble clic: renombrar rápido"
            >
              {displayName}
            </button>
            <div className="list-td-name-sub">{subtitle}</div>
          </>
        )}
      </td>

      <td>
        {row.singleTypeVocabulary ? (
          <span className="list-typology-chip">
            {resolveTypologyLabel(row.singleTypeVocabulary)}
          </span>
        ) : (
          <span className="muted">—</span>
        )}
      </td>

      <td>{row.municipalityName ?? <span className="muted">—</span>}</td>

      <td>
        <StatusBadge
          status={row.publicationStatus}
          scheduledAt={row.scheduledPublishAt}
          onChangeStatus={async (newStatus) => {
            await onChangeStatus(row.id, newStatus);
          }}
        />
      </td>

      <td>
        <LanguageChips
          es={row.hasLangEs}
          gl={row.hasLangGl}
          en={row.hasLangEn}
          fr={row.hasLangFr}
          pt={row.hasLangPt}
        />
      </td>

      <td>
        <MapChip visibleOnMap={row.visibleOnMap} hasCoordinates={row.hasCoordinates} />
      </td>

      <td>
        <QualityBadge score={row.qualityScore} pidMissing={row.pidMissingRequired} />
      </td>

      <td>
        <div className="list-td-updated">
          <div>{formatUpdatedAt(row.updatedAt)}</div>
          {row.lastEditorEmail && (
            <div className="list-td-updated-author muted">{row.lastEditorEmail}</div>
          )}
          {row.publicationStatus === 'programado' && row.scheduledPublishAt && (
            <div className="list-td-scheduled-info">
              📅 {formatScheduleForDisplay(row.scheduledPublishAt)} · {timeUntilSchedule(row.scheduledPublishAt)}
            </div>
          )}
        </div>
      </td>

      <td className="list-td-actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => onOpenEdit(row.id)}
        >
          Editar
        </button>
        <RowActionsMenu
          row={row}
          onPreview={() => onOpenPreview(row.id, row.slug)}
          onDuplicate={() => onDuplicate(row.id)}
          onChangeStatus={(s) => onChangeStatus(row.id, s)}
          onViewHistory={() => onViewHistory(row.id)}
          onDelete={() => onDelete(row.id, displayName)}
        />
      </td>
    </tr>
  );
}
