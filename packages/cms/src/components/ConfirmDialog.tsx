import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

/**
 * ConfirmDialog — Modal de confirmacion bonito que reemplaza confirm() nativo
 *
 * Uso:
 *   const confirm = useConfirm();
 *   const ok = await confirm({
 *     title: 'Eliminar recurso?',
 *     message: 'Esta accion no se puede deshacer.',
 *     confirmLabel: 'Eliminar',
 *     variant: 'danger',
 *   });
 *   if (ok) { ... }
 *
 * Hay que envolver la app con <ConfirmProvider>.
 */

export interface ConfirmOptions {
  title: string;
  message?: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger' | 'warning';
  icon?: string;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (state) {
      state.resolve(true);
      setState(null);
    }
  }, [state]);

  const handleCancel = useCallback(() => {
    if (state) {
      state.resolve(false);
      setState(null);
    }
  }, [state]);

  // ESC closes (cancel), Enter confirms
  useEffect(() => {
    if (!state) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleCancel();
      else if (e.key === 'Enter') handleConfirm();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, handleConfirm, handleCancel]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (state) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [state]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <ConfirmModal
          options={state}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Fallback to native confirm if provider missing (defensive)
    return async (options: ConfirmOptions) => {
      // eslint-disable-next-line no-alert
      return window.confirm(typeof options.message === 'string' ? options.message : options.title);
    };
  }
  return ctx.confirm;
}

// ---------------------------------------------------------------------------
// Modal component
// ---------------------------------------------------------------------------

interface ConfirmModalProps {
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_ICONS: Record<string, string> = {
  default: '❓',
  danger: '⚠️',
  warning: '⚠️',
};

function ConfirmModal({ options, onConfirm, onCancel }: ConfirmModalProps) {
  const variant = options.variant || 'default';
  const icon = options.icon || VARIANT_ICONS[variant];

  return (
    <>
      <div className="confirm-backdrop" onClick={onCancel} role="presentation" />
      <div
        className={`confirm-modal confirm-modal--${variant}`}
        role="dialog"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
      >
        <div className="confirm-modal__icon">{icon}</div>
        <h2 id="confirm-title" className="confirm-modal__title">{options.title}</h2>
        {options.message && (
          <div id="confirm-message" className="confirm-modal__message">
            {options.message}
          </div>
        )}
        <div className="confirm-modal__actions">
          <button
            type="button"
            className="btn"
            onClick={onCancel}
            autoFocus={variant === 'danger'}
          >
            {options.cancelLabel || 'Cancelar'}
          </button>
          <button
            type="button"
            className={`btn ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            autoFocus={variant !== 'danger'}
          >
            {options.confirmLabel || 'Confirmar'}
          </button>
        </div>
      </div>
    </>
  );
}
