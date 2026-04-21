/**
 * SeoAuditPanel — panel de auditoría SEO en vivo
 *
 * Usa el motor `auditSeo()` de shared/data/seo-audit.ts y muestra:
 *   - Nota 0-100 grande con color según el rango (rojo/amarillo/verde)
 *   - Resumen ("todo correcto" / "N avisos" / "N errores")
 *   - Lista detallada (opcional, plegable) con cada check
 *
 * Se recalcula en tiempo real cada vez que cambia el SEO (memoizado en
 * el padre para no penalizar). Este componente es solo presentación.
 */

import { useState } from 'react';
import type { SeoReport, SeoCheck } from '@osalnes/shared/data/seo-audit';
import { STEP6_COPY } from '../pages/step6-seo.copy';

const COPY = STEP6_COPY.audit;

export interface SeoAuditPanelProps {
  report: SeoReport;
}

export default function SeoAuditPanel({ report }: SeoAuditPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const scoreRange = scoreBand(report.score);

  const summaryText = (() => {
    if (report.criticalCount > 0) {
      return COPY.summaryFails.replace('{count}', String(report.criticalCount));
    }
    if (report.warnCount > 0) {
      return COPY.summaryWarns.replace('{count}', String(report.warnCount));
    }
    return COPY.summaryAllOk;
  })();

  return (
    <section className={`seo-audit seo-audit-${scoreRange}`} aria-label={COPY.sectionTitle}>
      <header className="seo-audit-head">
        <h4>{COPY.sectionTitle}</h4>
        <div className={`seo-audit-score seo-audit-score-${scoreRange}`}>
          <div className="seo-audit-score-number">{report.score}</div>
          <div className="seo-audit-score-label muted">{COPY.scoreLabel}</div>
        </div>
      </header>

      <p className="seo-audit-summary">{summaryText}</p>

      <button
        type="button"
        className="btn btn-ghost btn-sm seo-audit-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? COPY.toggleHide : COPY.toggleShow}
      </button>

      {expanded && (
        <ul className="seo-audit-checks" role="list">
          {report.checks
            .filter((c: SeoCheck) => c.weight > 0) // ocultar los "skip" con weight 0
            .map((check: SeoCheck) => (
              <li key={check.key} className={`seo-check seo-check-${check.status}`}>
                <div className="seo-check-status" aria-label={COPY.statusLabels[check.status]}>
                  {check.status === 'pass' && '✓'}
                  {check.status === 'warn' && '⚠'}
                  {check.status === 'fail' && '✗'}
                </div>
                <div className="seo-check-body">
                  <strong className="seo-check-label">{check.label}</strong>
                  <p className="seo-check-explanation muted">{check.explanation}</p>
                </div>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}

function scoreBand(score: number): 'low' | 'mid' | 'high' {
  if (score < 50) return 'low';
  if (score < 80) return 'mid';
  return 'high';
}
