/**
 * PidCompletenessCard — detalles técnicos PID (plegada por defecto)
 *
 * Decisión 3-B del usuario: mantener contadores pero explicar cada grupo
 * en su contexto.
 *
 * Plegada por defecto para no abrumar al funcionario normal. Solo se
 * expande si el responsable técnico quiere ver el detalle.
 */

import { useState } from 'react';
import { STEP7_COPY } from '../pages/step7-review.copy';

const COPY = STEP7_COPY.pidCard;

export interface PidGroup {
  /** Clave del grupo para lookup en COPY.groupLabels */
  key:
    | 'schemaType'
    | 'mainType'
    | 'amenities'
    | 'accessibility'
    | 'municipio'
    | 'gastronomy'
    | 'editorial';
  count: number;
  isMandatory: boolean;
  /** Si es obligatorio, ¿está rellenado? */
  isFilled?: boolean;
}

export interface PidCompletenessCardProps {
  groups: PidGroup[];
  /** Total de etiquetas exportables al PID (sin curaduría editorial) */
  totalExportable: number;
}

export default function PidCompletenessCard({
  groups,
  totalExportable,
}: PidCompletenessCardProps) {
  const [expanded, setExpanded] = useState(false);

  // Bug fix de la captura original: mandatory filled debe verse como OK
  const mandatoryUnfilled = groups.filter((g) => g.isMandatory && !g.isFilled);
  const hasIncomplete = mandatoryUnfilled.length > 0;

  return (
    <section className={`pid-card ${hasIncomplete ? 'pid-card-incomplete' : ''}`}>
      <button
        type="button"
        className="pid-card-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="pid-card-toggle-head">
          <span className="pid-card-icon" aria-hidden>📋</span>
          <div>
            <h4>{COPY.title}</h4>
            <p className="muted">{COPY.subtitle}</p>
          </div>
        </div>
        <div className="pid-card-toggle-meta">
          {hasIncomplete && (
            <span className="pid-badge pid-badge-incomplete">
              {mandatoryUnfilled.length} obligatorio{mandatoryUnfilled.length === 1 ? '' : 's'} sin rellenar
            </span>
          )}
          <span className="pid-card-chevron" aria-hidden>
            {expanded ? '▼' : '▶'}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="pid-card-body">
          <ul className="pid-groups" role="list">
            {groups.map((g) => (
              <li key={g.key} className="pid-group">
                <div className="pid-group-row">
                  <div className="pid-group-name">
                    {COPY.groupLabels[g.key]}
                    {g.isMandatory && (
                      <span
                        className={`pid-badge ${
                          g.isFilled ? 'pid-badge-filled' : 'pid-badge-mandatory'
                        }`}
                      >
                        {g.isFilled ? '✓ ' + COPY.mandatoryLabel : COPY.mandatoryLabel}
                      </span>
                    )}
                  </div>
                  <div className="pid-group-count">
                    {g.isMandatory
                      ? g.isFilled
                        ? '✓'
                        : '—'
                      : g.count}
                  </div>
                </div>
                <p className="pid-group-hint muted">{COPY.groupHints[g.key]}</p>
              </li>
            ))}
          </ul>

          <footer className="pid-card-footer">
            <span className="muted">
              {COPY.exportableTotal
                .replace('{count}', String(totalExportable))
                .replace(/\{plural\}/g, totalExportable === 1 ? '' : 's')}
            </span>
          </footer>
        </div>
      )}
    </section>
  );
}
