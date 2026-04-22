/**
 * ListFiltersPanel — panel de filtros facetados del listado (SCR-03)
 *
 * Decisión 1-C: multi-select tipologías (agrupadas por categoría raíz),
 * multi-select municipios, filtros por idiomas sin traducir, visible
 * en mapa, coordenadas, incompletos para publicar, solo mis recursos.
 *
 * Diseño: toolbar compacta con chips + botón "Más filtros" que abre un
 * drawer lateral con las opciones avanzadas. En móvil todo en drawer.
 */

import { useState } from 'react';
import {
  type ListFilters,
  countActiveFilters,
  hasActiveFilters,
  EMPTY_FILTERS,
} from '@osalnes/shared/data/resources-list';
import { LIST_COPY } from '../../pages/listado.copy';

const COPY = LIST_COPY.filters;

export interface MunicipalityOption {
  id: string;
  name: string;
}
export interface TypologyOption {
  key: string;
  label: string;
  /** Grupo raíz: 'alojamiento' | 'gastronomia' | 'naturaleza' | 'patrimonio' | 'eventos' | ... */
  rootCategory: string;
  rootCategoryLabel: string;
  /** Conteo de recursos que tienen esta tipología */
  count?: number;
}

export interface ListFiltersPanelProps {
  filters: ListFilters;
  onUpdate: <K extends keyof ListFilters>(key: K, value: ListFilters[K]) => void;
  onClearAll: () => void;

  typologies: TypologyOption[];
  municipalities: MunicipalityOption[];
}

export default function ListFiltersPanel({
  filters,
  onUpdate,
  onClearAll,
  typologies,
  municipalities,
}: ListFiltersPanelProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const activeCount = countActiveFilters(filters);
  const hasAny = hasActiveFilters(filters);

  return (
    <>
      {/* Barra principal: search + quick filters + toggle drawer */}
      <div className="list-filters-bar">
        <div className="list-filters-search">
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onUpdate('search', e.target.value)}
            placeholder={LIST_COPY.search.placeholder}
            className="list-filters-search-input"
            aria-label={LIST_COPY.search.placeholder}
          />
          {filters.search && (
            <button
              type="button"
              className="list-filters-search-clear"
              onClick={() => onUpdate('search', '')}
              aria-label={LIST_COPY.search.clearLabel}
            >
              ×
            </button>
          )}
        </div>

        <QuickSelect
          label={COPY.typologyLabel}
          placeholder={COPY.typologyPlaceholder}
          selected={filters.typeKeys}
          options={typologies.map((t) => ({
            value: t.key,
            label: t.label,
            group: t.rootCategoryLabel,
            count: t.count,
          }))}
          onChange={(vals) => onUpdate('typeKeys', vals)}
        />

        <QuickSelect
          label={COPY.municipalityLabel}
          placeholder={COPY.municipalityPlaceholder}
          selected={filters.municipalityIds}
          options={municipalities.map((m) => ({
            value: m.id,
            label: m.name,
          }))}
          onChange={(vals) => onUpdate('municipalityIds', vals)}
        />

        <button
          type="button"
          className={`list-filters-toggle ${activeCount > 0 ? 'has-count' : ''}`}
          onClick={() => setDrawerOpen(true)}
          aria-label={COPY.toggleLabel}
          aria-expanded={drawerOpen}
        >
          {activeCount > 0
            ? COPY.toggleLabelWithCount.replace('{count}', String(activeCount))
            : COPY.toggleLabel}
        </button>

        {hasAny && (
          <button
            type="button"
            className="list-filters-clear-all"
            onClick={onClearAll}
          >
            {COPY.clearAll}
          </button>
        )}
      </div>

      {/* Chips de filtros activos */}
      {hasAny && (
        <div className="list-filters-active-chips" role="list">
          {filters.languagesMissing.map((lang) => (
            <ActiveChip
              key={`lm-${lang}`}
              label={`Sin ${lang.toUpperCase()}`}
              onRemove={() =>
                onUpdate(
                  'languagesMissing',
                  filters.languagesMissing.filter((l) => l !== lang),
                )
              }
            />
          ))}
          {filters.visibleOnMap !== null && (
            <ActiveChip
              label={filters.visibleOnMap ? 'Visible en mapa' : 'No visible en mapa'}
              onRemove={() => onUpdate('visibleOnMap', null)}
            />
          )}
          {filters.hasCoordinates === false && (
            <ActiveChip
              label="Sin coordenadas"
              onRemove={() => onUpdate('hasCoordinates', null)}
            />
          )}
          {filters.incompleteForPublish && (
            <ActiveChip
              label="Incompletos para publicar"
              onRemove={() => onUpdate('incompleteForPublish', null)}
            />
          )}
          {filters.onlyMine && (
            <ActiveChip label="Solo mis recursos" onRemove={() => onUpdate('onlyMine', false)} />
          )}
        </div>
      )}

      {/* Drawer con filtros avanzados */}
      {drawerOpen && (
        <FilterDrawer
          filters={filters}
          onUpdate={onUpdate}
          onClose={() => setDrawerOpen(false)}
          onClearAll={() => {
            onClearAll();
            setDrawerOpen(false);
          }}
        />
      )}
    </>
  );
}

// ─── QuickSelect · multi-select compacto ──────────────────────────────

interface QuickSelectProps {
  label: string;
  placeholder: string;
  selected: string[];
  options: Array<{
    value: string;
    label: string;
    group?: string;
    count?: number;
  }>;
  onChange: (vals: string[]) => void;
}

