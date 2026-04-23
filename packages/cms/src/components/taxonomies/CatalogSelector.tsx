/**
 * CatalogSelector — panel izquierdo con la lista de catálogos (master)
 *
 * Decisión 8-C: master-detail. Este es el "master".
 */

import { type TaxonomyCatalog, CATALOGS, ALL_CATALOGS } from '@osalnes/shared/data/taxonomies';
import { TAXONOMIES_COPY } from '../../pages/taxonomies.copy';

const COPY = TAXONOMIES_COPY.masterList;

export interface CatalogSelectorProps {
  current: TaxonomyCatalog;
  onChange: (c: TaxonomyCatalog) => void;
  /** Conteos de términos por catálogo (opcional) */
  counts?: Partial<Record<TaxonomyCatalog, number>>;
}

export default function CatalogSelector({
  current,
  onChange,
  counts = {},
}: CatalogSelectorProps) {
  return (
    <nav className="taxo-catalog-selector" aria-label="Selector de catálogo">
      <h2 className="taxo-catalog-title">{COPY.title}</h2>
      <p className="taxo-catalog-hint muted">{COPY.hint}</p>

      <ul className="taxo-catalog-list" role="list">
        {ALL_CATALOGS.map((key) => {
          const meta = CATALOGS[key];
          const count = counts[key];
          const isCurrent = current === key;
          return (
            <li key={key}>
              <button
                type="button"
                className={`taxo-catalog-item ${isCurrent ? 'is-current' : ''}`}
                onClick={() => onChange(key)}
                aria-current={isCurrent ? 'true' : undefined}
              >
                <span className="taxo-catalog-item-icon" aria-hidden>{meta.icon}</span>
                <span className="taxo-catalog-item-body">
                  <span className="taxo-catalog-item-label">
                    {meta.labelPlural}
                    {meta.readonly && (
                      <span className="taxo-catalog-item-readonly">{COPY.readonlyLabel}</span>
                    )}
                  </span>
                  {count !== undefined && (
                    <span className="taxo-catalog-item-count">{count}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
