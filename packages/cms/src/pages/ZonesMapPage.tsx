import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { api, type ZoneItem, type MunicipalityItem } from '@/lib/api';
import { useConfirm } from '@/components/ConfirmDialog';

/**
 * ZonesMapPage — Gestion visual de zonas geograficas
 *
 * Reemplaza el formulario plano por un mapa interactivo de los 8
 * municipios + panel lateral con las zonas del municipio seleccionado.
 *
 * Las zonas no tienen coordenadas propias (son agrupaciones logicas
 * dentro de un municipio), pero el mapa permite navegar visualmente
 * entre municipios y crear/editar zonas en su contexto geografico.
 */

// Default center on O Salnes (Galicia, Spain)
const DEFAULT_CENTER: [number, number] = [42.45, -8.85];
const DEFAULT_ZOOM = 11;

// Fix for Leaflet default marker icon paths in webpack/vite environments
// We use small inline SVG markers for two states (default vs selected)
const defaultIcon = L.divIcon({
  className: 'zone-marker',
  html: '<div class="zone-marker__pin"></div>',
  iconSize: [28, 38],
  iconAnchor: [14, 38],
});

const activeIcon = L.divIcon({
  className: 'zone-marker zone-marker--active',
  html: '<div class="zone-marker__pin zone-marker__pin--active"></div>',
  iconSize: [34, 46],
  iconAnchor: [17, 46],
});

/** Fly the map to the given coordinates when they change */
function FlyToMunicipio({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat !== null && lng !== null) {
      map.flyTo([lat, lng], 13, { duration: 0.8 });
    }
  }, [lat, lng, map]);
  return null;
}

