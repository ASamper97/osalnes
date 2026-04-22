/**
 * SavedViewsMenu — menú de vistas guardadas
 *
 * Dropdown con:
 *   - Lista de vistas del usuario (con estrella ★ si es default)
 *   - Al seleccionar, aplica filtros + orden + tamaño
 *   - Botón "Guardar vista actual" (abre modal que pide nombre)
 *   - Botón eliminar (×) por cada vista con confirmación
 *
 * Decisión 6-A del usuario.
 */

import { useState } from 'react';
import type { SavedView } from '@osalnes/shared/data/resources-list-b';

export interface SavedViewsMenuProps {
  views: SavedView[];
  loading: boolean;
  error: string | null;

  /** Aplicar vista al listado */
  onApplyView: (view: SavedView) => void;

  /** Abrir modal de guardar nueva vista */
  onOpenSaveDialog: () => void;

  /** Eliminar vista (con confirmación simple) */
  onDeleteView: (id: string) => Promise<void>;
}

export default function SavedViewsMenu({
  views,
  loading,
  error,
  onApplyView,
  onOpenSaveDialog,
  onDeleteView,
}: SavedViewsMenuProps) {
  const [open, setOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleApply = (view: SavedView) => {
    onApplyView(view);
    setOpen(false);
  };

  const handleDelete = async (e: React.MouseEvent, view: SavedView) => {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar la vista "${view.name}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    setDeletingId(view.id);
    try {
      await onDeleteView(view.id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="saved-views-menu-wrap">
      <button
        type="button"
        className={`saved-views-menu-trigger ${views.length > 0 ? 'has-views' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        ★ Vistas{views.length > 0 ? ` (${views.length})` : ''} ▾
      </button>

      {open && (
        <>
          <div className="saved-views-menu-backdrop" onClick={() => setOpen(false)} />
          <div className="saved-views-menu" role="menu">
            <div className="saved-views-menu-head">
              <strong>Vistas guardadas</strong>
            </div>

            {loading && <div className="saved-views-menu-state muted">Cargando…</div>}
            {error && (
              <div className="saved-views-menu-state saved-views-menu-error">
                ⚠️ {error}
              </div>
            )}
            {!loading && !error && views.length === 0 && (
              <div className="saved-views-menu-state muted">
                Aún no tienes vistas guardadas.
              </div>
            )}

            {!loading && !error && views.length > 0 && (
              <ul className="saved-views-menu-list" role="list">
                {views.map((view) => (
                  <li key={view.id} className="saved-views-menu-item">
                    <button
                      type="button"
                      className="saved-views-menu-item-body"
                      onClick={() => handleApply(view)}
                      role="menuitem"
                    >
                      <span className="saved-views-menu-item-icon" aria-hidden>
                        {view.isDefault ? '★' : '☆'}
                      </span>
                      <span className="saved-views-menu-item-name">{view.name}</span>
                      {view.isDefault && (
                        <span className="saved-views-menu-item-default">por defecto</span>
                      )}
                    </button>
                    <button
                      type="button"
                      className="saved-views-menu-item-delete"
                      onClick={(e) => void handleDelete(e, view)}
                      disabled={deletingId === view.id}
                      aria-label={`Eliminar vista ${view.name}`}
                    >
                      {deletingId === view.id ? '…' : '×'}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="saved-views-menu-divider" />

            <button
              type="button"
              className="saved-views-menu-save"
              onClick={() => {
                setOpen(false);
                onOpenSaveDialog();
              }}
              role="menuitem"
            >
              + Guardar vista actual
            </button>
          </div>
        </>
      )}
    </div>
  );
}
