'use client';

import { useEffect, useState, Suspense } from 'react';
import type { Locale } from '@/i18n/config';
import type { Typology, Municipality } from '@/lib/api-client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export default function MapaPage({
  params,
}: {
  params: { lang: Locale };
}) {
  const lang = params.lang;
  const [MapView, setMapView] = useState<any>(null);
  const [typologies, setTypologies] = useState<Typology[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [dict, setDict] = useState<Record<string, string>>({});

  useEffect(() => {
    // Load map component dynamically (client-only)
    import('@/components/MapView').then((m) => setMapView(() => m.MapView));
    // Load data
    fetch(`${API_BASE}/typologies`).then((r) => r.json()).then(setTypologies).catch(() => {});
    fetch(`${API_BASE}/municipalities`).then((r) => r.json()).then(setMunicipalities).catch(() => {});
    import(`@/i18n/dictionaries/${lang}.json`).then((m) => setDict(m.default));
  }, [lang]);

  return (
    <>
      <h1 style={{ fontSize: '2rem', color: 'var(--color-primary)', marginBottom: '1rem' }}>
        {dict.map || 'Mapa'}
      </h1>
      {MapView ? (
        <MapView
          lang={lang}
          dict={dict}
          typologies={typologies}
          municipalities={municipalities}
        />
      ) : (
        <div style={{ height: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-alt)', borderRadius: '8px' }}>
          <p style={{ color: 'var(--color-muted)' }}>Cargando mapa...</p>
        </div>
      )}
    </>
  );
}
