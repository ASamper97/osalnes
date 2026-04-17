/**
 * TagSelector — selector contextual de etiquetas UNE 178503 para el wizard
 *
 * Sustituye al desplegable plano "tipos turismo UNE 178503" del paso 4 anterior.
 *
 * Comportamiento:
 *   - Lee del catálogo de tipologías (`resource-type-catalog.ts`) qué grupos
 *     deben mostrarse para el tipo seleccionado en el paso 1.
 *   - Renderiza cada grupo como una tarjeta colapsable con checkboxes.
 *   - Cada checkbox muestra un badge del campo PID al que mapea (type /
 *     touristType / amenityFeature / accessibility / cuisine / addressLocality /
 *     editorial / cms) y un indicador "exportable a PID" o "solo CMS".
 *   - Permite buscar libremente en cualquier grupo.
 *   - Expone el estado como `string[]` de `tag_key` para escribir en
 *     `resource_tags` al guardar.
 *
 * Estilos: ver tag-selector.css (o copiar al styles.css global).
 */

import { useMemo, useState } from 'react';
import {
  TAGS_BY_GROUP,
  GROUP_BY_KEY,
  getWizardGroupsForType,
  type Tag,
  type TagGroup,
} from '@osalnes/shared';

// ─────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────

export interface TagSelectorProps {
  /** Etiqueta del tipo (xlsx label) — determina qué grupos se muestran */
  resourceTypeLabel: string | null | undefined;
  /** Claves de etiquetas actualmente seleccionadas */
  value: string[];
  /** Callback al cambiar la selección */
  onChange: (nextKeys: string[]) => void;
  /** Muestra también grupos no aplicables al tipo, colapsados (default: false) */
  showAllGroups?: boolean;
  /** Muestra grupo "Municipio" (por defecto true; desactivar si ya se pide en paso 3) */
  includeMunicipio?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  type: 'type',
  touristType: 'touristType',
  amenityFeature: 'amenity',
  accessibility: 'accessibility',
  addressLocality: 'locality',
  cuisine: 'cuisine',
  editorial: 'editorial',
  cms: 'cms',
};

