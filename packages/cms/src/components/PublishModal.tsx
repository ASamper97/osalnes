/**
 * PublishModal — confirmación antes de publicar (decisión 6-A)
 *
 * 3 variantes según el estado:
 *   - Clean   (no hay problemas)    → modal corto y verde
 *   - Warnings (solo avisos)        → modal amarillo con listado
 *   - Errors  (hay fails críticos)  → modal rojo, botón de publicar
 *                                      en rojo pesado "Publicar pese a los errores"
 *
 * El usuario siempre puede publicar — somos un CMS municipal, no un
 * gatekeeper. Pero le avisamos con claridad.
 */

import { useEffect, useRef } from 'react';
import type { QualityReport } from '@osalnes/shared/data/quality-engine';
import { STEP7_COPY } from '../pages/step7-review.copy';

const COPY = STEP7_COPY.publishModal;

export interface PublishModalProps {
  report: QualityReport;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function PublishModal({ report, onConfirm, onCancel, loading = false }: PublishModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap básico + cerrar con Escape
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

  // Problemas a listar (críticos primero, máx. 6)
  const issues = [
    ...report.checks.filter((c) => c.status === 'fail'),
    ...report.checks.filter((c) => c.status === 'warn'),
  ].slice(0, 6);

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
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Publicando…' : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
