/**
 * WizardStepper — stepper superior clickable con estado real por paso
 *
 * Reemplaza el stepper visual actual. Cada paso es un botón con:
 *   - Icono
 *   - Número de paso
 *   - Etiqueta
 *   - Badge "opcional" si aplica
 *   - Estado visual: current / accessible / locked / dirty / complete
 *
 * Al hacer clic en un paso accessible, llama `onNavigate(N)`. Si está
 * locked, muestra tooltip con la razón (ej: "Completa primero el paso 1").
 *
 * Keyboard-accessible: Tab para navegar entre pasos, Enter/Space para
 * activar.
 */

import {
  type WizardStepState,
  WIZARD_STEPS,
  computeProgressPercent,
} from '@osalnes/shared/data/wizard-navigation';

export interface WizardStepperProps {
  /** Estado actual de cada paso (array de 7) */
  stepsState: WizardStepState[];
  /** Paso activo (1-7) */
  currentStep: number;
  /** Callback al pulsar un paso accessible */
  onNavigate: (step: number) => void;
}

export default function WizardStepper({
  stepsState,
  currentStep,
  onNavigate,
}: WizardStepperProps) {
  const progressPercent = computeProgressPercent(currentStep);

  return (
    <nav className="wizard-stepper" aria-label="Pasos del asistente">
      {/* Barra de progreso con % coherente */}
      <div className="wizard-stepper-progress-row">
        <div className="wizard-stepper-progress-bar" aria-hidden>
          <div
            className="wizard-stepper-progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="wizard-stepper-progress-label">
          Paso {currentStep} de {WIZARD_STEPS.length} · <strong>{progressPercent}%</strong>
        </div>
      </div>

      {/* Grid de botones-paso */}
      <ol className="wizard-stepper-list" role="list">
        {stepsState.map((state) => (
          <StepButton
            key={state.key}
            state={state}
            onNavigate={onNavigate}
          />
        ))}
      </ol>
    </nav>
  );
}

// ─── Botón de un paso individual ───────────────────────────────────────

function StepButton({
  state,
  onNavigate,
}: {
  state: WizardStepState;
  onNavigate: (step: number) => void;
}) {
  const def = WIZARD_STEPS.find((s) => s.number === state.number);
  if (!def) return null;

  const handleClick = () => {
    if (state.isAccessible && !state.isCurrent) {
      onNavigate(state.number);
    }
  };

  const classes = [
    'wizard-step',
    state.isCurrent ? 'is-current' : '',
    state.isAccessible ? 'is-accessible' : '',
    state.isLocked ? 'is-locked' : '',
    state.isDirty ? 'is-dirty' : '',
    state.isComplete ? 'is-complete' : '',
  ].filter(Boolean).join(' ');

  // Símbolo según estado
  const symbol = (() => {
    if (state.isCurrent) return state.number;
    if (state.isComplete) return '✓';
    if (state.isLocked) return '🔒';
    return state.number;
  })();

  return (
    <li className="wizard-step-item">
      <button
        type="button"
        className={classes}
        onClick={handleClick}
        disabled={state.isLocked}
        title={state.isLocked ? state.lockReason : `Ir al paso ${state.number}`}
        aria-current={state.isCurrent ? 'step' : undefined}
        aria-label={`Paso ${state.number}: ${def.label}${def.optional ? ' (opcional)' : ''}${state.isLocked ? ` — ${state.lockReason}` : ''}`}
      >
        <span className="wizard-step-indicator" aria-hidden>
          {symbol}
        </span>
        <span className="wizard-step-body">
          <span className="wizard-step-label">{def.label}</span>
          {def.optional && (
            <span className="wizard-step-optional">opcional</span>
          )}
        </span>
        {state.isDirty && (
          <span className="wizard-step-dirty-dot" aria-label="sin guardar" title="Cambios sin guardar" />
        )}
      </button>
    </li>
  );
}
