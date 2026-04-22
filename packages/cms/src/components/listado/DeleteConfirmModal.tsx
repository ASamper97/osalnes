/**
 * DeleteConfirmModal — confirmación de eliminación
 *
 * Incluye 3 botones: Cancelar / Archivar (alternativa segura) / Eliminar.
 * Decisión UX: siempre ofrecer archivar como escape seguro antes de borrar.
 */

import { useEffect, useRef } from 'react';
import { LIST_COPY } from '../../pages/listado.copy';

const COPY = LIST_COPY.deleteModal;

export interface DeleteConfirmModalProps {
  resourceName: string;
  onConfirmDelete: () => Promise<void>;
  onArchiveInstead: () => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export default function DeleteConfirmModal({
  resourceName,
  onConfirmDelete,
  onArchiveInstead,
  onCancel,
  loading = false,
}: DeleteConfirmModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', handler);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel, loading]);

  return (
    <div
      className="list-delete-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel(); }}
    >
      <div
        ref={dialogRef}
        className="list-delete-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
        tabIndex={-1}
      >
        <header>
          <h2 id="delete-modal-title">{COPY.title}</h2>
        </header>
        <div className="list-delete-modal-body">
          <p>{COPY.body.replace('{name}', resourceName)}</p>
        </div>
        <footer className="list-delete-modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={loading}>
            {COPY.cancelButton}
          </button>
          <button
            type="button"
            className="btn btn-warning"
            onClick={() => void onArchiveInstead()}
            disabled={loading}
          >
            {COPY.archiveInsteadButton}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => void onConfirmDelete()}
            disabled={loading}
          >
            {loading ? '…' : COPY.confirmButton}
          </button>
        </footer>
      </div>
    </div>
  );
}
