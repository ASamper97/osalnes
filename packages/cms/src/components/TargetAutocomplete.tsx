/**
 * TargetAutocomplete — buscador con autocompletado para elegir recurso destino
 *
 * Decisión 4-C: autocompletado rápido + botón "Buscar más…" que abre
 * el modal avanzado con filtros.
 */

import { useEffect, useRef, useState } from 'react';
import type {
  RelationSearchResult,
} from '@osalnes/shared/data/resource-relations';

export interface TargetAutocompleteProps {
  /** Función de búsqueda que pide resultados al backend */
  onSearch: (query: string) => Promise<RelationSearchResult[]>;
  /** Recurso seleccionado (o null si no hay) */
  selected: RelationSearchResult | null;
  /** Cambio de selección */
  onSelectionChange: (result: RelationSearchResult | null) => void;
  /** Abrir el modal avanzado */
  onOpenAdvancedSearch: () => void;
  placeholder?: string;
  disabled?: boolean;
  advancedSearchLabel?: string;
}

export default function TargetAutocomplete({
  onSearch,
  selected,
  onSelectionChange,
  onOpenAdvancedSearch,
  placeholder = 'Nombre del recurso…',
  disabled = false,
  advancedSearchLabel = 'Buscar más…',
}: TargetAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RelationSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce de 250ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || selected) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const res = await onSearch(query);
          setResults(res);
        } catch {
          setResults([]);
        } finally {
          setLoading(false);
        }
      })();
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selected, onSearch]);

  const showDropdown = focused && !selected && query.trim().length > 0;

  return (
    <div className="target-autocomplete">
      {selected ? (
        // Estado: hay recurso seleccionado
        <div className="target-autocomplete-selected">
          <div className="target-autocomplete-selected-body">
            <div className="target-autocomplete-selected-name">{selected.name}</div>
            <div className="target-autocomplete-selected-meta muted">
              {selected.type && <span>{selected.type}</span>}
              {selected.municipalityName && (
                <>
                  <span className="muted">·</span>
                  <span>{selected.municipalityName}</span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            className="target-autocomplete-clear"
            onClick={() => {
              onSelectionChange(null);
              setQuery('');
            }}
            disabled={disabled}
            aria-label="Quitar selección"
          >
            ×
          </button>
        </div>
      ) : (
        // Estado: buscando
        <div className="target-autocomplete-input-wrap">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="target-autocomplete-input"
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)} // dar tiempo al click
            aria-label={placeholder}
          />
          <button
            type="button"
            className="target-autocomplete-advanced-btn"
            onClick={onOpenAdvancedSearch}
            disabled={disabled}
          >
            🔍 {advancedSearchLabel}
          </button>

          {showDropdown && (
            <div className="target-autocomplete-dropdown" role="listbox">
              {loading && <div className="target-autocomplete-loading muted">Buscando…</div>}
              {!loading && results.length === 0 && (
                <div className="target-autocomplete-empty muted">Sin coincidencias</div>
              )}
              {!loading && results.length > 0 && (
                <ul role="list">
                  {results.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        className="target-autocomplete-option"
                        onClick={() => {
                          onSelectionChange(r);
                          setQuery('');
                        }}
                        role="option"
                        aria-selected={false}
                      >
                        <div className="target-autocomplete-option-name">{r.name}</div>
                        <div className="target-autocomplete-option-meta muted">
                          {r.type && <span>{r.type}</span>}
                          {r.municipalityName && (
                            <>
                              <span className="muted">·</span>
                              <span>{r.municipalityName}</span>
                            </>
                          )}
                          <span className="muted">·</span>
                          <span className="target-autocomplete-option-quality">
                            Calidad {r.qualityScore}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
