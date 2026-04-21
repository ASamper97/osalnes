/**
 * ScoreDashboard — resumen global de calidad arriba del paso 7
 *
 * Muestra nota grande 0-100 con color por tramo + resumen textual
 * de cuántos errores/avisos hay.
 */

import type { QualityReport } from '@osalnes/shared/data/quality-engine';
import { STEP7_COPY } from '../pages/step7-review.copy';

const COPY = STEP7_COPY.dashboard;

export interface ScoreDashboardProps {
  report: QualityReport;
}

export default function ScoreDashboard({ report }: ScoreDashboardProps) {
  const band = scoreBand(report.score);
  const summary = buildSummary(report);

  return (
    <section className={`score-dashboard score-dashboard-${band}`}>
      <div className={`score-dashboard-circle score-dashboard-circle-${band}`}>
        <div className="score-dashboard-number">{report.score}</div>
        <div className="score-dashboard-label">{COPY.scoreLabel}</div>
      </div>
      <div className="score-dashboard-summary">
        <p className="score-dashboard-text">{summary}</p>
        <div className="score-dashboard-counts">
          {report.criticalCount > 0 && (
            <span className="score-count score-count-fail">
              ✗ {report.criticalCount} error{report.criticalCount === 1 ? '' : 'es'}
            </span>
          )}
          {report.warnCount > 0 && (
            <span className="score-count score-count-warn">
              ⚠ {report.warnCount} aviso{report.warnCount === 1 ? '' : 's'}
            </span>
          )}
          {report.criticalCount === 0 && report.warnCount === 0 && (
            <span className="score-count score-count-ok">
              ✓ Todo correcto
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function scoreBand(score: number): 'low' | 'mid' | 'high' {
  if (score < 50) return 'low';
  if (score < 80) return 'mid';
  return 'high';
}

function buildSummary(r: QualityReport): string {
  if (r.criticalCount === 0 && r.warnCount === 0) return COPY.allOk;

  if (r.criticalCount > 0 && r.warnCount > 0) {
    return COPY.mixed
      .replace('{criticals}', String(r.criticalCount))
      .replace('{criticalsPlural}', r.criticalCount === 1 ? '' : 'es')
      .replace('{warnings}', String(r.warnCount))
      .replace('{warningsPlural}', r.warnCount === 1 ? '' : 's');
  }
  if (r.criticalCount > 0) {
    return COPY.criticals
      .replace('{count}', String(r.criticalCount))
      .replace('{plural}', r.criticalCount === 1 ? '' : 'es');
  }
  return COPY.warnings
    .replace('{count}', String(r.warnCount))
    .replace('{plural}', r.warnCount === 1 ? '' : 's');
}
