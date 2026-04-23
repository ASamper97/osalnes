/**
 * ExportJobDetailRecords — tab "Records" del drawer
 *
 * Tabla compacta con todos los recursos procesados, filtrable.
 */

import type { ExportJobRecord } from '@osalnes/shared/data/exports-detail';
import { ERROR_CATEGORY_LABELS } from '@osalnes/shared/data/exports';
import { EXPORTS_DETAIL_COPY } from '../../pages/exports-detail.copy';

const COPY = EXPORTS_DETAIL_COPY.records;

export interface ExportJobDetailRecordsProps {
  records: ExportJobRecord[];
  filter: 'all' | 'failed' | 'success';
  onFilterChange: (f: 'all' | 'failed' | 'success') => void;
  onOpenResource?: (resourceId: string) => void;
}

export default function ExportJobDetailRecords({
  records,
  filter,
  onFilterChange,
  onOpenResource,
}: ExportJobDetailRecordsProps) {
  return (
    <div className="drawer-records">
      <div className="drawer-records-filter">
        <button
          type="button"
          className={`drawer-filter-chip ${filter === 'all' ? 'is-active' : ''}`}
          onClick={() => onFilterChange('all')}
        >{COPY.filterAll}</button>
        <button
          type="button"
          className={`drawer-filter-chip ${filter === 'success' ? 'is-active' : ''}`}
          onClick={() => onFilterChange('success')}
        >{COPY.filterSuccess}</button>
        <button
          type="button"
          className={`drawer-filter-chip ${filter === 'failed' ? 'is-active' : ''}`}
          onClick={() => onFilterChange('failed')}
        >{COPY.filterFailed}</button>
      </div>

      {records.length === 0 ? (
        <div className="drawer-records-empty muted">{COPY.empty}</div>
      ) : (
        <table className="drawer-records-table">
          <thead>
            <tr>
              <th>{COPY.columnResource}</th>
              <th>{COPY.columnStatus}</th>
              <th>{COPY.columnCategory}</th>
              <th>{COPY.columnMessage}</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr
                key={r.id}
                className={`drawer-records-row drawer-records-row-${r.status}`}
                onClick={() => {
                  if (r.resourceId && onOpenResource) onOpenResource(r.resourceId);
                }}
                style={{ cursor: r.resourceId && onOpenResource ? 'pointer' : 'default' }}
              >
                <td>
                  <div className="drawer-records-name">{r.resourceName ?? '(sin nombre)'}</div>
                  {r.resourceSlug && (
                    <div className="drawer-records-slug muted">{r.resourceSlug}</div>
                  )}
                </td>
                <td>
                  <span className={`drawer-records-status drawer-records-status-${r.status}`}>
                    {r.status === 'success' && '✓ OK'}
                    {r.status === 'failed' && '✗ Error'}
                    {r.status === 'skipped' && '− Saltado'}
                  </span>
                </td>
                <td>
                  {r.errorCategory ? (
                    <span className={`drawer-err-chip-sm drawer-err-chip-${r.errorCategory}`}>
                      {ERROR_CATEGORY_LABELS[r.errorCategory]}
                    </span>
                  ) : '—'}
                </td>
                <td className="drawer-records-message muted">
                  {r.errorMessage ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
