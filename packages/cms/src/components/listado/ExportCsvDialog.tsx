/**
 * ExportCsvDialog — diálogo para configurar y descargar CSV
 *
 * Permite al usuario:
 *   - Elegir qué columnas exportar (checkboxes)
 *   - Elegir qué filas: todas las filtradas actualmente, o solo las
 *     seleccionadas (si hay ≥1 seleccionada).
 *   - Ver preview del count total de filas que se exportarán.
 *   - Descargar CSV con BOM UTF-8 para Excel.
 */

import { useEffect, useRef, useState } from 'react';
import type { ListResourceRow } from '@osalnes/shared/data/resources-list';
import {
  type ExportColumn,
  EXPORT_COLUMN_LABELS,
  DEFAULT_EXPORT_COLUMNS,
  rowsToCsv,
  downloadCsv,
  defaultCsvFilename,
} from '@osalnes/shared/data/resources-list-b';

const ALL_COLUMNS: ExportColumn[] = [
  'nameEs', 'nameGl', 'slug', 'typology', 'municipality', 'status',
  'languages', 'visibleOnMap', 'coordinates', 'qualityScore',
  'pidMissing', 'publishedAt', 'scheduledAt', 'updatedAt', 'lastEditor', 'id',
];

export interface ExportCsvDialogProps {
  /** Scope "todos los filtrados" (puede ser grande — fetch separado) */
  onFetchAllFiltered: () => Promise<ListResourceRow[]>;
  totalFilteredCount: number;

  /** Scope "solo seleccionados" (si hay selección, se puede usar este set) */
  selectedRows: ListResourceRow[];

  resolveTypologyLabel: (key: string | null) => string;
  onCancel: () => void;
}

export default function ExportCsvDialog({
  onFetchAllFiltered,
  totalFilteredCount,
  selectedRows,
  resolveTypologyLabel,
  onCancel,
}: ExportCsvDialogProps) {
  const [scope, setScope] = useState<'filtered' | 'selected'>(
    selectedRows.length > 0 ? 'selected' : 'filtered',
  );
  const [columns, setColumns] = useState<Set<ExportColumn>>(
    new Set(DEFAULT_EXPORT_COLUMNS),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', handler);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel, loading]);

  const toggleColumn = (col: ExportColumn) => {
    const next = new Set(columns);
    if (next.has(col)) next.delete(col);
    else next.add(col);
    setColumns(next);
  };

  const handleExport = async () => {
    if (columns.size === 0) {
      setError('Selecciona al menos una columna.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows =
        scope === 'selected' ? selectedRows : await onFetchAllFiltered();
      const orderedCols = ALL_COLUMNS.filter((c) => columns.has(c));
      const csv = rowsToCsv(rows, orderedCols, resolveTypologyLabel);
      downloadCsv(csv, defaultCsvFilename());
      onCancel();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error generando el CSV.');
      setLoading(false);
    }
  };

  const scopeCount = scope === 'selected' ? selectedRows.length : totalFilteredCount;

  return (
    <div
      className="export-csv-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel(); }}
    >
      <div
        ref={dialogRef}
        className="export-csv-dialog"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        <header>
          <h2>Exportar a CSV</h2>
        </header>

        <div className="export-csv-body">
          <p className="muted">
            Descarga un CSV compatible con Excel y Google Sheets (UTF-8 con BOM).
          </p>

          {/* Scope */}
          <fieldset className="export-csv-scope">
            <legend>Qué exportar</legend>
            {selectedRows.length > 0 && (
              <label>
                <input
                  type="radio"
                  name="scope"
                  value="selected"
                  checked={scope === 'selected'}
                  onChange={() => setScope('selected')}
                  disabled={loading}
                />
                <span>
                  Solo los {selectedRows.length} recurso{selectedRows.length === 1 ? '' : 's'} seleccionado{selectedRows.length === 1 ? '' : 's'}
                </span>
              </label>
            )}
            <label>
              <input
                type="radio"
                name="scope"
                value="filtered"
                checked={scope === 'filtered'}
                onChange={() => setScope('filtered')}
                disabled={loading}
              />
              <span>
                Todos los {totalFilteredCount} recurso{totalFilteredCount === 1 ? '' : 's'} filtrado{totalFilteredCount === 1 ? '' : 's'}
              </span>
            </label>
          </fieldset>

          {/* Column picker */}
          <fieldset className="export-csv-columns">
            <legend>Columnas a incluir ({columns.size})</legend>
            <div className="export-csv-columns-grid">
              {ALL_COLUMNS.map((col) => (
                <label key={col} className="export-csv-column-option">
                  <input
                    type="checkbox"
                    checked={columns.has(col)}
                    onChange={() => toggleColumn(col)}
                    disabled={loading}
                  />
                  <span>{EXPORT_COLUMN_LABELS[col]}</span>
                </label>
              ))}
            </div>
            <div className="export-csv-columns-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setColumns(new Set(ALL_COLUMNS))}
                disabled={loading}
              >
                Seleccionar todas
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setColumns(new Set(DEFAULT_EXPORT_COLUMNS))}
                disabled={loading}
              >
                Restablecer
              </button>
            </div>
          </fieldset>

          {error && (
            <div className="export-csv-error" role="alert">
              ⚠️ {error}
            </div>
          )}
        </div>

        <footer className="export-csv-foot">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleExport()}
            disabled={loading || columns.size === 0}
          >
            {loading ? 'Generando…' : `📄 Descargar CSV (${scopeCount} filas)`}
          </button>
        </footer>
      </div>
    </div>
  );
}
