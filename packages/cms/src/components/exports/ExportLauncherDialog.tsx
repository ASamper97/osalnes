/**
 * ExportLauncherDialog — modal "Nueva exportación" con 3 pasos:
 *   1. Tipo de exportación (PID / Data Lake / CSV / JSON-LD)
 *   2. Alcance (todos publicados / filtrado / seleccionados)
 *   3. Pre-validación + confirmación
 *
 * Decisión 4-A: pre-validación obligatoria — si todo falla, no deja lanzar.
 * Decisión 5-A: muestra errores agrupados con mensaje humano.
 */

import { useEffect, useRef, useState } from 'react';
import {
  type ExportJobType,
  type ExportScopeType,
  type ScopeValidation,
  JOB_TYPE_LABELS,
  JOB_TYPE_ICONS,
  ERROR_CATEGORY_LABELS,
} from '@osalnes/shared/data/exports';
import { EXPORTS_COPY, interpolate } from '../../pages/exports.copy';

const COPY = EXPORTS_COPY.launcher;

const JOB_TYPES: ExportJobType[] = ['pid', 'data_lake', 'csv', 'json_ld'];

export interface ExportLauncherDialogProps {
  /** Filtros "pre-rellenados" si se abrió desde el listado del CMS */
  prefilledFilters?: Record<string, unknown> | null;
  /** IDs pre-rellenados si se abrió desde selección del listado */
  prefilledSelection?: string[] | null;

  onValidate: (params: {
    jobType: ExportJobType;
    scopeType: ExportScopeType;
    scopeFilter?: Record<string, unknown> | null;
    scopeIds?: string[] | null;
  }) => Promise<ScopeValidation>;

  onLaunch: (params: {
    jobType: ExportJobType;
    scopeType: ExportScopeType;
    scopeFilter?: Record<string, unknown> | null;
    scopeIds?: string[] | null;
    notes?: string | null;
  }) => Promise<string>;

  onClose: () => void;
}

type Step = 1 | 2 | 3;

