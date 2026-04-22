import { useState, useCallback, type ReactNode } from 'react';

/* ==========================================================================
   Wizard Engine — Motor reutilizable de asistentes paso a paso
   "Guía burros" para el CMS de O Salnés
   ========================================================================== */

export interface WizardStepDef {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  /** Contextual help shown in the step header */
  help?: string;
  /** Fields that must pass validation before advancing */
  validate?: () => string[];
  /** Whether step can be skipped (optional steps) */
  optional?: boolean;
}

interface WizardProps {
  steps: WizardStepDef[];
  /** Currently active step index (controlled) */
  currentStep: number;
  onStepChange: (step: number) => void;
  /** Render the content for each step */
  children: ReactNode;
  /** Called when user clicks "Finalizar" on the last step */
  onFinish: () => void;
  /** Show saving state on final button */
  saving?: boolean;
  /** Title shown at the top of the wizard */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Label for the final "Finish" button */
  finishLabel?: string;
  /** Callback when user cancels */
  onCancel?: () => void;
  /**
   * Wizard global · t2 — cuando true, el Wizard no renderiza su propio
   * header/progress-bar/stepper. El padre (ResourceWizardPage) monta
   * `<WizardStepper>` + `<AutoSaveIndicator>` arriba y pasa esta flag
   * para evitar la doble-UI. El stepper legacy (cuadraditos ✓ estáticos
   * + progress bar del 86%) queda disponible por defecto para el resto
   * de wizards que aún lo usan.
   */
  hideDefaultStepper?: boolean;
}

