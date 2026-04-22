/**
 * ListPagination — paginación con selector de tamaño
 */

import type { ListPagination } from '@osalnes/shared/data/resources-list';
import { LIST_COPY } from '../../pages/listado.copy';

const COPY = LIST_COPY.pagination;
const PAGE_SIZES = [10, 25, 50, 100];

export interface ListPaginationProps {
  pagination: ListPagination;
  totalCount: number;
  onChange: (next: ListPagination) => void;
}

export default function ListPaginationBar({
  pagination,
  totalCount,
  onChange,
}: ListPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pagination.pageSize));
  const page = Math.min(pagination.page, totalPages);

  const goTo = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    onChange({ ...pagination, page: newPage });
  };

  const changePageSize = (size: number) => {
    onChange({ page: 1, pageSize: size });
  };

  return (
    <div className="list-pagination">
      <div className="list-pagination-info">
        {COPY.totalLabel
          .replace('{total}', String(totalCount))
          .replace('{page}', String(page))
          .replace('{totalPages}', String(totalPages))}
      </div>

      <div className="list-pagination-controls">
        <label className="list-pagination-size">
          <span>{COPY.pageSizeLabel}</span>
          <select
            value={pagination.pageSize}
            onChange={(e) => changePageSize(Number(e.target.value))}
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <div className="list-pagination-buttons">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => goTo(page - 1)}
            disabled={page <= 1}
          >
            ← {COPY.previousPage}
          </button>
          <span className="list-pagination-page-indicator">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => goTo(page + 1)}
            disabled={page >= totalPages}
          >
            {COPY.nextPage} →
          </button>
        </div>
      </div>
    </div>
  );
}
