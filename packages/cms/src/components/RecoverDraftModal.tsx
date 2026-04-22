/**
 * RecoverDraftModal — modal que aparece al abrir el wizard si se
 * detectan cambios no guardados en localStorage de una sesión previa.
 *
 * Escenarios donde aparece:
 *   - El funcionario cerró el navegador con cambios pendientes y estaba
 *     offline (no llegó a sincronizar).
 *   - Crasheó Chrome durante la edición.
 *   - El navegador se reinició y la pestaña se restauró.
 *
 * Da dos opciones:
 *   - "Recuperar cambios" → cargar los datos de localStorage en el estado.
 *   - "Descartar" → borrar localStorage y seguir con lo que hay en BD.
 *
 * Nunca aparece si no hay datos locales que recuperar.
 */

import { useEffect, useRef } from 'react';

export interface RecoverDraftModalProps {
  /** Fecha ISO del autosave local encontrado */
  localSavedAt: string;
  /** Fecha ISO del último save en BD (puede ser null si recurso nuevo) */
  remoteSavedAt: string | null;
  /** Recuperar los datos locales */
  onRecover: () => void;
  /** Descartar los datos locales y seguir con BD */
  onDiscard: () => void;
}

export default function RecoverDraftModal({
  localSavedAt,
  remoteSavedAt,
  onRecover,
  onDiscard,
}: RecoverDraftModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div className="recover-modal-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="recover-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recover-modal-title"
        tabIndex={-1}
      >
        <header className="recover-modal-head">
          <span className="recover-modal-icon" aria-hidden>💾</span>
          <h2 id="recover-modal-title">Cambios no guardados en sesión anterior</h2>
        </header>

        <div className="recover-modal-body">
          <p>
            Parece que cerraste el navegador antes de que se guardara tu trabajo.
            Hemos encontrado cambios locales sin sincronizar.
          </p>

          <dl className="recover-modal-meta">
            <div>
              <dt>Cambios locales</dt>
              <dd>{formatDate(localSavedAt)}</dd>
            </div>
            <div>
              <dt>Última versión guardada</dt>
              <dd>{remoteSavedAt ? formatDate(remoteSavedAt) : 'Sin versión anterior (recurso nuevo)'}</dd>
            </div>
          </dl>

          <p className="recover-modal-question">
            ¿Quieres recuperar los cambios locales o empezar con la última versión guardada?
          </p>
        </div>

        <footer className="recover-modal-foot">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onDiscard}
          >
            Descartar cambios locales
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onRecover}
          >
            Recuperar mis cambios
          </button>
        </footer>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