export function Wizard({
  steps,
  currentStep,
  onStepChange,
  children,
  onFinish,
  saving = false,
  title,
  subtitle,
  finishLabel = 'Finalizar',
  onCancel,
  hideDefaultStepper = false,
}: WizardProps) {
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;
  const step = steps[currentStep];

  const completedSteps = steps.map((s, i) => {
    if (i < currentStep) return true;
    return false;
  });

  const progressPercent = Math.round(((currentStep) / steps.length) * 100);

  const goNext = useCallback(() => {
    setValidationErrors([]);
    if (step.validate) {
      const errs = step.validate();
      if (errs.length > 0) {
        setValidationErrors(errs);
        return;
      }
    }
    if (!isLast) {
      onStepChange(currentStep + 1);
    }
  }, [step, isLast, currentStep, onStepChange]);

  const goPrev = useCallback(() => {
    setValidationErrors([]);
    if (!isFirst) {
      onStepChange(currentStep - 1);
    }
  }, [isFirst, currentStep, onStepChange]);

  const goToStep = useCallback((index: number) => {
    // Only allow going to completed steps or the next one
    if (index <= currentStep) {
      setValidationErrors([]);
      onStepChange(index);
    }
  }, [currentStep, onStepChange]);

  const handleFinish = useCallback(() => {
    setValidationErrors([]);
    if (step.validate) {
      const errs = step.validate();
      if (errs.length > 0) {
        setValidationErrors(errs);
        return;
      }
    }
    onFinish();
  }, [step, onFinish]);

  return (
    <div className="wizard">
      {/* Header / progress / stepper legacy — se omite cuando el padre
          (ResourceWizardPage) monta su propio `<WizardStepper>` global
          encima. Ver wizard-global · t2. */}
      {!hideDefaultStepper && (
        <>
          <div className="wizard__header">
            <div className="wizard__header-text">
              <h1 className="wizard__title">{title}</h1>
              {subtitle && <p className="wizard__subtitle">{subtitle}</p>}
            </div>
            {onCancel && (
              <button type="button" className="btn" onClick={onCancel}>
                Cancelar
              </button>
            )}
          </div>

          {/* Progress bar */}
          <div className="wizard__progress">
            <div className="wizard__progress-bar">
              <div
                className="wizard__progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="wizard__progress-label">
              Paso {currentStep + 1} de {steps.length} — {progressPercent}%
            </span>
          </div>

          {/* Stepper */}
          <div className="wizard__stepper">
            {steps.map((s, i) => {
              const isCurrent = i === currentStep;
              const isCompleted = completedSteps[i];
              const isClickable = i <= currentStep;

              return (
                <button
                  key={s.id}
                  type="button"
                  className={[
                    'wizard__step-dot',
                    isCurrent && 'wizard__step-dot--active',
                    isCompleted && 'wizard__step-dot--completed',
                    !isClickable && 'wizard__step-dot--locked',
                  ].filter(Boolean).join(' ')}
                  onClick={() => goToStep(i)}
                  disabled={!isClickable}
                  title={s.title}
                >
                  <span className="wizard__step-icon">
                    {isCompleted ? '✓' : s.icon}
                  </span>
                  <span className="wizard__step-label">{s.title}</span>
                  {s.optional && <span className="wizard__step-optional">opcional</span>}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Step header with contextual help */}
      <div className="wizard__step-header">
        <div className="wizard__step-header-icon">{step.icon}</div>
        <div>
          <h2 className="wizard__step-title">{step.title}</h2>
          {step.subtitle && <p className="wizard__step-subtitle">{step.subtitle}</p>}
        </div>
      </div>

      {step.help && (
        <div className="wizard__help">
          <span className="wizard__help-icon">?</span>
          <p>{step.help}</p>
        </div>
      )}

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="alert alert-error wizard__errors">
          <strong>Antes de continuar, corrige lo siguiente:</strong>
          <ul>
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Step content */}
      <div className="wizard__body">
        {children}
      </div>

      {/* Navigation buttons */}
      <div className="wizard__nav">
        <div className="wizard__nav-left">
          {!isFirst && (
            <button type="button" className="btn wizard__btn-prev" onClick={goPrev}>
              ← Anterior
            </button>
          )}
        </div>
        <div className="wizard__nav-right">
          {step.optional && !isLast && (
            <button
              type="button"
              className="btn"
              onClick={() => onStepChange(currentStep + 1)}
            >
              Saltar paso
            </button>
          )}
          {isLast ? (
            <button
              type="button"
              className="btn btn-primary wizard__btn-finish"
              onClick={handleFinish}
              disabled={saving}
            >
              {saving ? 'Guardando...' : finishLabel}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary wizard__btn-next"
              onClick={goNext}
            >
              Siguiente →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   WizardFieldGroup — Agrupa campos con titulo, descripcion y ayuda contextual
   ========================================================================== */

interface WizardFieldGroupProps {
  title: string;
  description?: string;
  tip?: string;
  required?: boolean;
  children: ReactNode;
}

export function WizardFieldGroup({ title, description, tip, required, children }: WizardFieldGroupProps) {
  return (
    <div className="wizard__field-group">
      <div className="wizard__field-group-header">
        <h3 className="wizard__field-group-title">
          {title}
          {required && <span className="wizard__required">*</span>}
        </h3>
        {description && <p className="wizard__field-group-desc">{description}</p>}
      </div>
      {children}
      {tip && (
        <div className="wizard__tip">
          <span className="wizard__tip-icon">💡</span>
          <span>{tip}</span>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   WizardCompletionCard — Muestra el resumen de datos en el paso de revision
   ========================================================================== */

interface CompletionItem {
  label: string;
  value: string | ReactNode;
  status?: 'complete' | 'incomplete' | 'warning';
}

interface WizardCompletionCardProps {
  title: string;
  icon: string;
  items: CompletionItem[];
  onEdit?: () => void;
}

export function WizardCompletionCard({ title, icon, items, onEdit }: WizardCompletionCardProps) {
  const allComplete = items.every((i) => i.status !== 'incomplete');
  const hasWarnings = items.some((i) => i.status === 'warning');

  return (
    <div className={`wizard__completion-card ${!allComplete ? 'wizard__completion-card--incomplete' : ''} ${hasWarnings ? 'wizard__completion-card--warning' : ''}`}>
      <div className="wizard__completion-card-header">
        <span className="wizard__completion-card-icon">{icon}</span>
        <h4>{title}</h4>
        {allComplete && <span className="wizard__completion-check">✓</span>}
        {onEdit && (
          <button type="button" className="btn btn-sm" onClick={onEdit}>
            Editar
          </button>
        )}
      </div>
      <div className="wizard__completion-card-body">
        {items.map((item, i) => (
          <div key={i} className={`wizard__completion-item wizard__completion-item--${item.status || 'complete'}`}>
            <span className="wizard__completion-item-label">{item.label}</span>
            <span className="wizard__completion-item-value">{item.value || <em>Sin rellenar</em>}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
