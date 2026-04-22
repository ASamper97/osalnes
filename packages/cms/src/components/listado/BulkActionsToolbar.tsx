/**
 * BulkActionsToolbar — toolbar flotante con acciones masivas
 *
 * Aparece en la parte inferior de la pantalla cuando hay ≥1 recurso
 * seleccionado. Estilo sticky para no perderse al scrollear.
 *
 * Acciones:
 *   - Publicar seleccionados
 *   - Despublicar (→ draft)
 *   - Archivar
 *   - Exportar CSV
 *   - Eliminar (con modal de confirmación masiva)
 *   - "Deseleccionar todo" para salir
 */

import { useState } from 'react';

export interface BulkActionsToolbarProps {
  selectedCount: number;
  onPublish: () => Promise<void>;
  onUnpublish: () => Promise<void>;
  onArchive: () => Promise<void>;
  onExport: () => void;
  onDelete: () => void;
  onClearSelection: () => void;
}

export default function BulkActionsToolbar({
  selectedCount,
  onPublish,
  onUnpublish,
  onArchive,
  onExport,
  onDelete,
  onClearSelection,
}: BulkActionsToolbarProps) {
  const [busyAction, setBusyAction] = useState<'publish' | 'unpublish' | 'archive' | null>(null);

  const run = async (
    kind: 'publish' | 'unpublish' | 'archive',
    fn: () => Promise<void>,
  ) => {
    setBusyAction(kind);
    try {
      await fn();
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="bulk-toolbar" role="toolbar" aria-label="Acciones sobre recursos seleccionados">
      <div className="bulk-toolbar-count">
        <span className="bulk-toolbar-count-number">{selectedCount}</span>
        <span className="bulk-toolbar-count-label">
          {selectedCount === 1 ? 'recurso seleccionado' : 'recursos seleccionados'}
        </span>
      </div>

      <div className="bulk-toolbar-actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm bulk-action-publish"
          onClick={() => void run('publish', onPublish)}
          disabled={busyAction !== null}
          aria-label="Publicar los seleccionados"
        >
          🚀 Publicar {busyAction === 'publish' && '…'}
        </button>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => void run('unpublish', onUnpublish)}
          disabled={busyAction !== null}
          aria-label="Despublicar los seleccionados"
        >
          📥 Despublicar {busyAction === 'unpublish' && '…'}
        </button>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => void run('archive', onArchive)}
          disabled={busyAction !== null}
          aria-label="Archivar los seleccionados"
        >
          🗄 Archivar {busyAction === 'archive' && '…'}
        </button>

        <div className="bulk-toolbar-divider" aria-hidden />

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onExport}
          disabled={busyAction !== null}
          aria-label="Exportar los seleccionados a CSV"
        >
          📄 Exportar CSV
        </button>

        <button
          type="button"
          className="btn btn-ghost btn-sm bulk-action-delete"
          onClick={onDelete}
          disabled={busyAction !== null}
          aria-label="Eliminar los seleccionados"
        >
          🗑 Eliminar
        </button>
      </div>

      <button
        type="button"
        className="bulk-toolbar-close"
        onClick={onClearSelection}
        disabled={busyAction !== null}
        aria-label="Deseleccionar todo"
      >
        ×
      </button>
    </div>
  );
}