export function ZonesMapPage() {
  const confirm = useConfirm();
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [municipalities, setMunicipalities] = useState<MunicipalityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMunicipioId, setSelectedMunicipioId] = useState<string>('');

  // Form state for inline create/edit
  const [editing, setEditing] = useState<string | null>(null);
  const [slug, setSlug] = useState('');
  const [nameEs, setNameEs] = useState('');
  const [nameGl, setNameGl] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      const [z, m] = await Promise.all([api.getZones(), api.getMunicipalities()]);
      setZones(z);
      setMunicipalities(m);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function resetForm() {
    setEditing(null);
    setSlug('');
    setNameEs('');
    setNameGl('');
  }

  function startEdit(z: ZoneItem) {
    setEditing(z.id);
    setSlug(z.slug);
    setNameEs(z.name?.es || '');
    setNameGl(z.name?.gl || '');
  }

  function startCreate() {
    if (!selectedMunicipioId) return;
    setEditing('new');
    setSlug('');
    setNameEs('');
    setNameGl('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!slug || !selectedMunicipioId || !nameEs) return;
    setSaving(true);
    setError(null);

    try {
      const data = {
        slug,
        municipio_id: selectedMunicipioId,
        name: { es: nameEs, ...(nameGl && { gl: nameGl }) },
      };

      if (editing && editing !== 'new') {
        await api.updateZone(editing, data);
      } else {
        await api.createZone(data);
      }
      resetForm();
      await load();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirm({
      title: `Eliminar zona "${name}"?`,
      message: 'Los recursos turisticos asociados a esta zona perderan la asociacion. Esta accion no se puede deshacer.',
      confirmLabel: 'Eliminar zona',
      variant: 'danger',
    });
    if (!ok) return;
    setBusyId(id);
    try {
      await api.deleteZone(id);
      await load();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  // Municipalities that have valid coordinates (filter out nulls)
  const municipalitiesWithCoords = useMemo(
    () => municipalities.filter((m) => m.latitude !== null && m.longitude !== null),
    [municipalities],
  );

  const selectedMunicipio = municipalities.find((m) => m.id === selectedMunicipioId) || null;
  const zonesOfSelected = zones.filter((z) => z.municipioId === selectedMunicipioId);

  // Group all zones by municipio for the count badges
  const zoneCountByMunicipio = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const z of zones) {
      counts[z.municipioId] = (counts[z.municipioId] || 0) + 1;
    }
    return counts;
  }, [zones]);

  if (loading) return <div><h1>Zonas</h1><p style={{ color: 'var(--cms-text-light)' }}>Cargando...</p></div>;

  return (
    <div className="zones-map-page">
      <div className="page-header">
        <h1>Zonas geograficas</h1>
        <span className="zones-map__hint">{zones.length} zonas en {municipalitiesWithCoords.length} municipios</span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="zones-map__layout">
        {/* MAP */}
        <div className="zones-map__map">
          <MapContainer
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            scrollWheelZoom
            style={{ width: '100%', height: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {selectedMunicipio && (
              <FlyToMunicipio lat={selectedMunicipio.latitude} lng={selectedMunicipio.longitude} />
            )}

            {municipalitiesWithCoords.map((m) => {
              const isActive = m.id === selectedMunicipioId;
              const count = zoneCountByMunicipio[m.id] || 0;
              return (
                <Marker
                  key={m.id}
                  position={[m.latitude!, m.longitude!]}
                  icon={isActive ? activeIcon : defaultIcon}
                  eventHandlers={{
                    click: () => {
                      setSelectedMunicipioId(m.id);
                      resetForm();
                    },
                  }}
                >
                  <Popup>
                    <strong>{m.name?.es || m.slug}</strong>
                    <br />
                    {count} {count === 1 ? 'zona' : 'zonas'}
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          <div className="zones-map__legend">
            <div className="zones-map__legend-item">
              <span className="zone-marker__pin zone-marker__pin--legend" />
              Municipio
            </div>
            <div className="zones-map__legend-item">
              <span className="zone-marker__pin zone-marker__pin--active zone-marker__pin--legend" />
              Seleccionado
            </div>
          </div>
        </div>

        {/* SIDE PANEL */}
        <aside className="zones-map__panel">
          {!selectedMunicipio ? (
            <div className="zones-map__empty">
              <div className="zones-map__empty-icon">📍</div>
              <h3>Selecciona un municipio</h3>
              <p>Haz clic en cualquier marcador del mapa para ver y gestionar sus zonas geograficas (parroquias, barrios o agrupaciones).</p>
            </div>
          ) : (
            <>
              <div className="zones-map__panel-header">
                <span className="zones-map__panel-label">Municipio seleccionado</span>
                <h2>{selectedMunicipio.name?.es || selectedMunicipio.slug}</h2>
                <span className="zones-map__panel-count">
                  {zonesOfSelected.length} {zonesOfSelected.length === 1 ? 'zona' : 'zonas'}
                </span>
              </div>

              {/* Inline form */}
              {editing ? (
                <form onSubmit={handleSubmit} className="zones-map__form">
                  <h3>{editing === 'new' ? 'Nueva zona' : 'Editar zona'}</h3>
                  <div className="form-field">
                    <label>Slug *</label>
                    <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="centro-historico" required />
                  </div>
                  <div className="form-field">
                    <label>Nombre (ES) *</label>
                    <input value={nameEs} onChange={(e) => setNameEs(e.target.value)} placeholder="Centro historico" required />
                  </div>
                  <div className="form-field">
                    <label>Nombre (GL)</label>
                    <input value={nameGl} onChange={(e) => setNameGl(e.target.value)} placeholder="Centro historico" />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                      {saving ? 'Guardando...' : editing === 'new' ? 'Crear zona' : 'Guardar'}
                    </button>
                    <button type="button" className="btn btn-sm" onClick={resetForm}>Cancelar</button>
                  </div>
                </form>
              ) : (
                <button className="btn btn-primary btn-sm zones-map__add-btn" onClick={startCreate}>
                  + Anadir zona en {selectedMunicipio.name?.es || selectedMunicipio.slug}
                </button>
              )}

              {/* Zones list */}
              <div className="zones-map__list">
                {zonesOfSelected.length === 0 ? (
                  <p className="zones-map__list-empty">Sin zonas todavia. Pulsa "+ Anadir zona" para crear la primera.</p>
                ) : (
                  zonesOfSelected.map((z) => (
                    <div key={z.id} className={`zones-map__zone ${editing === z.id ? 'zones-map__zone--editing' : ''}`}>
                      <div className="zones-map__zone-info">
                        <strong>{z.name?.es || z.slug}</strong>
                        <code>{z.slug}</code>
                        {z.name?.gl && <span className="zones-map__zone-gl">GL: {z.name.gl}</span>}
                      </div>
                      <div className="action-btns">
                        <button className="btn btn-sm" onClick={() => startEdit(z)} disabled={busyId === z.id}>Editar</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(z.id, z.name?.es || z.slug)} disabled={busyId === z.id}>
                          {busyId === z.id ? '...' : 'Eliminar'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