export default function ExportLauncherDialog({
  prefilledFilters,
  prefilledSelection,
  onValidate,
  onLaunch,
  onClose,
}: ExportLauncherDialogProps) {
  const [step, setStep] = useState<Step>(1);
  const [jobType, setJobType] = useState<ExportJobType>('pid');
  const [scopeType, setScopeType] = useState<ExportScopeType>(
    prefilledSelection && prefilledSelection.length > 0 ? 'selected' :
    prefilledFilters ? 'filtered' : 'all_published',
  );
  const [notes, setNotes] = useState('');

  const [validation, setValidation] = useState<ScopeValidation | null>(null);
  const [validating, setValidating] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !launching) onClose();
    };
    window.addEventListener('keydown', handler);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, launching]);

  // Ejecutar pre-validación al entrar al paso 3
  useEffect(() => {
    if (step !== 3) return;
    void (async () => {
      setValidating(true);
      setError(null);
      try {
        const result = await onValidate({
          jobType,
          scopeType,
          scopeFilter: scopeType === 'filtered' ? prefilledFilters ?? {} : null,
          scopeIds: scopeType === 'selected' ? prefilledSelection ?? [] : null,
        });
        setValidation(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error validando el alcance');
      } finally {
        setValidating(false);
      }
    })();
  }, [step, jobType, scopeType, prefilledFilters, prefilledSelection, onValidate]);

  const handleLaunch = async () => {
    setLaunching(true);
    setError(null);
    try {
      await onLaunch({
        jobType,
        scopeType,
        scopeFilter: scopeType === 'filtered' ? prefilledFilters ?? {} : null,
        scopeIds: scopeType === 'selected' ? prefilledSelection ?? [] : null,
        notes: notes.trim() || null,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al lanzar');
      setLaunching(false);
    }
  };

  const canLaunch = step === 3 && validation !== null &&
    validation.passingCount > 0 && !validating && !launching;

  return (
    <div
      className="launcher-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !launching) onClose(); }}
    >
      <div
        ref={dialogRef}
        className="launcher-dialog"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        <header className="launcher-header">
          <h2>{COPY.title}</h2>
          <button
            type="button"
            className="launcher-close"
            onClick={onClose}
            disabled={launching}
            aria-label="Cerrar"
          >×</button>
        </header>

        <div className="launcher-steps-nav" role="tablist">
          <StepIndicator n={1} active={step === 1} done={step > 1} label={COPY.step1Label} />
          <span className="launcher-step-sep" aria-hidden>—</span>
          <StepIndicator n={2} active={step === 2} done={step > 2} label={COPY.step2Label} />
          <span className="launcher-step-sep" aria-hidden>—</span>
          <StepIndicator n={3} active={step === 3} done={false} label={COPY.step3Label} />
        </div>

        <div className="launcher-body">
          {step === 1 && (
            <Step1TypePicker
              value={jobType}
              onChange={setJobType}
            />
          )}

          {step === 2 && (
            <Step2ScopePicker
              value={scopeType}
              onChange={setScopeType}
              hasPrefilledFilters={!!prefilledFilters}
              hasPrefilledSelection={(prefilledSelection?.length ?? 0) > 0}
            />
          )}

          {step === 3 && (
            <Step3Validation
              validating={validating}
              validation={validation}
              notes={notes}
              onNotesChange={setNotes}
              error={error}
            />
          )}
        </div>

        <footer className="launcher-footer">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={launching}
          >
            {COPY.cancelButton}
          </button>

          {step > 1 && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setStep((s) => (s - 1) as Step)}
              disabled={launching}
            >
              ← Atrás
            </button>
          )}

          {step < 3 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setStep((s) => (s + 1) as Step)}
            >
              Siguiente →
            </button>
          )}

          {step === 3 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleLaunch()}
              disabled={!canLaunch}
              title={!canLaunch ? COPY.launchDisabledHint : undefined}
            >
              {launching ? 'Creando…' : '🚀 ' + COPY.launchButton}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

// ─── Step indicator ────────────────────────────────────────────────────

function StepIndicator({
  n, active, done, label,
}: {
  n: number; active: boolean; done: boolean; label: string;
}) {
  return (
    <div className={`launcher-step ${active ? 'is-active' : ''} ${done ? 'is-done' : ''}`}>
      <span className="launcher-step-number">{done ? '✓' : n}</span>
      <span className="launcher-step-label">{label}</span>
    </div>
  );
}

// ─── Step 1 ────────────────────────────────────────────────────────────

