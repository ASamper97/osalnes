import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { getTypologies, getMunicipalities } from '@/lib/api-client';

// Leaflet requires browser APIs — disable SSR
const MapView = dynamic(() => import('@/components/MapView').then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div style={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-alt)', borderRadius: 'var(--radius)' }}>
      <p style={{ color: 'var(--color-muted)' }}>Cargando mapa...</p>
    </div>
  ),
});

export async function generateMetadata({ params }: { params: { lang: Locale } }): Promise<Metadata> {
  const dict = await getDictionary(params.lang);
  return { title: dict.map };
}

export default async function MapaPage({
  params,
}: {
  params: { lang: Locale };
}) {
  const lang = params.lang;
  const dict = await getDictionary(lang);

  const [typologies, municipalities] = await Promise.all([
    getTypologies().catch(() => []),
    getMunicipalities().catch(() => []),
  ]);

  return (
    <>
      <h1 style={{ fontSize: '2rem', color: 'var(--color-primary)', marginBottom: '1rem' }}>
        {dict.map}
      </h1>
      <MapView
        lang={lang}
        dict={dict}
        typologies={typologies}
        municipalities={municipalities}
      />
    </>
  );
}
