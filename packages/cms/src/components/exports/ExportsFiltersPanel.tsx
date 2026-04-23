/**
 * ExportsFiltersPanel — filtros del listado de exportaciones
 *
 * Barra superior con: estado, tipo, rango de fechas, "solo las mías".
 */

import type { ExportsFilters } from '../../hooks/useExports';
import {
  JOB_STATUS_LABELS,
  JOB_TYPE_LABELS,
  type ExportJobStatus,
  type ExportJobType,
} from '@osalnes/shared/data/exports';
import { EXPORTS_COPY } from '../../pages/exports.copy';

const COPY = EXPORTS_COPY.filters;

const STATUS_OPTIONS: ExportJobStatus[] = ['pending', 'running', 'success', 'partial', 'failed'];
const JOB_TYPE_OPTIONS: ExportJobType[] = ['pid', 'data_lake', 'csv', 'json_ld'];

export interface ExportsFiltersPanelProps {
  filters: ExportsFilters;
  onChange: (f: Partial<ExportsFilters>) => void;
  onClear: () => void;
}

export default function ExportsFiltersPanel({
  filters,
  onChange,
  onClear,
}: ExportsFiltersPanelProps) {
  const activeCount =
    (filters.status ? 1 : 0) +
    (filters.jobType ? 1 : 0) +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0) +
    (filters.onlyMine ? 1 : 0);

  return (
    <section className="exports-filters-panel" aria-label="Filtros">
      <div className="exports-filters-row">
        <label className="exports-filter">
          <span>{COPY.statusLabel}</span>
          <select
            value={filters.status}
            onChange={(e) => onChange({ status: e.target.value })}
          >
            <option value="">{COPY.statusAll}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{JOB_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </label>

        <label className="exports-filter">
          <span>{COPY.jobTypeLabel}</span>
          <select
            value={filters.jobType}
            onChange={(e) => onChange({ jobType: e.target.value })}
          >
            <option value="">{COPY.jobTypeAll}</option>
            {JOB_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{JOB_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </label>

        <label className="exports-filter">
          <span>{COPY.dateFromLabel}</span>
          <input
            type="date"
            value={filters.dateFrom ? filters.dateFrom.slice(0, 10) : ''}
            onChange={(e) => onChange({ dateFrom: e.target.value ? new Date(e.target.value).toISOString() : null })}
          />
        </label>

        <label className="exports-filter">
          <span>{COPY.dateToLabel}</span>
          <input
            type="date"
            value={filters.dateTo ? filters.dateTo.slice(0, 10) : ''}
            onChange={(e) => {
              if (!e.target.value) {
                onChange({ dateTo: null });
                return;
              }
              // End of day
              const d = new Date(e.target.value);
              d.setHours(23, 59, 59, 999);
              onChange({ dateTo: d.toISOString() });
            }}
          />
        </label>

        <label className="exports-filter-checkbox">
          <input
            type="checkbox"
            checked={filters.onlyMine}
            onChange={(e) => onChange({ onlyMine: e.target.checked })}
          />
          <span>{COPY.onlyMineLabel}</span>
        </label>

        {activeCount > 0 && (
          <button
            type="button"
            className="exports-filter-clear"
            onClick={onClear}
          >
            ✕ {COPY.clearLabel} ({activeCount})
          </button>
        )}
      </div>
    </section>
  );
}
