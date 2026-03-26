import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { locales, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { getResourceBySlug } from '@/lib/api-client';
import { resourceJsonLd, breadcrumbJsonLd } from '@/lib/jsonld';

export const runtime = 'edge';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export async function generateStaticParams() {
  try {
    const res = await fetch(`${API_BASE}/resources?limit=200&status=publicado`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    const items: { slug: string }[] = data.items || [];
    return items.flatMap((r) => locales.map((lang) => ({ lang, slug: r.slug })));
  } catch {
    // Fallback: demo resources so build never fails
    const slugs = [
      'praia-a-lanzada', 'praia-areas', 'praia-da-barrosa', 'praia-o-vao',
      'parador-de-cambados', 'hotel-spa-nanin-playa', 'camping-paisaxe',
      'restaurante-yayo-daporta', 'restaurante-d-berto', 'marisqueria-pepe-vieira',
      'pazo-de-fefinans', 'illa-de-arousa-ponte', 'torre-de-san-sadurnino',
      'mirador-da-siradella', 'festa-do-albarino',
    ];
    return slugs.flatMap((slug) => locales.map((lang) => ({ lang, slug })));
  }
}

export async function generateMetadata({
  params,
}: {
  params: { lang: Locale; slug: string };
}): Promise<Metadata> {
  const resource = await getResourceBySlug(params.slug).catch(() => null);
  if (!resource) return { title: 'Not Found' };

  const lang = params.lang;
  const title = resource.seoTitle?.[lang] || resource.name[lang] || resource.name.es;
  const description = resource.seoDescription?.[lang] || (resource.description[lang] || resource.description.es || '').slice(0, 160);
  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://turismo.osalnes.gal';

  return {
    title,
    description,
    alternates: {
      canonical: `/${lang}/recurso/${params.slug}`,
      languages: Object.fromEntries(
        ['es', 'gl', 'en', 'fr', 'pt'].map((l) => [l, `/${l}/recurso/${params.slug}`]),
      ),
    },
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/${lang}/recurso/${params.slug}`,
      type: 'article',
    },
  };
}

export default async function RecursoDetailPage({
  params,
}: {
  params: { lang: Locale; slug: string };
}) {
  const lang = params.lang;
  const dict = await getDictionary(lang);

  const resource = await getResourceBySlug(params.slug).catch(() => null);
  if (!resource) notFound();

  const name = resource.name[lang] || resource.name.es || resource.name.gl || Object.values(resource.name)[0];
  const description = resource.description[lang] || resource.description.es || resource.description.gl || '';

  const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://turismo.osalnes.gal';
  const jsonLd = resourceJsonLd(resource, lang);
  const breadcrumb = breadcrumbJsonLd([
    { name: dict.home, url: `${BASE_URL}/${lang}` },
    { name: dict.directory, url: `${BASE_URL}/${lang}/directorio` },
    { name, url: `${BASE_URL}/${lang}/recurso/${resource.slug}` },
  ]);

  return (
    <div className="resource-detail">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />

      <Link href={`/${lang}/directorio`} style={{ fontSize: '0.9rem', color: 'var(--color-muted)' }}>
        &larr; {dict.back}
      </Link>

      <h1 style={{ marginTop: '1rem' }}>{name}</h1>

      <div className="resource-detail__meta">
        {resource.rdfType && <span className="card__badge" style={{ marginRight: '0.5rem' }}>{resource.rdfType}</span>}
        {resource.publishedAt && (
          <span>{new Date(resource.publishedAt).toLocaleDateString(lang)}</span>
        )}
      </div>

      {/* Description */}
      <div className="resource-detail__desc">
        {description.split('\n').map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      {/* Info grid */}
      <h2 className="sr-only">{dict.details || 'Detalles'}</h2>
      <div className="info-grid">
        {/* Location */}
        {resource.location?.streetAddress && (
          <div className="info-card">
            <div className="info-card__label">{dict.address}</div>
            <div className="info-card__value">
              {resource.location.streetAddress}
              {resource.location.postalCode && `, ${resource.location.postalCode}`}
            </div>
          </div>
        )}

        {/* Phone */}
        {resource.contact?.telephone?.length > 0 && (
          <div className="info-card">
            <div className="info-card__label">{dict.phone}</div>
            <div className="info-card__value">
              {resource.contact.telephone.map((t, i) => (
                <a key={i} href={`tel:${t}`} style={{ display: 'block' }}>{t}</a>
              ))}
            </div>
          </div>
        )}

        {/* Email */}
        {resource.contact?.email?.length > 0 && (
          <div className="info-card">
            <div className="info-card__label">{dict.email}</div>
            <div className="info-card__value">
              {resource.contact.email.map((e, i) => (
                <a key={i} href={`mailto:${e}`} style={{ display: 'block' }}>{e}</a>
              ))}
            </div>
          </div>
        )}

        {/* Website */}
        {resource.contact?.url && (
          <div className="info-card">
            <div className="info-card__label">{dict.website}</div>
            <div className="info-card__value">
              <a href={resource.contact.url} target="_blank" rel="noopener noreferrer" aria-label={`${resource.contact.url.replace(/^https?:\/\//, '')} (${dict.opens_new_window || 'abre en ventana nueva'})`}>
                {resource.contact.url.replace(/^https?:\/\//, '')}
              </a>
            </div>
          </div>
        )}

        {/* Opening hours */}
        {resource.openingHours && (
          <div className="info-card">
            <div className="info-card__label">{dict.opening_hours}</div>
            <div className="info-card__value">{resource.openingHours}</div>
          </div>
        )}

        {/* Access */}
        {resource.isAccessibleForFree !== null && (
          <div className="info-card">
            <div className="info-card__label">{dict.free_access}</div>
            <div className="info-card__value">{resource.isAccessibleForFree ? '✓' : '—'}</div>
          </div>
        )}

        {resource.publicAccess !== null && (
          <div className="info-card">
            <div className="info-card__label">{dict.public_access}</div>
            <div className="info-card__value">{resource.publicAccess ? '✓' : '—'}</div>
          </div>
        )}
      </div>

      {/* Map link */}
      {resource.location?.latitude && resource.location?.longitude && (
        <div style={{ marginTop: '1.5rem' }}>
          <a
            href={`https://www.google.com/maps?q=${resource.location.latitude},${resource.location.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${dict.open_map} (${dict.opens_new_window || 'abre en ventana nueva'})`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.2rem',
              background: 'var(--color-primary)',
              color: '#fff',
              borderRadius: 'var(--radius)',
              fontSize: '0.9rem',
            }}
          >
            {dict.open_map}
          </a>
        </div>
      )}

      {/* Social / sameAs links */}
      {resource.contact?.sameAs?.length > 0 && (
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {resource.contact.sameAs.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer" aria-label={`${url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]} (${dict.opens_new_window || 'abre en ventana nueva'})`} style={{ fontSize: '0.85rem' }}>
              {url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
