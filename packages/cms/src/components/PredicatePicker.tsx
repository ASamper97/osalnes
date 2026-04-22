/**
 * PredicatePicker — selector de tipo de relación
 *
 * Muestra los 6 predicados creables con icono, etiqueta y descripción.
 * Dropdown que se abre hacia abajo.
 */

import { useState } from 'react';
import {
  CREATABLE_PREDICATES,
  PREDICATES,
  type RelationPredicate,
} from '@osalnes/shared/data/resource-relations';

export interface PredicatePickerProps {
  value: RelationPredicate | null;
  onChange: (predicate: RelationPredicate) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function PredicatePicker({
  value,
  onChange,
  placeholder = 'Elige el tipo…',
  disabled = false,
}: PredicatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? PREDICATES[value] : null;

  return (
    <div className="predicate-picker">
      <button
        type="button"
        className="predicate-picker-trigger"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {selected ? (
          <>
            <span aria-hidden>{selected.icon}</span>
            <span>{selected.label}</span>
          </>
        ) : (
          <span className="muted">{placeholder}</span>
        )}
        <span className="predicate-picker-arrow" aria-hidden>▾</span>
      </button>

      {open && !disabled && (
        <>
          <div className="predicate-picker-backdrop" onClick={() => setOpen(false)} />
          <div className="predicate-picker-menu" role="listbox">
            {CREATABLE_PREDICATES.map((pred) => (
              <button
                key={pred.key}
                type="button"
                className={`predicate-picker-option ${value === pred.key ? 'is-selected' : ''}`}
                onClick={() => {
                  onChange(pred.key);
                  setOpen(false);
                }}
                role="option"
                aria-selected={value === pred.key}
              >
                <span className="predicate-picker-option-icon" aria-hidden>{pred.icon}</span>
                <div className="predicate-picker-option-body">
                  <div className="predicate-picker-option-label">{pred.label}</div>
                  <div className="predicate-picker-option-description">{pred.description}</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
