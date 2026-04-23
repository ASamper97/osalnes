/**
 * ExportJobDetailErrors — tab "Errores" del drawer
 *
 * Lista de recursos fallidos agrupados por categoría. Cada fallo tiene
 * mensaje humano arriba + detalles técnicos colapsables abajo (decisión 5-A).
 */

import { useState } from 'react';
import type { ExportJobRecord } from '@osalnes/shared/data/exports-detail';
import {
  ERROR_CATEGORY_HINTS,
  ERROR_CATEGORY_LABELS,
  type ExportErrorCategory,
} from '@osalnes/shared/data/exports';
import { EXPORTS_DETAIL_COPY } from '../../pages/exports-detail.copy';

const COPY = EXPORTS_DETAIL_COPY.errors;

export interface ExportJobDetailErrorsProps {
  records: ExportJobRecord[];
  onOpenResource?: (resourceId: string) => void;
}

export default function ExportJobDetailErrors({
  records,
  onOpenResource,
}: ExportJobDetailErrorsProps) {
  if (records.length === 0) {
    return (
      <div className="drawer-errors-empty">
        <strong>{COPY.emptyTitle}</strong>
        <p className="muted">{COPY.emptyHint}</p>
      </div>
    );
  }

  // Agrupar por categoría
  const grouped = new Map<ExportErrorCategory | 'unknown', ExportJobRecord[]>();
  for (const r of records) {
    const cat = r.errorCategory ?? 'unknown';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(r);
  }

  const categoryOrder: (ExportErrorCategory | 'unknown')[] = [
    'content', 'integration', 'schema', 'permissions', 'unknown',
  ];

  return (
    <div className="drawer-errors">
      {categoryOrder
        .filter((cat) => grouped.has(cat))
        .map((cat) => {
          const recs = grouped.get(cat)!;
          const isKnown = cat !== 'unknown';
          return (
            <section key={cat} className="drawer-errors-group">
              <header className={`drawer-errors-group-header drawer-err-bg-${cat}`}>
                <span className="drawer-errors-group-count">{recs.length}</span>
                <div className="drawer-errors-group-titles">
                  <div className="drawer-errors-group-title">
                    {isKnown ? ERROR_CATEGORY_LABELS[cat as ExportErrorCategory] : 'Sin categoría'}
                  </div>
                  {isKnown && (
                    <div className="drawer-errors-group-hint">
                      {ERROR_CATEGORY_HINTS[cat as ExportErrorCategory]}
                    </div>
                  )}
                </div>
              </header>

              <ul className="drawer-errors-list">
                {recs.map((r) => (
                  <ErrorRecord
                    key={r.id}
                    record={r}
                    onOpenResource={onOpenResource}
                  />
                ))}
              </ul>
            </section>
          );
        })}
    </div>
  );
}

interface ErrorRecordProps {
  record: ExportJobRecord;
  onOpenResource?: (resourceId: string) => void;
}

function ErrorRecord({ record: r, onOpenResource }: ErrorRecordProps) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = r.errorDetails && Object.keys(r.errorDetails).length > 0;

  return (
    <li className="drawer-error-item">
      <div className="drawer-error-main">
        <div className="drawer-error-resource">
          <div className="drawer-error-resource-name">
            {r.resourceName ?? '(sin nombre)'}
          </div>
          {r.resourceSlug && (
            <div className="drawer-error-resource-slug muted">{r.resourceSlug}</div>
          )}
        </div>

        <div className="drawer-error-message">
          {r.errorMessage ?? '(sin mensaje)'}
        </div>

        <div className="drawer-error-actions">
          {r.resourceId && onOpenResource && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onOpenResource(r.resourceId!)}
            >
              {COPY.openResourceButton} →
            </button>
          )}
          {hasDetails && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? COPY.detailsToggleHide : COPY.detailsToggleShow}
            </button>
          )}
        </div>
      </div>

      {expanded && hasDetails && (
        <pre className="drawer-error-details">
          {JSON.stringify(r.errorDetails, null, 2)}
        </pre>
      )}
    </li>
  );
}
