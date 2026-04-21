/**
 * PublishModal — confirmación de publicación (versión 7b)
 *
 * AMPLIACIÓN de la versión del paso 7a. Ahora soporta 3 opciones:
 *   1. Publicar ahora (comportamiento original)
 *   2. Programar publicación (nuevo · decisión 4-A)
 *   3. Volver a corregir
 *
 * Las 3 variantes visuales por estado (clean/warnings/errors) se
 * mantienen. La opción "programar" aparece con un switch; al activarla
 * se revela el selector fecha+hora.
 */

import { useEffect, useRef, useState } from 'react';
import type { QualityReport } from '@osalnes/shared/data/quality-engine';
import SchedulePublishPicker from './SchedulePublishPicker';
import { STEP7_COPY } from '../pages/step7-review.copy';

const COPY = STEP7_COPY.publishModal;

export interface PublishModalProps {
  report: QualityReport;
  /** Publicar inmediatamente */
  onConfirmPublishNow: () => void;
  /** Programar publicación para una fecha futura */
  onConfirmSchedule: (utcIso: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function PublishModal({
  report,
  onConfirmPublishNow,
  onConfirmSchedule,
  onCancel,
  loading = false,
}: PublishModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'now' | 'scheduled'>('now');
  const [scheduleIso, setScheduleIso] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', handler);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel, loading]);

  const variant: 'clean' | 'warnings' | 'errors' =
    report.criticalCount > 0 ? 'errors' : report.warnCount > 0 ? 'warnings' : 'clean';

  const title = {
    clean: COPY.titleClean,
    warnings: COPY.titleWithWarnings,
    errors: COPY.titleWithErrors,
  }[variant];

  const summary = (() => {
    if (variant === 'clean') return COPY.summaryClean;
    if (variant === 'warnings') {
      return COPY.summaryWarnings
        .replace('{count}', String(report.warnCount))
        .replace(/\{plural\}/g, report.warnCount === 1 ? '' : 's');
    }
    return COPY.summaryErrors
      .replace('{count}', String(report.criticalCount))
      .replace(/\{plural\}/g, report.criticalCount === 1 ? '' : 's');
  })();

  const confirmLabel = {
    clean: COPY.confirmCleanButton,
    warnings: COPY.confirmWarningsButton,
    errors: COPY.confirmErrorsButton,
  }[variant];

  const issues = [
    ...report.checks.filter((c) => c.status === 'fail'),
    ...report.checks.filter((c) => c.status === 'warn'),
  ].slice(0, 6);

  const handleConfirm = () => {
    setValidationError(null);
    if (mode === 'now') {
      onConfirmPublishNow();
    } else {
      if (!scheduleIso) {
        setValidationError(COPY.scheduleNoDate);
        return;
      }
      const scheduleTime = new Date(scheduleIso).getTime();
      if (scheduleTime < Date.now() + 60000) {
        // Requiere al menos 1 minuto en el futuro
        setValidationError(COPY.schedulePastDate);
        return;
      }
      onConfirmSchedule(scheduleIso);
    }
  };

  return (
    <div
      className="publish-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className={`publish-modal publish-modal-${variant}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="publish-modal-title"
        tabIndex={-1}
      >
        <header className="publish-modal-head">
          <h2 id="publish-modal-title">{title}</h2>
        </header>

        <div className="publish-modal-body">
          <p className="publish-modal-summary">{summary}</p>

          {issues.length > 0 && (
            <>
              <h5 className="publish-modal-issues-title">{COPY.checksTitle}</h5>
              <ul className="publish-modal-issues" role="list">
                {issues.map((issue) => (
                  <li
                    key={issue.key}
                    className={`publish-modal-issue publish-modal-issue-${issue.status}`}
                  >
                    <span className="publish-modal-issue-marker" aria-hidden>
                      {issue.status === 'fail' ? '✗' : '⚠'}
                    </span>
                    <span>{issue.label}</span>
                  </li>
                ))}
                {report.criticalCount + report.warnCount > issues.length && (
                  <li className="publish-modal-issues-more muted">
                    + {report.criticalCount + report.warnCount - issues.length} punto
                    {report.criticalCount + report.warnCount - issues.length === 1 ? '' : 's'} más
                  </li>
                )}
              </ul>
            </>
          )}

          {/* Selector modo: ahora vs programar (decisión 4-A) */}
          <div className="publish-mode-tabs" role="tablist">
            <button
              role="tab"
              type="button"
              aria-selected={mode === 'now'}
              className={`publish-mode-tab ${mode === 'now' ? 'active' : ''}`}
              onClick={() => setMode('now')}
              disabled={loading}
            >
              ⚡ {COPY.modeNow}
            </button>
            <button
              role="tab"
              type="button"
              aria-selected={mode === 'scheduled'}
              className={`publish-mode-tab ${mode === 'scheduled' ? 'active' : ''}`}
              onClick={() => setMode('scheduled')}
              disabled={loading}
            >
              ⏰ {COPY.modeScheduled}
            </button>
          </div>

          {mode === 'scheduled' && (
            <div className="publish-mode-scheduled-block">
              <SchedulePublishPicker
                value={scheduleIso}
                onChange={setScheduleIso}
                disabled={loading}
              />
            </div>
          )}

          {validationError && (
            <p role="alert" className="publish-modal-validation-error">
              ⚠️ {validationError}
            </p>
          )}
        </div>

        <footer className="publish-modal-foot">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={loading}
          >
            {COPY.cancelButton}
          </button>
          <button
            type="button"
            className={`btn ${
              variant === 'errors' ? 'btn-danger' : variant === 'warnings' ? 'btn-warning' : 'btn-primary'
            }`}
            onClick={handleConfirm}
            disabled={loading || (mode === 'scheduled' && !scheduleIso)}
          >
            {loading
              ? mode === 'scheduled' ? 'Programando…' : 'Publicando…'
              : mode === 'scheduled' ? COPY.confirmScheduleButton : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
