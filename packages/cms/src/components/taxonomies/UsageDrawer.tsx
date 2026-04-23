/**
 * UsageDrawer — modal que muestra los recursos que usan un término
 *
 * Se abre al pulsar "Ver uso" en TermsList. Muestra los primeros 50
 * recursos ordenados por estado (publicados primero). Click en una
 * fila navega al wizard del recurso.
 *
 * Decisión 5-B con parte de C: contador + breakdown + tabla previewable.
 */

import { useEffect, useState } from 'react';
import type { TaxonomyCatalog, UsageItem } from '@osalnes/shared/data/taxonomies';
import { TAXONOMIES_COPY, interpolateTx } from '../../pages/taxonomies.copy';

const COPY = TAXONOMIES_COPY.usage;

export interface UsageDrawerProps {
  catalog: TaxonomyCatalog;
  termId: string;
  termName: string;
  onFetch: (id: string) => Promise<UsageItem[]>;
  onOpenResource?: (resourceId: string) => void;
  onClose: () => void;
}

export default function UsageDrawer({
  catalog, termId, termName, onFetch, onOpenResource, onClose,
}: UsageDrawerProps) {
  const [items, setItems] = useState<UsageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const result = await onFetch(termId);
        if (!cancelled) setItems(result);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error cargando uso');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [termId, onFetch]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Catálogos sin relación directa con recurso_turistico (zona/categoria/producto)
  const isDirectRelation = catalog === 'municipio' || catalog === 'tipologia_une';

  return (
    <div
      className="taxo-usage-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <aside className="taxo-usage-panel" role="dialog" aria-modal="true">
        <header>
          <div>
            <h2>{COPY.title}</h2>
            <p className="muted taxo-usage-term">{termName}</p>
          </div>
          <button type="button" className="taxo-usage-close" onClick={onClose}>×</button>
        </header>

        <div className="taxo-usage-body">
          {!isDirectRelation && (
            <div className="taxo-banner-info">ℹ {COPY.noUsageForCatalog}</div>
          )}

          {loading && <div className="taxo-usage-loading muted">{COPY.loading}</div>}

          {error && (
            <div className="taxo-editor-error" role="alert">⚠ {error}</div>
          )}

          {!loading && !error && isDirectRelation && items.length === 0 && (
            <div className="taxo-empty">
              <p className="muted">{COPY.empty}</p>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <ul className="taxo-usage-list" role="list">
              {items.map((item) => (
                <li key={item.resourceId} className="taxo-usage-item">
                  <button
                    type="button"
                    className="taxo-usage-item-btn"
                    onClick={() => onOpenResource?.(item.resourceId)}
                  >
                    <div className="taxo-usage-item-main">
                      <strong>{item.resourceName}</strong>
                      <code className="taxo-usage-item-slug muted">{item.resourceSlug}</code>
                    </div>
                    <span className={`taxo-usage-status taxo-usage-status-${item.estadoEditorial}`}>
                      {item.estadoEditorial}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length >= 50 && (
          <footer>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onOpenResource?.('')}
            >
              {interpolateTx(COPY.viewAllButton, { count: items.length })}
            </button>
          </footer>
        )}
      </aside>
    </div>
  );
}
