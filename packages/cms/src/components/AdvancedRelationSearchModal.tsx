/**
 * AdvancedRelationSearchModal — modal para buscar recurso destino con filtros
 *
 * Se abre desde el botón "Buscar más…" del autocomplete cuando el
 * usuario quiere filtrar por tipología, municipio o estado.
 */

import { useEffect, useState } from 'react';
import type { RelationSearchResult } from '@osalnes/shared/data/resource-relations';
import { STEP8_COPY } from '../pages/step8-relations.copy';

const COPY = STEP8_COPY.advancedSearch;

export interface TypologyOption { key: string; label: string; }
export interface MunicipalityOption { id: string; name: string; }

export interface AdvancedRelationSearchModalProps {
  typologies: TypologyOption[];
  municipalities: MunicipalityOption[];
  onSearch: (params: {
    query: string;
    typeFilter: string | null;
    municipalityFilter: string | null;
    statusFilter: string | null;
  }) => Promise<RelationSearchResult[]>;
  onSelect: (result: RelationSearchResult) => void;
  onClose: () => void;
}

export default function AdvancedRelationSearchModal({
  typologies,
  municipalities,
  onSearch,
  onSelect,
  onClose,
}: AdvancedRelationSearchModalProps) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [municipalityFilter, setMunicipalityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [results, setResults] = useState<RelationSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Buscar al cambiar cualquier filtro (con pequeño debounce)
  useEffect(() => {
    const t = setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const res = await onSearch({
            query: query.trim(),
            typeFilter: typeFilter || null,
            municipalityFilter: municipalityFilter || null,
            statusFilter: statusFilter || null,
          });
          setResults(res);
        } finally {
          setLoading(false);
        }
      })();
    }, 250);
    return () => clearTimeout(t);
  }, [query, typeFilter, municipalityFilter, statusFilter, onSearch]);

  return (
    <div
      className="advanced-search-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="advanced-search-modal" role="dialog" aria-modal="true">
        <header>
          <h2>{COPY.title}</h2>
          <button type="button" className="advanced-search-close" onClick={onClose}>×</button>
        </header>

        <div className="advanced-search-filters">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={COPY.searchPlaceholder}
            className="advanced-search-input"
            autoFocus
          />

          <div className="advanced-search-filter-row">
            <label className="advanced-search-filter">
              <span>{COPY.typeFilterLabel}</span>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">{COPY.typeFilterAny}</option>
                {typologies.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </select>
            </label>

            <label className="advanced-search-filter">
              <span>{COPY.municipalityFilterLabel}</span>
              <select value={municipalityFilter} onChange={(e) => setMunicipalityFilter(e.target.value)}>
                <option value="">{COPY.municipalityFilterAny}</option>
                {municipalities.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </label>

            <label className="advanced-search-filter">
              <span>{COPY.statusFilterLabel}</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">{COPY.statusFilterAny}</option>
                <option value="published">{COPY.statusPublished}</option>
                <option value="draft">{COPY.statusDraft}</option>
              </select>
            </label>
          </div>
        </div>

        <div className="advanced-search-results">
          {loading && <div className="advanced-search-loading muted">Buscando…</div>}
          {!loading && results.length === 0 && (
            <div className="advanced-search-empty muted">{COPY.noResults}</div>
          )}
          {!loading && results.length > 0 && (
            <>
              <div className="advanced-search-results-summary muted">
                {COPY.resultsSummary.replace('{count}', String(results.length))}
              </div>
              <ul className="advanced-search-results-list" role="list">
                {results.map((r) => (
                  <li key={r.id} className="advanced-search-result">
                    <div className="advanced-search-result-body">
                      <div className="advanced-search-result-name">{r.name}</div>
                      <div className="advanced-search-result-meta muted">
                        {r.type && <span>{r.type}</span>}
                        {r.municipalityName && (
                          <>
                            <span className="muted">·</span>
                            <span>{r.municipalityName}</span>
                          </>
                        )}
                        <span className="muted">·</span>
                        <span>Calidad {r.qualityScore}</span>
                        <span className="muted">·</span>
                        <span>{r.status}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        onSelect(r);
                        onClose();
                      }}
                    >
                      {COPY.selectButton}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <footer className="advanced-search-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {COPY.cancelButton}
          </button>
        </footer>
      </div>
    </div>
  );
}
