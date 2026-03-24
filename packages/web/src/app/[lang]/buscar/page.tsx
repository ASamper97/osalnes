'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import type { Locale } from '@/i18n/config';

interface SearchPageProps {
  params: { lang: Locale };
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

function SearchContent({ lang }: { lang: Locale }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get('q') || '';

  const [query, setQuery] = useState(q);
  const [results, setResults] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dict, setDict] = useState<Record<string, string>>({});

  // Load dictionary client-side
  useEffect(() => {
    import(`@/i18n/dictionaries/${lang}.json`).then((m) => setDict(m.default));
  }, [lang]);

  // Search when q changes
  useEffect(() => {
    if (!q) { setResults([]); setTotal(0); return; }
    setLoading(true);
    const url = new URL(`${API_BASE}/search`);
    url.searchParams.set('q', q);
    url.searchParams.set('lang', lang);
    url.searchParams.set('limit', '20');
    fetch(url.toString())
      .then((r) => r.json())
      .then((data) => {
        setResults(data.items || []);
        setTotal(data.total || 0);
      })
      .catch(() => { setResults([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [q, lang]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/${lang}/buscar?q=${encodeURIComponent(query.trim())}`);
    }
  }

  return (
    <>
      <h1 style={{ fontSize: '2rem', color: 'var(--color-primary)', marginBottom: '1.5rem' }}>
        {dict.search || 'Buscar'}
      </h1>

      <form className="search-form" onSubmit={handleSubmit}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={dict.search_placeholder || 'Buscar...'}
          autoFocus
        />
        <button type="submit">{dict.search || 'Buscar'}</button>
      </form>

      {q && (
        <p style={{ color: 'var(--color-muted)', marginBottom: '1rem' }}>
          {total} {dict.results_count || 'resultados'} — {dict.search_results_for || 'Resultados para'} &quot;{q}&quot;
        </p>
      )}

      {loading ? (
        <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-muted)' }}>
          {dict.loading || 'Cargando...'}
        </p>
      ) : results.length > 0 ? (
        <div className="card-grid">
          {results.map((r: any) => (
            <Link key={r.id} href={`/${lang}/recurso/${r.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <article className="card">
                <div className="card__body">
                  {r.rdfType && <span className="card__badge">{r.rdfType}</span>}
                  <h3 className="card__title">
                    {r.name?.[lang] || r.name?.es || r.name?.gl || r.slug}
                  </h3>
                  <p className="card__desc">
                    {(r.description?.[lang] || r.description?.es || '').slice(0, 140)}
                  </p>
                </div>
              </article>
            </Link>
          ))}
        </div>
      ) : q ? (
        <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-muted)' }}>
          {dict.no_results || 'No se encontraron resultados'}
        </p>
      ) : null}
    </>
  );
}

export default function BuscarPage({ params }: SearchPageProps) {
  return (
    <Suspense fallback={<p style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-muted)' }}>Cargando...</p>}>
      <SearchContent lang={params.lang} />
    </Suspense>
  );
}
