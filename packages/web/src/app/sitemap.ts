import type { MetadataRoute } from 'next';
import { locales } from '@/i18n/config';

export const runtime = 'edge';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://turismo.osalnes.gal';
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const STATIC_ROUTES = [
  '',
  '/experiencias',
  '/que-ver',
  '/que-hacer',
  '/agenda',
  '/directorio',
  '/noticias',
  '/info',
  '/buscar',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // Static pages for each locale
  for (const lang of locales) {
    for (const route of STATIC_ROUTES) {
      entries.push({
        url: `${BASE_URL}/${lang}${route}`,
        lastModified: new Date(),
        changeFrequency: route === '' ? 'daily' : 'weekly',
        priority: route === '' ? 1 : 0.8,
      });
    }
  }

  // Dynamic resource pages
  try {
    const res = await fetch(`${API_BASE}/resources?status=publicado&limit=1000`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      const resources = data.items || [];
      for (const resource of resources) {
        for (const lang of locales) {
          entries.push({
            url: `${BASE_URL}/${lang}/recurso/${resource.slug}`,
            lastModified: resource.updatedAt ? new Date(resource.updatedAt) : new Date(),
            changeFrequency: 'weekly',
            priority: 0.6,
          });
        }
      }
    }
  } catch {
    // API not available — static pages only
  }

  return entries;
}
