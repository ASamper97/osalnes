/**
 * StatusBadge — badge de estado editable inline (decisión 5-A/5-B)
 *
 * Clic en el badge abre un pequeño dropdown con las transiciones
 * posibles desde el estado actual, según las reglas de canTransition().
 *
 * Estados disponibles:
 *   - draft, published, scheduled, archived, in_review
 */

import { useState } from 'react';
import type { ListResourceRow } from '@osalnes/shared/data/resources-list';
import { LIST_COPY } from '../../pages/listado.copy';

const COPY = LIST_COPY.statusLabels;

type Status = ListResourceRow['publicationStatus'];

export interface StatusBadgeProps {
  status: Status;
  scheduledAt: string | null;
  onChangeStatus: (newStatus: Status) => Promise<void>;
}

export default function StatusBadge({ status, scheduledAt, onChangeStatus }: StatusBadgeProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const possibleTransitions = getPossibleTransitions(status);

  const handleChange = async (next: Status) => {
    setLoading(true);
    try {
      await onChangeStatus(next);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="list-status-wrap">
      <button
        type="button"
        className={`list-status-badge list-status-badge-${status}`}
        onClick={() => setOpen((v) => !v)}
        disabled={loading}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {loading ? '⏳' : COPY[status]}
        {status !== 'programado' && ' ▾'}
      </button>

      {open && !loading && (
        <>
          <div className="list-status-backdrop" onClick={() => setOpen(false)} />
          <div className="list-status-menu" role="menu">
            <div className="list-status-menu-label">Cambiar estado a:</div>
            {possibleTransitions.map((next) => (
              <button
                key={next}
                type="button"
                className="list-status-menu-item"
                onClick={() => void handleChange(next)}
                role="menuitem"
              >
                <span className={`list-status-menu-dot list-status-dot-${next}`} aria-hidden />
                {COPY[next]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function getPossibleTransitions(from: Status): Status[] {
  switch (from) {
    case 'borrador':
      return ['publicado', 'revision', 'archivado'];
    case 'revision':
      return ['borrador', 'publicado', 'archivado'];
    case 'publicado':
      return ['borrador', 'archivado'];
    case 'programado':
      return ['borrador', 'publicado']; // cancelar programación o forzar publicación ya
    case 'archivado':
      return ['borrador'];
    default:
      return [];
  }
}
