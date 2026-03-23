'use client';

import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import Link from 'next/link';
import type { Locale } from '@/i18n/config';

// Fix Leaflet default marker icon in Next.js
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

interface MapResource {
  id: string;
  slug: string;
  name: Record<string, string>;
  rdfType: string;
  location: {
    latitude: number | null;
    longitude: number | null;
    streetAddress: string | null;
  };
}

interface MapViewProps {
  lang: Locale;
  dict: Record<string, string>;
  typologies: { id: string; typeCode: string; name: Record<string, string> }[];
  municipalities: { id: string; slug?: string; name: Record<string, string> }[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

// O Salnés center coordinates
const CENTER: [number, number] = [42.50, -8.77];
const DEFAULT_ZOOM = 12;

function BoundsLoader({ onBoundsChange }: { onBoundsChange: (bounds: string) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const b = map.getBounds();
      onBoundsChange(`${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}`);
    },
  });

  useEffect(() => {
    const b = map.getBounds();
    onBoundsChange(`${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}`);
  }, []);

  return null;
}

export function MapView({ lang, dict, typologies, municipalities }: MapViewProps) {
  const [resources, setResources] = useState<MapResource[]>([]);
  const [bounds, setBounds] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [municipioFilter, setMunicipioFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchResources = useCallback(async () => {
    if (!bounds) return;
    setLoading(true);
    try {
      const url = new URL(`${API_BASE}/map/resources`);
      url.searchParams.set('bounds', bounds);
      if (typeFilter) url.searchParams.set('type', typeFilter);
      if (municipioFilter) url.searchParams.set('municipio', municipioFilter);

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        setResources(data);
      }
    } catch {
      // API not available — try fallback to regular resources
      try {
        const url = new URL(`${API_BASE}/resources`);
        url.searchParams.set('status', 'publicado');
        url.searchParams.set('limit', '200');
        url.searchParams.set('lang', lang);
        if (typeFilter) url.searchParams.set('type', typeFilter);
        if (municipioFilter) url.searchParams.set('municipio', municipioFilter);

        const res = await fetch(url.toString());
        if (res.ok) {
          const data = await res.json();
          setResources((data.items || []).filter((r: MapResource) =>
            r.location?.latitude && r.location?.longitude
          ));
        }
      } catch {
        setResources([]);
      }
    } finally {
      setLoading(false);
    }
  }, [bounds, typeFilter, municipioFilter, lang]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const geoResources = resources.filter(
    (r) => r.location?.latitude && r.location?.longitude,
  );

  return (
    <div className="map-container">
      {/* Filters */}
      <div className="filters-bar">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label={dict.typology}
        >
          <option value="">{dict.all_types}</option>
          {typologies.map((t) => (
            <option key={t.id} value={t.typeCode}>
              {t.name[lang] || t.name.es || t.typeCode}
            </option>
          ))}
        </select>
        <select
          value={municipioFilter}
          onChange={(e) => setMunicipioFilter(e.target.value)}
          aria-label={dict.municipality}
        >
          <option value="">{dict.all_municipalities}</option>
          {municipalities.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name[lang] || m.name.es || m.slug || m.id}
            </option>
          ))}
        </select>
        <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)', alignSelf: 'center' }}>
          {geoResources.length} {dict.results_count}
          {loading && ` — ${dict.loading}`}
        </span>
      </div>

      {/* Map */}
      <div className="map-wrapper" role="application" aria-label={dict.map}>
        <MapContainer
          center={CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ width: '100%', height: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <BoundsLoader onBoundsChange={setBounds} />

          {geoResources.map((r) => (
            <Marker
              key={r.id}
              position={[r.location.latitude!, r.location.longitude!]}
            >
              <Popup>
                <div style={{ minWidth: 180 }}>
                  {r.rdfType && (
                    <span style={{
                      display: 'inline-block',
                      background: 'var(--color-primary)',
                      color: '#fff',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '3px',
                      fontSize: '0.7rem',
                      marginBottom: '0.3rem',
                    }}>
                      {r.rdfType}
                    </span>
                  )}
                  <h3 style={{ fontSize: '0.95rem', margin: '0.2rem 0' }}>
                    <Link href={`/${lang}/recurso/${r.slug}`}>
                      {r.name[lang] || r.name.es || r.name.gl || Object.values(r.name)[0]}
                    </Link>
                  </h3>
                  {r.location.streetAddress && (
                    <p style={{ fontSize: '0.8rem', color: '#666', margin: 0 }}>
                      {r.location.streetAddress}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