function Step1TypePicker({
  value, onChange,
}: { value: ExportJobType; onChange: (t: ExportJobType) => void }) {
  return (
    <div>
      <p className="launcher-step-hint muted">{COPY.step1Hint}</p>
      <div className="launcher-type-grid">
        {JOB_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            className={`launcher-type-option ${value === t ? 'is-selected' : ''}`}
            onClick={() => onChange(t)}
          >
            <span className="launcher-type-icon" aria-hidden>{JOB_TYPE_ICONS[t]}</span>
            <span className="launcher-type-label">{JOB_TYPE_LABELS[t]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 2 ────────────────────────────────────────────────────────────

function Step2ScopePicker({
  value, onChange, hasPrefilledFilters, hasPrefilledSelection,
}: {
  value: ExportScopeType;
  onChange: (t: ExportScopeType) => void;
  hasPrefilledFilters: boolean;
  hasPrefilledSelection: boolean;
}) {
  return (
    <div>
      <p className="launcher-step-hint muted">{COPY.step2Hint}</p>
      <div className="launcher-scope-list">
        <ScopeOption
          value="all_published"
          current={value}
          onChange={onChange}
          label={COPY.scopeAllPublished}
          hint={COPY.scopeAllPublishedHint}
        />
        <ScopeOption
          value="filtered"
          current={value}
          onChange={onChange}
          label={COPY.scopeFiltered}
          hint={hasPrefilledFilters
            ? 'Usará los filtros activos del listado'
            : COPY.scopeFilteredHint}
          disabled={!hasPrefilledFilters}
        />
        <ScopeOption
          value="selected"
          current={value}
          onChange={onChange}
          label={COPY.scopeSelected}
          hint={hasPrefilledSelection
            ? 'Usará los recursos seleccionados en el listado'
            : COPY.scopeSelectedHint}
          disabled={!hasPrefilledSelection}
        />
      </div>
    </div>
  );
}

function ScopeOption({
  value, current, onChange, label, hint, disabled = false,
}: {
  value: ExportScopeType;
  current: ExportScopeType;
  onChange: (t: ExportScopeType) => void;
  label: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <label className={`launcher-scope-option ${disabled ? 'is-disabled' : ''} ${current === value ? 'is-selected' : ''}`}>
      <input
        type="radio"
        name="scope"
        value={value}
        checked={current === value}
        onChange={() => onChange(value)}
        disabled={disabled}
      />
      <div className="launcher-scope-option-body">
        <div className="launcher-scope-option-label">{label}</div>
        <div className="launcher-scope-option-hint muted">{hint}</div>
      </div>
    </label>
  );
}

// ─── Step 3 ────────────────────────────────────────────────────────────

function Step3Validation({
  validating, validation, notes, onNotesChange, error,
}: {
  validating: boolean;
  validation: ScopeValidation | null;
  notes: string;
  onNotesChange: (v: string) => void;
  error: string | null;
}) {
  if (validating) {
    return (
      <div className="launcher-validation-loading">
        <span className="launcher-validation-spinner" aria-hidden>⏳</span>
        <p>{COPY.step3Hint}</p>
      </div>
    );
  }

  if (error) {
    return <div className="launcher-validation-error" role="alert">⚠️ {error}</div>;
  }

  if (!validation) return null;

  const { totalInScope, passingCount, failingCount, sampleFailures } = validation;
  const allPass = failingCount === 0 && passingCount > 0;
  const allFail = passingCount === 0;

  return (
    <div className="launcher-validation">
      <div className="launcher-validation-summary">
        <div className="launcher-validation-metric launcher-validation-total">
          <div className="launcher-validation-number">{totalInScope}</div>
          <div className="launcher-validation-label muted">
            {interpolate(COPY.validationTotal, { count: totalInScope }).replace(`${totalInScope} `, '')}
          </div>
        </div>
        <div className="launcher-validation-metric launcher-validation-passing">
          <div className="launcher-validation-number">{passingCount}</div>
          <div className="launcher-validation-label">
            Pasan la validación ✓
          </div>
        </div>
        <div className={`launcher-validation-metric ${failingCount > 0 ? 'launcher-validation-failing' : 'launcher-validation-neutral'}`}>
          <div className="launcher-validation-number">{failingCount}</div>
          <div className="launcher-validation-label">
            Con errores ✗
          </div>
        </div>
      </div>

      {allPass && (
        <div className="launcher-validation-ok" role="status">
          ✓ {COPY.validationAllPassing}
        </div>
      )}

      {allFail && (
        <div className="launcher-validation-blocked" role="alert">
          ✗ {COPY.validationAllFailing}
        </div>
      )}

      {sampleFailures.length > 0 && (
        <div className="launcher-validation-sample">
          <strong>{COPY.validationSampleTitle}</strong>
          <ul>
            {sampleFailures.map((f) => (
              <li key={f.resourceId}>
                <span className={`launcher-validation-cat launcher-validation-cat-${f.errorCategory}`}>
                  {ERROR_CATEGORY_LABELS[f.errorCategory]}
                </span>
                <span className="launcher-validation-name">{f.resourceName}</span>
                <span className="launcher-validation-msg muted">· {f.errorMessage}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="launcher-notes-field">
        <span>{COPY.notesLabel}</span>
        <input
          type="text"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder={COPY.notesPlaceholder}
          maxLength={200}
        />
      </label>
    </div>
  );
}
