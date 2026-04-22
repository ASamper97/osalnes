/**
 * SaveViewDialog — modal para guardar una vista nueva
 *
 * Pide:
 *   - Nombre (obligatorio, único por usuario, validación cliente + servidor)
 *   - Checkbox "marcar como vista por defecto"
 *
 * Muestra resumen de qué filtros y qué orden tiene la vista actualmente
 * para que el usuario sepa qué va a guardar.
 */

import { useEffect, useRef, useState } from 'react';
import type { ListFilters, ListSort } from '@osalnes/shared/data/resources-list';
import { countActiveFilters } from '@osalnes/shared/data/resources-list';

export interface SaveViewDialogProps {
  filters: ListFilters;
  sort: ListSort;
  pageSize: number;
  /** Nombres de vistas existentes para validar unicidad */
  existingNames: string[];
  /** Hay ya una vista por defecto (solo 1 se permite) */
  hasExistingDefault: boolean;
  onSave: (params: {
    name: string;
    isDefault: boolean;
  }) => Promise<void>;
  onCancel: () => void;
}

export default function SaveViewDialog({
  filters,
  sort,
  pageSize,
  existingNames,
  hasExistingDefault,
  onSave,
  onCancel,
}: SaveViewDialogProps) {
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel, saving]);

  const validate = (): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return 'El nombre es obligatorio.';
    if (trimmed.length > 60) return 'Máximo 60 caracteres.';
    if (existingNames.includes(trimmed)) {
      return 'Ya tienes una vista con ese nombre. Elige otro o elimina la anterior.';
    }
    return null;
  };

  const handleSave = async () => {
    const v = validate();
    if (v) { setError(v); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), isDefault });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar.');
      setSaving(false);
    }
  };

  const activeFilterCount = countActiveFilters(filters);

  return (
    <div
      className="save-view-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onCancel(); }}
    >
      <div
        ref={dialogRef}
        className="save-view-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-view-title"
        tabIndex={-1}
      >
        <header>
          <h2 id="save-view-title">Guardar vista actual</h2>
        </header>
        <div className="save-view-body">
          <p className="muted">
            Guarda esta combinación de filtros y orden para aplicarla rápidamente en el futuro.
          </p>

          {/* Resumen de lo que se va a guardar */}
          <div className="save-view-summary">
            <div>
              <strong>Filtros activos:</strong>{' '}
              {activeFilterCount > 0 ? `${activeFilterCount}` : 'ninguno'}
            </div>
            <div>
              <strong>Orden:</strong>{' '}
              {sort.orderBy} ({sort.orderDir === 'asc' ? '↑' : '↓'})
            </div>
            <div>
              <strong>Tamaño página:</strong> {pageSize}
            </div>
          </div>

          <label className="save-view-field">
            <span>Nombre de la vista</span>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(); }}
              placeholder="Ej: Playas de Sanxenxo sin inglés"
              disabled={saving}
              maxLength={80}
            />
          </label>

          <label className="save-view-checkbox">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              disabled={saving}
            />
            <span>
              Marcar como vista por defecto
              {hasExistingDefault && isDefault && (
                <small className="muted"> · desplazará a la actual por defecto</small>
              )}
            </span>
          </label>

          {error && (
            <div className="save-view-error" role="alert">
              ⚠️ {error}
            </div>
          )}
        </div>
        <footer className="save-view-foot">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleSave()}
            disabled={saving || !name.trim()}
          >
            {saving ? 'Guardando…' : 'Guardar vista'}
          </button>
        </footer>
      </div>
    </div>
  );
}
