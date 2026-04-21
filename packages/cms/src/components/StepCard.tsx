/**
 * StepCard — tarjeta por paso con checkmark HONESTO según calidad real
 *
 * Sustituye los "✓ verde falso" actuales por un estado real:
 *   - ok         → ✓ verde (todo completo)
 *   - warn       → ⚠ amarillo (mejorable)
 *   - incomplete → ✗ rojo (errores críticos)
 *   - empty      → ○ gris (sin revisar / no aplica)
 *
 * También lista los problemas concretos del paso (hasta 3) y da botón
 * "Editar" que salta al paso correspondiente.
 */

import type { QualityReport, QualityStep, StepAggregate } from '@osalnes/shared/data/quality-engine';
import { STEP7_COPY } from '../pages/step7-review.copy';

const COPY = STEP7_COPY.stepCards;

export interface StepCardProps {
  step: QualityStep;
  aggregate: StepAggregate;
  report: QualityReport;
  /** Callback para saltar al paso */
  onEdit: (step: QualityStep) => void;
}

export default function StepCard({ step, aggregate, report, onEdit }: StepCardProps) {
  const label = COPY.stepLabels[step];
  const statusLabel = COPY.statusLabels[aggregate.status];
  const issues = report.checks.filter(
    (c) => c.stepRef === step && (c.status === 'fail' || c.status === 'warn'),
  );

  const statusSymbol = {
    ok: '✓',
    warn: '⚠',
    incomplete: '✗',
    empty: '○',
  }[aggregate.status];

  return (
    <article className={`step-card step-card-${aggregate.status}`}>
      <header className="step-card-head">
        <div className="step-card-title-block">
          <span className={`step-card-status step-card-status-${aggregate.status}`} aria-hidden>
            {statusSymbol}
          </span>
          <h4 className="step-card-title">{label}</h4>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => onEdit(step)}
        >
          {COPY.editButton}
        </button>
      </header>

      <div className={`step-card-status-label step-card-status-label-${aggregate.status}`}>
        {statusLabel}
        {issues.length > 0 && (
          <span className="step-card-count">
            · {issues.length} {issues.length === 1 ? 'punto' : 'puntos'}
          </span>
        )}
      </div>

      {issues.length === 0 && aggregate.passCount > 0 && (
        <p className="step-card-all-ok muted">{COPY.allPassed}</p>
      )}

      {issues.length > 0 && (
        <ul className="step-card-issues" role="list">
          {issues.slice(0, 3).map((issue) => (
            <li
              key={issue.key}
              className={`step-card-issue step-card-issue-${issue.status}`}
            >
              <span className="step-card-issue-marker" aria-hidden>
                {issue.status === 'fail' ? '✗' : '⚠'}
              </span>
              <span className="step-card-issue-label">{issue.label}</span>
            </li>
          ))}
          {issues.length > 3 && (
            <li className="step-card-issue-more muted">
              + {issues.length - 3} {issues.length - 3 === 1 ? 'punto más' : 'puntos más'}
            </li>
          )}
        </ul>
      )}
    </article>
  );
}
