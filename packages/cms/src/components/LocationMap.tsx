/**
 * LocationMap — mapa interactivo con pin arrastrable (paso 3)
 *
 * Encapsula react-leaflet con el patrón que necesita el wizard de recurso:
 *
 *   - Muestra un pin en (lat, lng) si hay coordenadas.
 *   - Al hacer clic en cualquier parte del mapa, el pin se mueve ahí.
 *   - El pin es arrastrable para ajustes finos.
 *   - Ambas acciones llaman `onLocationChange(lat, lng)` con las nuevas
 *     coordenadas.
 *   - Si al entrar al componente no hay lat/lng pero hay municipio, el
 *     mapa se centra en el municipio con zoom apropiado.
 *
 * ACCESIBILIDAD
 *   - El mapa tiene `role="application"` y `aria-label` descriptivo.
 *   - Los controles de Leaflet son operables con teclado (zoom in/out
 *     con + / -, pan con flechas).
 *   - Como fallback textual para screen readers, las coordenadas
 *     actuales se muestran siempre como texto debajo del mapa (lo
 *     gestiona el componente padre).
 *
 * DEPENDENCIAS (ya instaladas o por instalar)
 *   - leaflet           (la librería nativa)
 *   - react-leaflet     (bindings React)
 *   - @types/leaflet    (tipos)
 *
 * El CSS de Leaflet debe estar cargado globalmente en la app:
 *   `import 'leaflet/dist/leaflet.css'` en el entry point del CMS
 *   (o en el propio step3-location.css con @import).
 */

import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import {
  O_SALNES_CENTER,
  findMunicipioByName,
} from '@osalnes/shared/data/osalnes-geo';

// ─── Fix de los iconos por defecto de Leaflet ──────────────────────────
// Leaflet referencia sus iconos con paths relativos que Webpack/Vite
// rompen. Workaround estándar: reasignar las URLs de los iconos usando
// CDN de unpkg (no requiere gestionar assets propios).
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: () => string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ─── Props ─────────────────────────────────────────────────────────────

export interface LocationMapProps {
  /** Coordenadas actuales, o null si todavía no hay pin */
  lat: number | null;
  lng: number | null;
  /** Callback al clicar o al terminar de arrastrar el pin */
  onLocationChange: (lat: number, lng: number) => void;
  /** Municipio del paso 1, para centrar el mapa si aún no hay pin */
  municipioName?: string | null;
  /** Altura CSS del contenedor (default 400px) */
  height?: string;
  /** Deshabilitar la interacción (solo lectura) */
  readOnly?: boolean;
}

// ─── Componente ────────────────────────────────────────────────────────

export default function LocationMap({
  lat,
  lng,
  onLocationChange,
  municipioName,
  height = '400px',
  readOnly = false,
}: LocationMapProps) {
  // Centro inicial: si hay coords, esas. Si no, centro del municipio.
  // Si no hay municipio, centro de O Salnés.
  const initialCenter = useMemo<[number, number]>(() => {
    if (lat != null && lng != null) return [lat, lng];
    const muni = findMunicipioByName(municipioName);
    if (muni) return [muni.lat, muni.lng];
    return [O_SALNES_CENTER.lat, O_SALNES_CENTER.lng];
  }, [lat, lng, municipioName]);

  const initialZoom = useMemo<number>(() => {
    if (lat != null && lng != null) return 16;
    const muni = findMunicipioByName(municipioName);
    if (muni) return muni.zoom;
    return O_SALNES_CENTER.zoom;
  }, [lat, lng, municipioName]);

  return (
    <div
      className="location-map"
      style={{ height }}
      role="application"
      aria-label="Mapa para elegir la ubicación del recurso. Haz clic o arrastra el pin para ajustar. Zoom con más y menos, desplazamiento con las teclas de flecha."
    >
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {!readOnly && <ClickCapture onLocationChange={onLocationChange} />}

        {lat != null && lng != null && (
          <Marker
            position={[lat, lng]}
            draggable={!readOnly}
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = e.target.getLatLng();
                onLocationChange(lat, lng);
              },
            }}
          />
        )}

        {/* Centrado programático cuando el padre cambia lat/lng externamente
            (p.ej. tras geocoding search o parseMapUrl). */}
        <RecenterOnChange lat={lat} lng={lng} />
      </MapContainer>
    </div>
  );
}

// ─── Subcomponentes Leaflet ────────────────────────────────────────────

/** Captura clics en el mapa y los reporta como (lat, lng) */
function ClickCapture({
  onLocationChange,
}: {
  onLocationChange: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onLocationChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Recentra el mapa y ajusta zoom cuando cambian lat/lng */
function RecenterOnChange({
  lat,
  lng,
}: {
  lat: number | null;
  lng: number | null;
}) {
  const map = useMap();
  const lastRef: MutableRefObject<string | null> = useRef(null);

  useEffect(() => {
    if (lat == null || lng == null) return;
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (lastRef.current === key) return; // ya estamos ahí
    lastRef.current = key;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.5 });
  }, [lat, lng, map]);

  return null;
}
