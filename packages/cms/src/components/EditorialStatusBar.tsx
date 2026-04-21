import { useState } from 'react';
import { useConfirm } from './ConfirmDialog';

/**
 * EditorialStatusBar — Barra visual del flujo editorial de un recurso.
 *
 * Muestra los 4 estados (borrador → revision → publicado → archivado) en
 * formato horizontal tipo Kanban, resalta el estado actual y ofrece botones
 * de transicion segun las reglas definidas.
 */

// Paso 7b · t4 — 'programado' añadido tras la migración 025. Se
// representa en el kanban igual que 'revision' (estado intermedio) pero
// no tiene transiciones disponibles en el bar: el cron lo pasa a
// 'publicado' automáticamente y desde el paso 7b el editor puede
// volverlo a 'borrador' si cambia de opinión.
export const STATES = ['borrador', 'revision', 'programado', 'publicado', 'archivado'] as const;
export type EditorialState = typeof STATES[number];

const STATE_LABELS: Record<EditorialState, string> = {
  borrador:   'Borrador',
  revision:   'En revision',
  programado: 'Programado',
  publicado:  'Publicado',
  archivado:  'Archivado',
};

const STATE_ICONS: Record<EditorialState, string> = {
  borrador:   '✏️',
  revision:   '👀',
  programado: '⏰',
  publicado:  '🌐',
  archivado:  '📦',
};

const STATE_DESCRIPTIONS: Record<EditorialState, string> = {
  borrador:   'En edicion, no visible en la web',
  revision:   'Pendiente de aprobacion editorial',
  programado: 'Pendiente de publicacion automatica',
  publicado:  'Visible en la web publica',
  archivado:  'Retirado, no visible',
};

export const STATE_TRANSITIONS: Record<EditorialState, { target: EditorialState; label: string; primary?: boolean }[]> = {
  borrador:   [{ target: 'revision', label: 'Enviar a revision', primary: true }],
  revision:   [
    { target: 'publicado', label: 'Aprobar y publicar', primary: true },
    { target: 'borrador', label: 'Devolver a borrador' },
  ],
  programado: [
    { target: 'borrador', label: 'Cancelar programación' },
  ],
  publicado:  [{ target: 'archivado', label: 'Archivar' }],
  archivado:  [{ target: 'borrador', label: 'Reactivar' }],
};

interface EditorialStatusBarProps {
  currentStatus: EditorialState;
  publishedAt?: string | null;
  /** Called when user requests a status transition */
  onTransition: (newStatus: EditorialState) => Promise<void>;
  /** Disable transitions (e.g. while saving) */
  disabled?: boolean;
}

export function EditorialStatusBar({ currentStatus, publishedAt, onTransition, disabled }: EditorialStatusBarProps) {
  const confirm = useConfirm();
  const [transitioning, setTransitioning] = useState<string | null>(null);
  const transitions = STATE_TRANSITIONS[currentStatus] || [];

  async function handleClick(target: EditorialState, label: string) {
    if (disabled || transitioning) return;
    const ok = await confirm({
      title: `${label}?`,
      message: target === 'publicado'
        ? 'El recurso sera visible para todos los visitantes del portal publico.'
        : `El estado del recurso pasara a "${target}".`,
      confirmLabel: label,
      variant: target === 'publicado' ? 'default' : target === 'archivado' ? 'warning' : 'default',
    });
    if (!ok) return;
    setTransitioning(target);
    try {
      await onTransition(target);
    } finally {
      setTransitioning(null);
    }
  }

  const currentIndex = STATES.indexOf(currentStatus);

  return (
    <div className="editorial-bar">
      <div className="editorial-bar__header">
        <div>
          <span className="editorial-bar__label">Estado del recurso</span>
          <h3 className="editorial-bar__title">
            {STATE_ICONS[currentStatus]} {STATE_LABELS[currentStatus]}
          </h3>
          <p className="editorial-bar__desc">{STATE_DESCRIPTIONS[currentStatus]}</p>
          {publishedAt && currentStatus === 'publicado' && (
            <p className="editorial-bar__published">
              Publicado el {new Date(publishedAt).toLocaleDateString('es-ES', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>
          )}
        </div>
        <div className="editorial-bar__actions">
          {transitions.map((t) => (
            <button
              key={t.target}
              type="button"
              className={`btn ${t.primary ? 'btn-primary' : 'btn-outline'} btn-sm`}
              onClick={() => handleClick(t.target, t.label)}
              disabled={disabled || !!transitioning}
            >
              {transitioning === t.target ? '...' : t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Kanban-style flow */}
      <div className="editorial-bar__flow">
        {STATES.map((state, i) => {
          const isPast = i < currentIndex && currentStatus !== 'archivado';
          const isCurrent = state === currentStatus;
          const isArchivedPath = currentStatus === 'archivado';

          return (
            <div
              key={state}
              className={[
                'editorial-bar__step',
                isCurrent && 'editorial-bar__step--current',
                isPast && 'editorial-bar__step--past',
                isArchivedPath && state !== 'archivado' && 'editorial-bar__step--muted',
              ].filter(Boolean).join(' ')}
            >
              <span className="editorial-bar__step-icon">{STATE_ICONS[state]}</span>
              <span className="editorial-bar__step-label">{STATE_LABELS[state]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
