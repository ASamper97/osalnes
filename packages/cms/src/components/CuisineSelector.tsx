/**
 * CuisineSelector — multi-select de tipos de cocina según catálogo UNE 178503
 *
 * Sustituye al textarea libre "Gallega, Mariscos, Tapas" anterior. Guarda
 * un array de códigos UNE ("SPANISH", "FISH AND SEAFOOD", ...) que se
 * exportan directamente al PID como `servesCuisine`.
 *
 * UX:
 *   - Los tipos "high" (más comunes en O Salnés) aparecen arriba como chips
 *     grandes para clic rápido.
 *   - Los "medium" aparecen debajo plegables.
 *   - Los "low" (cocinas exóticas poco comunes) están tras un separador
 *     "Otras cocinas" que se expande si el usuario las busca.
 *   - Campo de búsqueda filtra toda la lista.
 *
 * Accesibilidad:
 *   - Checkboxes nativos + labels asociados.
 *   - Campo de búsqueda con role="searchbox".
 *   - Estado seleccionado en un <ul> con role="list" anunciado al lector
 *     de pantalla con aria-live="polite".
 */

import { useMemo, useState } from 'react';
import {
  CUISINE_CATALOG,
  findCuisine,
  type CuisineType,
} from '@osalnes/shared/data/cuisine-catalog';
import { STEP4_COPY } from '../pages/step4-classification.copy';

export interface CuisineSelectorProps {
  /** Códigos UNE seleccionados, p.ej. ['SPANISH', 'FISH AND SEAFOOD'] */
  selected: string[];
  onChange: (next: string[]) => void;
  /** Idioma para mostrar etiquetas. Default: 'es' */
  lang?: 'es' | 'gl';
}

export default function CuisineSelector({
  selected,
  onChange,
  lang = 'es',
}: CuisineSelectorProps) {
  const COPY = STEP4_COPY.establishment;
  const [search, setSearch] = useState('');
  const [showLow, setShowLow] = useState(false);

  const toggle = (code: string) => {
    if (selected.includes(code)) {
      onChange(selected.filter((c) => c !== code));
    } else {
      onChange([...selected, code]);
    }
  };

  const label = (c: CuisineType) => (lang === 'gl' ? c.labelGl : c.labelEs);

  // Filtrado por búsqueda
  const filtered = useMemo(() => {
    if (!search.trim()) return CUISINE_CATALOG;
    const q = search.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return CUISINE_CATALOG.filter((c) => {
      const hay = `${c.labelEs} ${c.labelGl} ${c.code}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return hay.includes(q);
    });
  }, [search]);

  const high   = filtered.filter((c) => c.relevance === 'high');
  const medium = filtered.filter((c) => c.relevance === 'medium');
  const low    = filtered.filter((c) => c.relevance === 'low');
  const hasSearch = search.trim().length > 0;

  // Chips de seleccionadas (siempre visibles arriba)
  const selectedItems = selected
    .map((code) => findCuisine(code))
    .filter((c): c is CuisineType => c !== null);

  return (
    <div className="cuisine-selector">
      {/* Chips de seleccionadas */}
      {selectedItems.length > 0 && (
        <ul
          className="cuisine-selected"
          role="list"
          aria-live="polite"
          aria-label={`${selectedItems.length} ${COPY.cuisineSelectedLabel}`}
        >
          {selectedItems.map((c) => (
            <li key={c.code} className="cuisine-chip is-selected">
              <span>{label(c)}</span>
              <button
                type="button"
                className="cuisine-chip-remove"
                onClick={() => toggle(c.code)}
                aria-label={`Quitar ${label(c)}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Buscador */}
      <input
        type="search"
        role="searchbox"
        className="cuisine-search"
        placeholder="Buscar un tipo de cocina..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        aria-label="Buscar un tipo de cocina"
      />

      {/* Grupos */}
      {high.length > 0 && (
        <div className="cuisine-group">
          {!hasSearch && <h5 className="cuisine-group-title">{COPY.cuisineRelevantHeading}</h5>}
          <div className="cuisine-group-items">
            {high.map((c) => (
              <CuisineOption
                key={c.code}
                cuisine={c}
                label={label(c)}
                checked={selected.includes(c.code)}
                onToggle={() => toggle(c.code)}
              />
            ))}
          </div>
        </div>
      )}

      {medium.length > 0 && (
        <div className="cuisine-group">
          <div className="cuisine-group-items">
            {medium.map((c) => (
              <CuisineOption
                key={c.code}
                cuisine={c}
                label={label(c)}
                checked={selected.includes(c.code)}
                onToggle={() => toggle(c.code)}
              />
            ))}
          </div>
        </div>
      )}

      {low.length > 0 && (
        <div className="cuisine-group">
          {!hasSearch && (
            <button
              type="button"
              className="cuisine-low-toggle"
              onClick={() => setShowLow((v) => !v)}
              aria-expanded={showLow}
            >
              {showLow ? '− ' : '+ '}
              {COPY.cuisineOtherHeading} ({low.length})
            </button>
          )}
          {(showLow || hasSearch) && (
            <div className="cuisine-group-items">
              {low.map((c) => (
                <CuisineOption
                  key={c.code}
                  cuisine={c}
                  label={label(c)}
                  checked={selected.includes(c.code)}
                  onToggle={() => toggle(c.code)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {filtered.length === 0 && (
        <p className="muted cuisine-empty">No se ha encontrado ningún tipo de cocina.</p>
      )}
    </div>
  );
}

// ─── Opción individual ─────────────────────────────────────────────────

function CuisineOption({
  cuisine,
  label,
  checked,
  onToggle,
}: {
  cuisine: CuisineType;
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className={`cuisine-option ${checked ? 'is-checked' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        aria-label={label}
      />
      <span>{label}</span>
    </label>
  );
}