function QuickSelect({ label, placeholder, selected, options, onChange }: QuickSelectProps) {
  const [open, setOpen] = useState(false);

  const toggle = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((v) => v !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const groups = new Map<string, typeof options>();
  for (const opt of options) {
    const g = opt.group ?? '';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(opt);
  }

  const buttonLabel =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? placeholder
        : `${label} · ${selected.length}`;

  return (
    <div className="list-filters-quickselect">
      <button
        type="button"
        className={`list-filters-quickselect-btn ${selected.length > 0 ? 'is-active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {buttonLabel} ▾
      </button>

      {open && (
        <>
          <div className="list-filters-quickselect-backdrop" onClick={() => setOpen(false)} />
          <div className="list-filters-quickselect-panel" role="listbox">
            {Array.from(groups.entries()).map(([group, opts]) => (
              <div key={group} className="list-filters-quickselect-group">
                {group && <div className="list-filters-quickselect-group-label">{group}</div>}
                {opts.map((opt) => (
                  <label key={opt.value} className="list-filters-quickselect-option">
                    <input
                      type="checkbox"
                      checked={selected.includes(opt.value)}
                      onChange={() => toggle(opt.value)}
                    />
                    <span>{opt.label}</span>
                    {opt.count != null && (
                      <span className="list-filters-quickselect-count">({opt.count})</span>
                    )}
                  </label>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Drawer con filtros avanzados ─────────────────────────────────────

interface FilterDrawerProps {
  filters: ListFilters;
  onUpdate: <K extends keyof ListFilters>(key: K, value: ListFilters[K]) => void;
  onClose: () => void;
  onClearAll: () => void;
}

function FilterDrawer({ filters, onUpdate, onClose, onClearAll }: FilterDrawerProps) {
  return (
    <>
      <div className="list-filters-drawer-backdrop" onClick={onClose} />
      <aside className="list-filters-drawer" role="dialog" aria-label="Filtros avanzados">
        <header className="list-filters-drawer-head">
          <h3>Filtros</h3>
          <button type="button" className="list-filters-drawer-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className="list-filters-drawer-body">
          {/* Idiomas sin traducir */}
          <fieldset className="list-filters-drawer-group">
            <legend>{COPY.languagesMissingLabel}</legend>
            <p className="list-filters-drawer-hint">{COPY.languagesMissingHint}</p>
            <div className="list-filters-lang-chips">
              {(['gl', 'en', 'fr', 'pt'] as const).map((lang) => (
                <label key={lang} className="list-filters-lang-chip">
                  <input
                    type="checkbox"
                    checked={filters.languagesMissing.includes(lang)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...filters.languagesMissing, lang]
                        : filters.languagesMissing.filter((l) => l !== lang);
                      onUpdate('languagesMissing', next);
                    }}
                  />
                  <span>{lang.toUpperCase()}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Visible en mapa */}
          <fieldset className="list-filters-drawer-group">
            <legend>{COPY.visibleOnMapLabel}</legend>
            <div className="list-filters-tristate">
              <TriStateButton
                label={COPY.visibleOnMapYes}
                active={filters.visibleOnMap === true}
                onClick={() => onUpdate('visibleOnMap', filters.visibleOnMap === true ? null : true)}
              />
              <TriStateButton
                label={COPY.visibleOnMapNo}
                active={filters.visibleOnMap === false}
                onClick={() => onUpdate('visibleOnMap', filters.visibleOnMap === false ? null : false)}
              />
            </div>
          </fieldset>

          {/* Coordenadas */}
          <fieldset className="list-filters-drawer-group">
            <legend>{COPY.hasCoordinatesLabel}</legend>
            <div className="list-filters-tristate">
              <TriStateButton
                label={COPY.hasCoordinatesYes}
                active={filters.hasCoordinates === true}
                onClick={() =>
                  onUpdate('hasCoordinates', filters.hasCoordinates === true ? null : true)
                }
              />
              <TriStateButton
                label={COPY.hasCoordinatesNo}
                active={filters.hasCoordinates === false}
                onClick={() =>
                  onUpdate('hasCoordinates', filters.hasCoordinates === false ? null : false)
                }
              />
            </div>
          </fieldset>

          {/* Incompletos para publicar */}
          <fieldset className="list-filters-drawer-group">
            <legend>{COPY.incompleteLabel}</legend>
            <p className="list-filters-drawer-hint">{COPY.incompleteHint}</p>
            <label className="list-filters-drawer-toggle">
              <input
                type="checkbox"
                checked={filters.incompleteForPublish === true}
                onChange={(e) =>
                  onUpdate('incompleteForPublish', e.target.checked ? true : null)
                }
              />
              <span>Solo incompletos</span>
            </label>
          </fieldset>

          {/* Solo mis recursos */}
          <fieldset className="list-filters-drawer-group">
            <label className="list-filters-drawer-toggle">
              <input
                type="checkbox"
                checked={filters.onlyMine}
                onChange={(e) => onUpdate('onlyMine', e.target.checked)}
              />
              <span>{COPY.onlyMineLabel}</span>
            </label>
          </fieldset>
        </div>

        <footer className="list-filters-drawer-foot">
          <button type="button" className="btn btn-ghost" onClick={onClearAll}>
            {COPY.clearAll}
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {COPY.applyButton}
          </button>
        </footer>
      </aside>
    </>
  );
}

function TriStateButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`list-filters-tristate-btn ${active ? 'is-active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="list-filters-active-chip" role="listitem">
      <span>{label}</span>
      <button type="button" onClick={onRemove} aria-label={`Quitar filtro ${label}`}>
        ×
      </button>
    </span>
  );
}

export { EMPTY_FILTERS };
