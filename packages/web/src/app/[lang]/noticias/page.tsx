import type { Metadata } from 'next';
import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { getResources } from '@/lib/api-client';

export const runtime = 'edge';

export async function generateMetadata({ params }: { params: { lang: Locale } }): Promise<Metadata> {
  const dict = await getDictionary(params.lang);
  return { title: dict.news };
}

export default async function NoticiasPage({
  params,
  searchParams,
}: {
  params: { lang: Locale };
  searchParams: { page?: string };
}) {
  const lang = params.lang;
  const dict = await getDictionary(lang);

  const data = await getResources({
    lang,
    type: 'Article',
    page: searchParams.page ? Number(searchParams.page) : 1,
    limit: 12,
    status: 'publicado',
    sort: '-publishedAt',
  }).catch(() => ({ items: [], total: 0, page: 1, limit: 12, pages: 0 }));

  return (
    <>
      <h1 style={{ fontSize: '2rem', color: 'var(--color-primary)', marginBottom: '1.5rem' }}>
        {dict.news}
      </h1>

      {data.items.length > 0 ? (
        <div className="card-grid">
          {data.items.map((r) => (
            <Link key={r.id} href={`/${lang}/recurso/${r.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <article className="card">
                <div className="card__image" />
                <div className="card__body">
                  <span className="card__meta">
                    {r.publishedAt ? new Date(r.publishedAt).toLocaleDateString(lang) : ''}
                  </span>
                  <h3 className="card__title">
                    {r.name[lang] || r.name.es || r.name.gl || Object.values(r.name)[0]}
                  </h3>
                  <p className="card__desc">
                    {(r.description[lang] || r.description.es || '').slice(0, 160)}
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

      {/* Simple pagination */}
      {data.pages > 1 && (
        <div className="pagination">
          {data.page > 1 && (
            <Link href={`/${lang}/noticias?page=${data.page - 1}`}>
              {dict.previous}
            </Link>
          )}
          <span>
            {dict.page_of.replace('{page}', String(data.page)).replace('{pages}', String(data.pages))}
          </span>
          {data.page < data.pages && (
            <Link href={`/${lang}/noticias?page=${data.page + 1}`}>
              {dict.next}
            </Link>
          )}
        </div>
      )}
    </>
  );
}
