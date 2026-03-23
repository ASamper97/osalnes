import type { Resource } from './api-client';
import type { Locale } from '@/i18n/config';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://turismo.osalnes.gal';

/**
 * Generate JSON-LD structured data for a tourist resource.
 * Outputs schema.org compliant object for TouristAttraction or the mapped type.
 */
export function resourceJsonLd(resource: Resource, lang: Locale) {
  const name = resource.name[lang] || resource.name.es || resource.name.gl || '';
  const description = resource.description[lang] || resource.description.es || '';

  const ld: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': resource.rdfType || 'TouristAttraction',
    name,
    description: description.slice(0, 300),
    url: `${BASE_URL}/${lang}/recurso/${resource.slug}`,
  };

  // Location
  if (resource.location?.latitude && resource.location?.longitude) {
    ld.geo = {
      '@type': 'GeoCoordinates',
      latitude: resource.location.latitude,
      longitude: resource.location.longitude,
    };
  }

  if (resource.location?.streetAddress) {
    ld.address = {
      '@type': 'PostalAddress',
      streetAddress: resource.location.streetAddress,
      postalCode: resource.location.postalCode || undefined,
      addressRegion: 'Pontevedra',
      addressCountry: 'ES',
    };
  }

  // Contact
  if (resource.contact?.telephone?.length) {
    ld.telephone = resource.contact.telephone[0];
  }
  if (resource.contact?.url) {
    ld.sameAs = resource.contact.url;
  }

  // Access
  if (resource.isAccessibleForFree !== null) {
    ld.isAccessibleForFree = resource.isAccessibleForFree;
  }
  if (resource.publicAccess !== null) {
    ld.publicAccess = resource.publicAccess;
  }

  return ld;
}

/**
 * WebSite structured data for the homepage.
 */
export function websiteJsonLd(lang: Locale, siteName: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    url: `${BASE_URL}/${lang}`,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/${lang}/buscar?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Mancomunidad de O Salnés',
      url: BASE_URL,
    },
  };
}

/**
 * BreadcrumbList structured data.
 */
export function breadcrumbJsonLd(
  items: { name: string; url: string }[],
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
