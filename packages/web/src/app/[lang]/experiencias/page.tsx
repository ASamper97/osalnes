import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { getResources, getTypologies, getMunicipalities } from '@/lib/api-client';
import { ResourceList } from '@/components/ResourceList';

export const runtime = 'edge';

export async function generateMetadata({ params }: { params: { lang: Locale } }): Promise<Metadata> {
  const dict = await getDictionary(params.lang);
  return { title: dict.experiences };
}

export default async function ExperienciasPage({
  params,
  searchParams,
}: {
  params: { lang: Locale };
  searchParams: { type?: string; municipio?: string; page?: string };
}) {
  const lang = params.lang;
  const dict = await getDictionary(lang);

  const [data, typologies, municipalities] = await Promise.all([
    getResources({
      lang,
      type: searchParams.type,
      municipio: searchParams.municipio,
      page: searchParams.page ? Number(searchParams.page) : 1,
      limit: 12,
      status: 'publicado',
      sort: '-updatedAt',
    }).catch(() => ({ items: [], total: 0, page: 1, limit: 12, pages: 0 })),
    getTypologies().catch(() => []),
    getMunicipalities().catch(() => []),
  ]);

  return (
    <>
      <div className="section__header" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '2rem', color: 'var(--color-primary)' }}>{dict.experiences}</h1>
      </div>
      <ResourceList
        lang={lang}
        dict={dict}
        data={data}
        typologies={typologies}
        municipalities={municipalities}
      />
    </>
  );
}
