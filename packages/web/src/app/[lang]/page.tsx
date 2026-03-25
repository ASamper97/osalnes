import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { getResources, getCategories, getMunicipalities, getEvents } from '@/lib/api-client';
import { websiteJsonLd, destinationJsonLd } from '@/lib/jsonld';

export default async function HomePage({
  params,
}: {
  params: { lang: Locale };
}) {
  const lang = params.lang;
  const dict = await getDictionary(lang);

  const jsonLd = websiteJsonLd(lang, dict.site_name);
  const destinationLd = destinationJsonLd(lang, dict.site_name);

  // Fetch data in parallel
  const [featured, categories, municipalities, events] = await Promise.all([
    getResources({ lang, limit: 6, status: 'publicado', sort: '-updatedAt' }).catch(() => ({ items: [], total: 0, page: 1, limit: 6, pages: 0 })),
    getCategories().catch(() => []),
    getMunicipalities().catch(() => []),
    getEvents({ from: new Date().toISOString().slice(0, 10) }).catch(() => []),
  ]);

  return (
    <>
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(destinationLd) }}
      />

      {/* Hero */}
      <section className="hero">
        <h1>{dict.discover}</h1>
        <p>{dict.hero_subtitle}</p>
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href={`/${lang}/experiencias`}
            style={{
              padding: '0.6rem 1.5rem',
              background: 'var(--color-accent)',
              color: 'var(--color-text)',
              borderRadius: 'var(--radius)',
              fontWeight: 600,
              fontSize: '0.95rem',
            }}
          >
            {dict.experiences}
          </Link>
          <Link
            href={`/${lang}/buscar`}
            style={{
              padding: '0.6rem 1.5rem',
              background: 'rgba(255,255,255,0.2)',
              color: '#fff',
              borderRadius: 'var(--radius)',
              fontWeight: 600,
              fontSize: '0.95rem',
              border: '1px solid rgba(255,255,255,0.4)',
            }}
          >
            {dict.search}
          </Link>
        </div>
      </section>

      {/* Featured resources */}
      {featured.items.length > 0 && (
        <section className="section">
          <div className="section__header">
            <h2>{dict.featured}</h2>
            <Link href={`/${lang}/directorio`}>{dict.see_all}</Link>
          </div>
          <div className="card-grid">
            {featured.items.map((r) => (
              <Link key={r.id} href={`/${lang}/recurso/${r.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <article className="card">
                  <div className="card__image" />
                  <div className="card__body">
                    {r.rdfType && <span className="card__badge">{r.rdfType}</span>}
                    <h3 className="card__title">{r.name[lang] || r.name.es || r.name.gl || Object.values(r.name)[0]}</h3>
                    <p className="card__desc">
                      {(r.description[lang] || r.description.es || r.description.gl || '')?.slice(0, 120)}
                      {(r.description[lang] || r.description.es || '')?.length > 120 ? '...' : ''}
                    </p>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Categories */}
      {categories.length > 0 && (
        <section className="section">
          <div className="section__header">
            <h2>{dict.explore_categories}</h2>
          </div>
          <div className="card-grid">
            {categories.filter((c) => !c.parentId).slice(0, 8).map((cat) => (
              <Link
                key={cat.id}
                href={`/${lang}/directorio?category=${cat.slug}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <article className="card" style={{ textAlign: 'center' }}>
                  <div className="card__body">
                    <h3 className="card__title">{cat.name[lang] || cat.name.es || cat.name.gl || cat.slug}</h3>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Municipalities */}
      {municipalities.length > 0 && (
        <section className="section">
          <div className="section__header">
            <h2>{dict.municipalities}</h2>
          </div>
          <div className="card-grid">
            {municipalities.map((m) => (
              <Link
                key={m.id}
                href={`/${lang}/directorio?municipio=${m.id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <article className="card" style={{ textAlign: 'center' }}>
                  <div className="card__body">
                    <h3 className="card__title">{m.name[lang] || m.name.es || m.name.gl || m.slug}</h3>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming events */}
      {events.length > 0 && (
        <section className="section">
          <div className="section__header">
            <h2>{dict.events_upcoming}</h2>
            <Link href={`/${lang}/agenda`}>{dict.see_all}</Link>
          </div>
          <div className="card-grid">
            {events.slice(0, 4).map((evt: any) => (
              <article key={evt.id} className="card">
                <div className="card__body">
                  <span className="card__meta">{evt.startDate}</span>
                  <h3 className="card__title">{evt.name?.[lang] || evt.name?.es || 'Evento'}</h3>
                  {evt.location && (
                    <p className="card__desc">{evt.location}</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
