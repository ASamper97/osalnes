import type { ReactNode } from 'react';

/**
 * EmptyState — Estado vacio amistoso reutilizable
 *
 * Reemplaza los "Sin elementos" planos por una experiencia bonita
 * con icono grande, titulo, descripcion y CTA opcional.
 */

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  /** Optional call-to-action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Secondary action (less prominent) */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Show a smaller variant for inline use inside cards/sections */
  variant?: 'default' | 'inline';
  children?: ReactNode;
}

export function EmptyState({
  icon = '📭',
  title,
  description,
  action,
  secondaryAction,
  variant = 'default',
  children,
}: EmptyStateProps) {
  return (
    <div className={`empty-state empty-state--${variant}`}>
      <div className="empty-state__icon">{icon}</div>
      <h3 className="empty-state__title">{title}</h3>
      {description && <p className="empty-state__desc">{description}</p>}
      {children}
      {(action || secondaryAction) && (
        <div className="empty-state__actions">
          {action && (
            <button type="button" className="btn btn-primary" onClick={action.onClick}>
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button type="button" className="btn" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
