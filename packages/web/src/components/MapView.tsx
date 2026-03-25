'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import Link from 'next/link';
import type { Locale } from '@/i18n/config';

// ---------------------------------------------------------------------------
// Typology group colors (UNE 178503 groups)
// ---------------------------------------------------------------------------
const GROUP_COLORS: Record<string, { color: string; label: Record<string, string> }> = {
  alojamiento:   { color: '#2E86C1', label: { es: 'Alojamiento', gl: 'Aloxamento' } },
  restauracion:  { color: '#E67E22', label: { es: 'Restauración', gl: 'Restauración' } },
  recurso:       { color: '#27AE60', label: { es: 'Atracciones', gl: 'Atracción' } },
  evento:        { color: '#8E44AD', label: { es: 'Eventos', gl: 'Eventos' } },
  transporte:    { color: '#607D8B', label: { es: 'Transporte', gl: 'Transporte' } },
  servicio:      { color: '#E74C3C', label: { es: 'Servicios', gl: 'Servizos' } },
};

const DEFAULT_MARKER_COLOR = '#1a5276';

// Cache icons per grupo to avoid re-creating DOM elements
const _iconCache: Record<string, L.DivIcon> = {};

function getMarkerIcon(grupo: string | null): L.DivIcon {
  const key = grupo || '_default';
  if (_iconCache[key]) return _iconCache[key];

  const color = (grupo && GROUP_COLORS[grupo]?.color) || DEFAULT_MARKER_COLOR;
  const svg = `<svg width="28" height="42" viewBox="0 0 28 42" xmlns="http://www.w3.org/2000/svg">` +
    `<path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 28 14 28s14-17.5 14-28C28 6.27 21.73 0 14 0z" fill="${color}" stroke="#fff" stroke-width="1.5"/>` +
    `<circle cx="14" cy="14" r="5.5" fill="#fff"/>` +
    `</svg>`;

  const icon = L.divIcon({
    className: 'marker-icon-custom',
    html: svg,
    iconSize: [28, 42],
    iconAnchor: [14, 42],
    popupAnchor: [0, -36],
  });
  _iconCache[key] = icon;
  return icon;
}

interface MapResource {
  id: string;
  slug: string;
  name: Record<string, string>;
  rdfType: string;
  grupo: string | null;
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

          {geoResources.map((r) => {
            const groupColor = (r.grupo && GROUP_COLORS[r.grupo]?.color) || DEFAULT_MARKER_COLOR;
            return (
              <Marker
                key={r.id}
                position={[r.location.latitude!, r.location.longitude!]}
                icon={getMarkerIcon(r.grupo)}
              >
                <Popup>
                  <div style={{ minWidth: 180 }}>
                    {r.rdfType && (
                      <span style={{
                        display: 'inline-block',
                        background: groupColor,
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
            );
          })}
        </MapContainer>

        {/* Legend */}
        <div className="map-legend" role="region" aria-label={dict.legend || 'Leyenda'}>
          {Object.entries(GROUP_COLORS).map(([key, { color, label }]) => (
            <div key={key} className="map-legend__item">
              <span
                className="map-legend__dot"
                style={{ background: color }}
                aria-hidden="true"
              />
              <span className="map-legend__label">{label[lang] || label.es}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
