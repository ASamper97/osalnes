/**
 * TermsList — listado de términos del catálogo actual (detail)
 *
 * Soporta:
 * - Búsqueda por nombre / slug
 * - Indentación para jerarquías (decisión 2-B)
 * - Chip de uso con breakdown por estado (decisión 5-B)
 * - Warning de URI semántica ausente (decisión 4-C)
 * - Acciones: editar, desactivar, ver uso
 */

import { useMemo, useState } from 'react';
import {
  type TaxonomyCatalog,
  type TaxonomyTerm,
  CATALOGS,
} from '@osalnes/shared/data/taxonomies';
import { TAXONOMIES_COPY, interpolateTx } from '../../pages/taxonomies.copy';

const COPY = TAXONOMIES_COPY;

export interface TermsListProps {
  catalog: TaxonomyCatalog;
  terms: TaxonomyTerm[];
  loading: boolean;
  canEdit: boolean;
  onEdit: (id: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
  onViewUsage: (id: string) => void;
  includeInactive: boolean;
  onToggleIncludeInactive: (b: boolean) => void;
  onNewTerm: () => void;
}

export default function TermsList({
  catalog,
  terms,
  loading,
  canEdit,
  onEdit,
  onToggleActive,
  onViewUsage,
  includeInactive,
  onToggleIncludeInactive,
  onNewTerm,
}: TermsListProps) {
  const meta = CATALOGS[catalog];
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return terms;
    return terms.filter((t) =>
      t.name.toLowerCase().includes(q) ||
      t.slug.toLowerCase().includes(q) ||
      (t.description ?? '').toLowerCase().includes(q),
    );
  }, [terms, search]);

  return (
    <div className="taxo-terms-list">
      <header className="taxo-terms-header">
        <div>
          <h2 className="taxo-terms-title">
            <span aria-hidden>{meta.icon}</span> {meta.labelPlural}
          </h2>
          <p className="taxo-terms-hint muted">{meta.hint}</p>
        </div>

        {canEdit && !meta.readonly && (
          <button type="button" className="btn btn-primary" onClick={onNewTerm}>
            + {COPY.toolbar.newButton}
          </button>
        )}
      </header>

      {meta.readonly && (
        <div className="taxo-banner-info">
          ℹ {COPY.readonlyBanner.municipio}
        </div>
      )}

      {!canEdit && !meta.readonly && (
        <div className="taxo-banner-warn">
          🔒 {COPY.noPermissionBanner}
        </div>
      )}

      <div className="taxo-toolbar">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={COPY.toolbar.searchPlaceholder}
          className="taxo-search"
        />
        <label className="taxo-show-inactive">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => onToggleIncludeInactive(e.target.checked)}
          />
          <span>{COPY.toolbar.showInactive}</span>
        </label>
      </div>

      {loading && filtered.length === 0 && (
        <div className="taxo-skeleton">
          <div className="taxo-skeleton-row" />
          <div className="taxo-skeleton-row" />
          <div className="taxo-skeleton-row" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="taxo-empty">
          <strong>{COPY.list.emptyTitle}</strong>
          <p className="muted">{COPY.list.emptyHint}</p>
        </div>
      )}

      {filtered.length > 0 && (
        <ul className="taxo-terms-ul" role="list">
          {filtered.map((term) => (
            <TermRow
              key={term.id}
              term={term}
              catalog={catalog}
              canEdit={canEdit && !meta.readonly}
              onEdit={() => onEdit(term.id)}
              onToggleActive={() => onToggleActive(term.id, !term.isActive)}
              onViewUsage={() => onViewUsage(term.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Fila individual ──────────────────────────────────────────────────

interface TermRowProps {
  term: TaxonomyTerm;
  catalog: TaxonomyCatalog;
  canEdit: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  onViewUsage: () => void;
}

function TermRow({
  term, catalog, canEdit, onEdit, onToggleActive, onViewUsage,
}: TermRowProps) {
  const needsSemanticUri = catalog === 'tipologia_une' && !term.semanticUri;

  return (
    <li className={`taxo-term ${term.isActive ? '' : 'is-inactive'}`}>
      <div className="taxo-term-main">
        <div className="taxo-term-top">
          <strong className="taxo-term-name">{term.name}</strong>
          {!term.isActive && (
            <span className="taxo-chip taxo-chip-inactive">{TAXONOMIES_COPY.list.inactiveLabel}</span>
          )}
          {term.hasChildren && (
            <span className="taxo-chip taxo-chip-neutral">{TAXONOMIES_COPY.list.hasChildrenLabel}</span>
          )}
          {needsSemanticUri && (
            <span className="taxo-chip taxo-chip-warn">{TAXONOMIES_COPY.list.noSemanticUriHint}</span>
          )}
        </div>

        <div className="taxo-term-meta muted">
          <code className="taxo-term-slug">{term.slug}</code>
          {term.semanticUri && (
            <>
              <span className="muted">·</span>
              <a
                href={term.semanticUri}
                target="_blank"
                rel="noreferrer"
                className="taxo-term-uri"
                onClick={(e) => e.stopPropagation()}
              >
                {term.semanticUri}
              </a>
            </>
          )}
          {term.schemaCode && (
            <>
              <span className="muted">·</span>
              <span>schema.org: <code>{term.schemaCode}</code></span>
            </>
          )}
        </div>

        {term.description && (
          <div className="taxo-term-desc muted">{term.description}</div>
        )}

        {term.usageCount > 0 && (
          <div className="taxo-term-usage">
            <strong>{TAXONOMIES_COPY.list.usageLabel}</strong>
            <span className="taxo-usage-total">{term.usageCount}</span>
            {term.usagePublished > 0 && (
              <span className="taxo-usage-pub">
                {interpolateTx(TAXONOMIES_COPY.list.usagePublished, { count: term.usagePublished })}
              </span>
            )}
            {term.usageDraft > 0 && (
              <span className="taxo-usage-draft">
                {interpolateTx(TAXONOMIES_COPY.list.usageDraft, { count: term.usageDraft })}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="taxo-term-actions">
        {term.usageCount > 0 && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onViewUsage}
          >
            {TAXONOMIES_COPY.list.viewUsageButton}
          </button>
        )}
        {canEdit && (
          <>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onEdit}
            >
              {TAXONOMIES_COPY.list.editButton}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onToggleActive}
              title={term.isActive ? TAXONOMIES_COPY.list.toggleActiveOff : TAXONOMIES_COPY.list.toggleActiveOn}
            >
              {term.isActive ? '🚫' : '✓'}
            </button>
          </>
        )}
      </div>
    </li>
  );
}
