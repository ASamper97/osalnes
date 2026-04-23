/**
 * ConfirmToggleDialog — confirmación de soft-delete / reactivación
 *
 * Decisión 6-C: no se borra, solo se cambia is_active. El body del
 * modal es contextual: distinto cuando se desactiva vs cuando se
 * reactiva, y el mensaje de desactivación incluye el nº de recursos
 * que mantendrán la referencia.
 */

import { useEffect } from 'react';
import { TAXONOMIES_COPY, interpolateTx } from '../../pages/taxonomies.copy';

const COPY = TAXONOMIES_COPY.confirmToggle;

export interface ConfirmToggleDialogProps {
  termName: string;
  usageCount: number;
  isActivating: boolean;  // true = se va a activar; false = se va a desactivar
  confirming: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export default function ConfirmToggleDialog({
  termName, usageCount, isActivating, confirming, onConfirm, onClose,
}: ConfirmToggleDialogProps) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirming) onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [confirming, onClose]);

  return (
    <div
      className="taxo-confirm-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !confirming) onClose(); }}
    >
      <div className="taxo-confirm-dialog" role="dialog" aria-modal="true">
        <header>
          <h2>{isActivating ? COPY.activateTitle : COPY.deactivateTitle}</h2>
        </header>

        <div className="taxo-confirm-body">
          <p className="taxo-confirm-term">
            <strong>{termName}</strong>
          </p>
          <p>
            {isActivating
              ? COPY.activateBody
              : interpolateTx(COPY.deactivateBody, { count: usageCount })}
          </p>
        </div>

        <footer>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={confirming}
          >
            {COPY.cancelButton}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void onConfirm()}
            disabled={confirming}
          >
            {confirming ? '…' : COPY.confirmButton}
          </button>
        </footer>
      </div>
    </div>
  );
}
