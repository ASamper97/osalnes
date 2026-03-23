'use client';

import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { Resource, Typology, Municipality, PaginatedResult } from '@/lib/api-client';
import type { Locale } from '@/i18n/config';

interface ResourceListProps {
  lang: Locale;
  dict: Record<string, string>;
  data: PaginatedResult<Resource>;
  typologies: Typology[];
  municipalities: Municipality[];
  showTypeFilter?: boolean;
  showMunicipioFilter?: boolean;
}

export function ResourceList({
  lang,
  dict,
  data,
  typologies,
  municipalities,
  showTypeFilter = true,
  showMunicipioFilter = true,
}: ResourceListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    router.push(`${pathname}?${params.toString()}`);
  }

  const currentType = searchParams.get('type') || '';
  const currentMunicipio = searchParams.get('municipio') || '';
  const currentPage = data.page;

  return (
    <>
      {/* Filters */}
      {(showTypeFilter || showMunicipioFilter) && (
        <div className="filters-bar">
          {showTypeFilter && (
            <select
              value={currentType}
              onChange={(e) => updateParam('type', e.target.value)}
              aria-label={dict.typology}
            >
              <option value="">{dict.all_types}</option>
              {typologies.map((t) => (
                <option key={t.id} value={t.typeCode}>
                  {t.name[lang] || t.name.es || t.typeCode}
                </option>
              ))}
            </select>
          )}
          {showMunicipioFilter && (
            <select
              value={currentMunicipio}
              onChange={(e) => updateParam('municipio', e.target.value)}
              aria-label={dict.municipality}
            >
              <option value="">{dict.all_municipalities}</option>
              {municipalities.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name[lang] || m.name.es || m.slug}
                </option>
              ))}
            </select>
          )}
          <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)', alignSelf: 'center' }}>
            {data.total} {dict.results_count}
          </span>
        </div>
      )}

      {/* Grid */}
      {data.items.length > 0 ? (
        <div className="card-grid">
          {data.items.map((r) => (
            <Link key={r.id} href={`/${lang}/recurso/${r.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <article className="card">
                <div className="card__image" />
                <div className="card__body">
                  {r.rdfType && <span className="card__badge">{r.rdfType}</span>}
                  <h3 className="card__title">
                    {r.name[lang] || r.name.es || r.name.gl || Object.values(r.name)[0]}
                  </h3>
                  <p className="card__desc">
                    {(r.description[lang] || r.description.es || r.description.gl || '').slice(0, 140)}
                    {(r.description[lang] || r.description.es || '').length > 140 ? '...' : ''}
                  </p>
                </div>
              </article>
            </Link>
          ))}
        </div>
      ) : (
        <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-muted)' }}>
          {dict.no_results}
        </p>
      )}

      {/* Pagination */}
      {data.pages > 1 && (
        <div className="pagination">
          <button
            disabled={currentPage <= 1}
            onClick={() => goToPage(currentPage - 1)}
          >
            {dict.previous}
          </button>
          <span>
            {dict.page_of.replace('{page}', String(currentPage)).replace('{pages}', String(data.pages))}
          </span>
          <button
            disabled={currentPage >= data.pages}
            onClick={() => goToPage(currentPage + 1)}
          >
            {dict.next}
          </button>
        </div>
      )}
    </>
  );
}
