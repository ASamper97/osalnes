import type { Metadata } from 'next';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { getResources, getTypologies, getMunicipalities } from '@/lib/api-client';
import { ResourceList } from '@/components/ResourceList';

const QUE_VER_TYPES = [
  'LandmarksOrHistoricalBuildings', 'Museum', 'Church', 'Beach',
  'Park', 'NaturalAttraction', 'CivicStructure', 'Monument',
];

export async function generateMetadata({ params }: { params: { lang: Locale } }): Promise<Metadata> {
  const dict = await getDictionary(params.lang);
  return { title: dict.what_to_see };
}

export default async function QueVerPage({
  params,
  searchParams,
}: {
  params: { lang: Locale };
  searchParams: { type?: string; municipio?: string; page?: string };
}) {
  const lang = params.lang;
  const dict = await getDictionary(lang);

  const typeFilter = searchParams.type || QUE_VER_TYPES.join(',');

  const [data, typologies, municipalities] = await Promise.all([
    getResources({
      lang,
      type: searchParams.type || undefined,
      municipio: searchParams.municipio,
      page: searchParams.page ? Number(searchParams.page) : 1,
      limit: 12,
      status: 'publicado',
    }).catch(() => ({ items: [], total: 0, page: 1, limit: 12, pages: 0 })),
    getTypologies().catch(() => []),
    getMunicipalities().catch(() => []),
  ]);

  const filteredTypologies = typologies.filter(
    (t) => QUE_VER_TYPES.includes(t.schemaOrgType) || QUE_VER_TYPES.includes(t.typeCode),
  );

  return (
    <>
      <div className="section__header" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '2rem', color: 'var(--color-primary)' }}>{dict.what_to_see}</h1>
      </div>
      <ResourceList
        lang={lang}
        dict={dict}
        data={data}
        typologies={filteredTypologies.length > 0 ? filteredTypologies : typologies}
        municipalities={municipalities}
      />
    </>
  );
}
