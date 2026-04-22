/**
 * BulkConfirmModal — confirmación para acciones masivas destructivas
 *
 * Usado para:
 *   - Eliminación masiva (con opción "archivar en vez de eliminar")
 *   - Despublicación masiva de publicados (impacto en web pública)
 *
 * Muestra count + lista de hasta 10 nombres + opción escape.
 */

import { useEffect, useRef } from 'react';

export interface BulkConfirmModalProps {
  title: string;
  body: string;
  /** Lista de nombres (máximo 10 se muestran, resto como "+N más") */
  names: string[];
  confirmLabel: string;
  confirmVariant?: 'primary' | 'danger' | 'warning';
  /** Opcional: botón alternativo seguro (ej. "Archivar en vez de eliminar") */
  alternativeLabel?: string;
  onConfirm: () => Promise<void>;
  onAlternative?: () => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export default function BulkConfirmModal({
  title,
  body,
  names,
  confirmLabel,
  confirmVariant = 'primary',
  alternativeLabel,
  onConfirm,
  onAlternative,
  onCancel,
  loading = false,
}: BulkConfirmModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', handler);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel, loading]);

  const confirmClass =
    confirmVariant === 'danger' ? 'btn-danger'
    : confirmVariant === 'warning' ? 'btn-warning'
    : 'btn-primary';

  const visibleNames = names.slice(0, 10);
  const extra = names.length - visibleNames.length;

  return (
    <div
      className="bulk-confirm-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel(); }}
    >
      <div
        ref={dialogRef}
        className={`bulk-confirm-modal bulk-confirm-${confirmVariant}`}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        <header>
          <h2>{title}</h2>
        </header>
        <div className="bulk-confirm-body">
          <p>{body}</p>

          {names.length > 0 && (
            <ul className="bulk-confirm-names" role="list">
              {visibleNames.map((name, i) => (
                <li key={i}>{name}</li>
              ))}
              {extra > 0 && (
                <li className="bulk-confirm-names-more muted">
                  + {extra} {extra === 1 ? 'más' : 'más'}
                </li>
              )}
            </ul>
          )}
        </div>
        <footer className="bulk-confirm-foot">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          {alternativeLabel && onAlternative && (
            <button
              type="button"
              className="btn btn-warning"
              onClick={() => void onAlternative()}
              disabled={loading}
            >
              {alternativeLabel}
            </button>
          )}
          <button
            type="button"
            className={`btn ${confirmClass}`}
            onClick={() => void onConfirm()}
            disabled={loading}
          >
            {loading ? '…' : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
