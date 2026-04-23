/**
 * ListExportButtons — botones de exportación desde el listado SCR-03
 *
 * Decisión 8-A · Integración con listado:
 *   · "Exportar seleccionados al PID" visible cuando hay selección.
 *   · "Exportar filtrados" visible en la barra de filtros.
 *
 * Ambos abren el ExportLauncherDialog de Fase A con prefilledFilters
 * o prefilledSelection. El alcance queda bloqueado a esa opción.
 *
 * Este componente es agnóstico al listado: recibe los datos y callback.
 */

import { useState } from 'react';
import ExportLauncherDialog from './ExportLauncherDialog';
import type { UseExportsState } from '../../hooks/useExports';

export interface ListExportButtonsProps {
  state: UseExportsState;
  /** Si el listado tiene recursos seleccionados, sus IDs */
  selectedIds: string[];
  /** Filtros activos del listado serializados a JSON */
  currentFilters: Record<string, unknown> | null;
  /** Roles con permiso de exportación */
  canExport: boolean;
}

export default function ListExportButtons({
  state,
  selectedIds,
  currentFilters,
  canExport,
}: ListExportButtonsProps) {
  const [launcherOpen, setLauncherOpen] = useState<'filters' | 'selection' | null>(null);

  if (!canExport) return null;

  const hasSelection = selectedIds.length > 0;
  const hasFilters = currentFilters != null && Object.keys(currentFilters).length > 0;

  return (
    <>
      {hasSelection && (
        <button
          type="button"
          className="btn btn-ghost btn-sm list-export-button"
          onClick={() => setLauncherOpen('selection')}
          title={`Exportar los ${selectedIds.length} recursos seleccionados`}
        >
          🏛 Exportar al PID ({selectedIds.length})
        </button>
      )}

      {hasFilters && !hasSelection && (
        <button
          type="button"
          className="btn btn-ghost btn-sm list-export-button"
          onClick={() => setLauncherOpen('filters')}
          title="Exportar los recursos que coinciden con los filtros activos"
        >
          🏛 Exportar filtrados
        </button>
      )}

      {launcherOpen && (
        <ExportLauncherDialog
          prefilledFilters={launcherOpen === 'filters' ? currentFilters : null}
          prefilledSelection={launcherOpen === 'selection' ? selectedIds : null}
          onValidate={state.validateScope}
          onLaunch={state.launch}
          onClose={() => setLauncherOpen(null)}
        />
      )}
    </>
  );
}