const FIELD_COLOR: Record<string, string> = {
  type: '#7c3aed',
  touristType: '#059669',
  amenityFeature: '#0891b2',
  accessibility: '#d97706',
  addressLocality: '#16a34a',
  cuisine: '#ca8a04',
  editorial: '#6b7280',
  cms: '#6b7280',
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ─────────────────────────────────────────────────────────────────────────
// Subcomponentes
// ─────────────────────────────────────────────────────────────────────────

function FieldBadge({ field }: { field: string }) {
  return (
    <span
      className="tag-field-badge"
      style={{ backgroundColor: FIELD_COLOR[field] ?? '#6b7280' }}
      title={`Campo PID: ${field}`}
    >
      {FIELD_LABELS[field] ?? field}
    </span>
  );
}

function PidIndicator({ tag }: { tag: Tag }) {
  if (tag.field === 'editorial' || tag.field === 'cms') {
    return (
      <span className="tag-pid-indicator tag-pid-cms" title="Solo CMS — no se exporta a PID">
        solo CMS
      </span>
    );
  }
  if (!tag.pidExportable) {
    return (
      <span className="tag-pid-indicator tag-pid-no" title="No exportable a PID">
        no PID
      </span>
    );
  }
  if (tag.pidNote) {
    return (
      <span className="tag-pid-indicator tag-pid-check" title={tag.pidNote}>
        PID*
      </span>
    );
  }
  return (
    <span className="tag-pid-indicator tag-pid-yes" title="Exportable a PID">
      PID
    </span>
  );
}

interface GroupCardProps {
  group: TagGroup;
  tags: Tag[];
  selected: Set<string>;
  onToggle: (key: string) => void;
  initiallyOpen?: boolean;
  dimmed?: boolean;
}

function GroupCard({ group, tags, selected, onToggle, initiallyOpen = true, dimmed }: GroupCardProps) {
  const [open, setOpen] = useState(initiallyOpen);
  const selectedInGroup = tags.filter((t) => selected.has(t.key)).length;

  return (
    <div
      className={`tag-group-card${dimmed ? ' tag-group-card--dimmed' : ''}`}
      style={{ borderLeftColor: group.color }}
    >
      <button
        type="button"
        className="tag-group-header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="tag-group-indicator" style={{ backgroundColor: group.color }} />
        <span className="tag-group-title">{group.label}</span>
        <span className="tag-group-meta">
          {selectedInGroup > 0 ? `${selectedInGroup} / ${tags.length}` : `${tags.length}`}
        </span>
        <span className="tag-group-chevron">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <>
          <p className="tag-group-desc">{group.description}</p>
          <ul className="tag-list">
            {tags.map((t) => {
              const checked = selected.has(t.key);
              return (
                <li key={t.key} className={`tag-item${checked ? ' tag-item--on' : ''}`}>
                  <label className="tag-row">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(t.key)}
                    />
                    <span className="tag-label">{t.label}</span>
                    <FieldBadge field={t.field} />
                    <PidIndicator tag={t} />
                  </label>
                  {t.notes && <p className="tag-note">{t.notes}</p>}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// TagSelector (componente principal)
// ─────────────────────────────────────────────────────────────────────────

export default function TagSelector({
  resourceTypeLabel,
  value,
  onChange,
  showAllGroups = false,
  includeMunicipio = true,
}: TagSelectorProps) {
  const [query, setQuery] = useState('');

  const applicableGroupKeys = useMemo(() => {
    const base = getWizardGroupsForType(resourceTypeLabel);
    return includeMunicipio ? base : base.filter((g) => g !== 'municipio');
  }, [resourceTypeLabel, includeMunicipio]);

  const applicableSet = useMemo(() => new Set(applicableGroupKeys), [applicableGroupKeys]);

  // Ordered group list
  const allGroupsSorted = useMemo(() => {
    const groups = Object.values(GROUP_BY_KEY).slice().sort((a, b) => a.order - b.order);
    if (showAllGroups) return groups;
    return groups.filter((g) => applicableSet.has(g.key));
  }, [applicableSet, showAllGroups]);

  const selectedSet = useMemo(() => new Set(value), [value]);

  const toggle = (key: string) => {
    const next = new Set(selectedSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(Array.from(next));
  };

  const filterTag = (t: Tag): boolean => {
    if (!query.trim()) return true;
    const q = normalize(query);
    return (
      normalize(t.label).includes(q) ||
      normalize(t.value).includes(q) ||
      normalize(t.field).includes(q)
    );
  };

  const totalSelected = value.length;
  const totalPidExportable = useMemo(
    () =>
      value.filter((k) => {
        for (const group of Object.values(TAGS_BY_GROUP)) {
          const tag = group.find((t) => t.key === k);
          if (tag) return tag.pidExportable;
        }
        return false;
      }).length,
    [value],
  );

  return (
    <div className="tag-selector">
      {/* Barra superior: resumen + buscador */}
      <div className="tag-selector-toolbar">
        <div className="tag-selector-counts">
          <strong>{totalSelected}</strong> etiquetas seleccionadas
          {totalSelected > 0 && (
            <span className="tag-selector-count-pid">
              · <strong>{totalPidExportable}</strong> exportables a PID
            </span>
          )}
        </div>
        <div className="tag-selector-search">
          <input
            type="search"
            placeholder="Buscar etiqueta…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar etiqueta"
          />
        </div>
      </div>

      {/* Aviso si no hay tipo seleccionado */}
      {!resourceTypeLabel && (
        <div className="tag-selector-hint">
          Selecciona primero la <em>tipología principal</em> en el paso 1 para que aparezcan los
          grupos de etiquetas relevantes.
        </div>
      )}

      {/* Grupos aplicables */}
      {allGroupsSorted.map((g) => {
        const tags = (TAGS_BY_GROUP[g.key] ?? []).filter(filterTag);
        if (tags.length === 0) return null;
        return (
          <GroupCard
            key={g.key}
            group={g}
            tags={tags}
            selected={selectedSet}
            onToggle={toggle}
            initiallyOpen={applicableSet.has(g.key)}
            dimmed={!applicableSet.has(g.key)}
          />
        );
      })}

      {/* Toggle al final: mostrar grupos no aplicables */}
      {!showAllGroups && applicableGroupKeys.length < Object.keys(GROUP_BY_KEY).length && (
        <p className="tag-selector-foot">
          <small>
            Mostrando <strong>{applicableGroupKeys.length}</strong> grupos aplicables para{' '}
            <em>{resourceTypeLabel ?? 'este tipo'}</em>.
          </small>
        </p>
      )}
    </div>
  );
}
