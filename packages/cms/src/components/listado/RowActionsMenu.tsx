/**
 * RowActionsMenu — menú "..." con acciones secundarias de cada fila
 *
 * Acciones:
 *   - Ver vista previa (abre página pública del recurso)
 *   - Duplicar recurso (decisión 4-A)
 *   - Cambiar estado (submenú)
 *   - Ver historial (navega al paso 7 con el panel de audit log)
 *   - Eliminar (con confirmación modal en el padre)
 */

import { useState } from 'react';
import type { ListResourceRow } from '@osalnes/shared/data/resources-list';
import { LIST_COPY } from '../../pages/listado.copy';

const COPY = LIST_COPY.rowActions;

type Status = ListResourceRow['publicationStatus'];

export interface RowActionsMenuProps {
  row: ListResourceRow;
  onPreview: () => void;
  onDuplicate: () => Promise<void>;
  onChangeStatus: (newStatus: Status) => Promise<void>;
  onViewHistory: () => void;
  onDelete: () => void;
}

export default function RowActionsMenu({
  row,
  onPreview,
  onDuplicate,
  onChangeStatus,
  onViewHistory,
  onDelete,
}: RowActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleClose = () => setOpen(false);

  const handleDuplicate = async () => {
    setBusy(true);
    try {
      await onDuplicate();
    } finally {
      setBusy(false);
      handleClose();
    }
  };

  const handleChangeStatus = async (next: Status) => {
    setBusy(true);
    try {
      await onChangeStatus(next);
    } finally {
      setBusy(false);
      handleClose();
    }
  };

  return (
    <div className="list-row-menu-wrap">
      <button
        type="button"
        className="list-row-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label={COPY.moreMenu}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={busy}
      >
        ⋯
      </button>

      {open && (
        <>
          <div className="list-row-menu-backdrop" onClick={handleClose} />
          <div className="list-row-menu" role="menu">
            <MenuItem icon="👁" label={COPY.preview} onClick={() => { onPreview(); handleClose(); }} />
            <MenuItem icon="📋" label={COPY.duplicate} onClick={() => void handleDuplicate()} />

            <div className="list-row-menu-divider" />

            {row.publicationStatus !== 'publicado' && (
              <MenuItem
                icon="🚀"
                label={COPY.statusPublish}
                onClick={() => void handleChangeStatus('publicado')}
              />
            )}
            {row.publicationStatus === 'publicado' && (
              <MenuItem
                icon="📥"
                label={COPY.statusUnpublish}
                onClick={() => void handleChangeStatus('borrador')}
              />
            )}
            {row.publicationStatus !== 'archivado' && (
              <MenuItem
                icon="🗄"
                label={COPY.statusArchive}
                onClick={() => void handleChangeStatus('archivado')}
              />
            )}
            {row.publicationStatus === 'archivado' && (
              <MenuItem
                icon="↩"
                label={COPY.statusRestore}
                onClick={() => void handleChangeStatus('borrador')}
              />
            )}

            <div className="list-row-menu-divider" />

            <MenuItem icon="📜" label={COPY.viewHistory} onClick={() => { onViewHistory(); handleClose(); }} />

            <div className="list-row-menu-divider" />

            <MenuItem
              icon="🗑"
              label={COPY.delete}
              danger
              onClick={() => { onDelete(); handleClose(); }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={`list-row-menu-item ${danger ? 'is-danger' : ''}`}
      onClick={onClick}
      role="menuitem"
    >
      <span className="list-row-menu-icon" aria-hidden>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
