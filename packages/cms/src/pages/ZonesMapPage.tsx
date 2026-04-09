import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
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

// Slug validation: backend enforces kebab-case (a-z, 0-9, hyphens). We mirror
// the same regex in the UI so users get immediate feedback instead of a
// confusing 400 from the API. See SLUG_RE in supabase/functions/admin/index.ts.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Convert any string into a safe kebab-case slug (strips accents, etc). */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

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

  // Form state for inline create/edit. Five name fields cover the languages
  // supported by the schema. ES + GL are required for institutional content
  // (Lei 5/1988 — gallego cooficial). EN/FR/PT are optional for international
  // tourism reach (UNE 178502 §5.3 multilinguismo).
  const [editing, setEditing] = useState<string | null>(null);
  const [slug, setSlug] = useState('');
  const [nameEs, setNameEs] = useState('');
  const [nameGl, setNameGl] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameFr, setNameFr] = useState('');
  const [namePt, setNamePt] = useState('');
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
    setNameEn('');
    setNameFr('');
    setNamePt('');
  }

  function startEdit(z: ZoneItem) {
    setError(null);
    setEditing(z.id);
    setSlug(z.slug);
    setNameEs(z.name?.es || '');
    setNameGl(z.name?.gl || '');
    setNameEn(z.name?.en || '');
    setNameFr(z.name?.fr || '');
    setNamePt(z.name?.pt || '');
  }

  function startCreate() {
    if (!selectedMunicipioId) return;
    setError(null);
    setEditing('new');
    setSlug('');
    setNameEs('');
    setNameGl('');
    setNameEn('');
    setNameFr('');
    setNamePt('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!slug || !selectedMunicipioId || !nameEs.trim() || !nameGl.trim()) {
      setError('Los nombres en castellano y gallego son obligatorios (Lei 5/1988).');
      return;
    }
    if (!SLUG_RE.test(slug)) {
      setError('El slug solo admite letras minusculas, numeros y guiones (ej. centro-historico).');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      // Send all five languages. saveTranslations() on the backend handles
      // empty values by deleting any prior translation, so blanking EN/FR/PT
      // explicitly clears them (no zombie data — see Tanda 3 C6).
      const data = {
        slug,
        municipio_id: selectedMunicipioId,
        name: {
          es: nameEs.trim(),
          gl: nameGl.trim(),
          en: nameEn.trim(),
          fr: nameFr.trim(),
          pt: namePt.trim(),
        },
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
        <div>
          <h1>Zonas geograficas</h1>
          <span className="zones-map__hint">{zones.length} zonas en {municipalitiesWithCoords.length} municipios</span>
        </div>
        {/* WCAG 2.1.1 Keyboard — provide an accessible alternative for users
            who cannot interact with the Leaflet map via mouse. The classic
            page is fully keyboard- and screen-reader-navigable. */}
        <Link to="/zones/classic" className="btn btn-sm" aria-label="Abrir vista accesible en lista de zonas">
          📋 Vista lista (accesible)
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="zones-map__layout">
        {/* MAP */}
        <div
          className="zones-map__map"
          role="application"
          aria-label="Mapa interactivo de los municipios de O Salnes. Pulsa en un marcador para gestionar sus zonas. Si necesitas una alternativa accesible, usa el enlace 'Vista lista'."
        >
          <MapContainer
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            scrollWheelZoom
            keyboard
            keyboardPanDelta={80}
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
              const muniName = m.name?.es || m.slug;
              return (
                <Marker
                  key={m.id}
                  position={[m.latitude!, m.longitude!]}
                  icon={isActive ? activeIcon : defaultIcon}
                  // `title` becomes the accessible name announced by screen
                  // readers and shown as native browser tooltip on hover.
                  title={`${muniName}: ${count} ${count === 1 ? 'zona' : 'zonas'}`}
                  alt={`Municipio ${muniName}`}
                  keyboard
                  eventHandlers={{
                    click: () => {
                      setSelectedMunicipioId(m.id);
                      resetForm();
                    },
                    keypress: (e) => {
                      // Keyboard activation (Enter / Space) — Leaflet only
                      // wires Enter by default; we add Space too.
                      if (e.originalEvent.key === ' ' || e.originalEvent.key === 'Enter') {
                        setSelectedMunicipioId(m.id);
                        resetForm();
                      }
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
                    <label>Nombre (ES) *</label>
                    <input
                      value={nameEs}
                      onChange={(e) => {
                        setNameEs(e.target.value);
                        // Auto-derive slug only when creating, so editing an
                        // existing zone never silently changes its public URL.
                        if (editing === 'new') setSlug(slugify(e.target.value));
                      }}
                      placeholder="Centro historico"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="form-field">
                    <label>Slug *</label>
                    <input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="centro-historico"
                      required
                      pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                      title="Solo letras minusculas, numeros y guiones"
                    />
                    {slug && !SLUG_RE.test(slug) && (
                      <span className="field-hint" style={{ color: '#c0392b' }}>
                        Solo se permiten letras minusculas, numeros y guiones (ej. centro-historico).
                      </span>
                    )}
                  </div>
                  <div className="form-field">
                    <label>Nombre (GL) *</label>
                    <input
                      value={nameGl}
                      onChange={(e) => setNameGl(e.target.value)}
                      placeholder="Centro historico"
                      required
                    />
                    <span className="field-hint">Obligatorio (Lei 5/1988 — gallego cooficial)</span>
                  </div>

                  <details className="zones-map__form-details">
                    <summary>Anadir traducciones (opcional)</summary>
                    <div className="form-field">
                      <label htmlFor="zone-name-en">Nombre (EN)</label>
                      <input
                        id="zone-name-en"
                        value={nameEn}
                        onChange={(e) => setNameEn(e.target.value)}
                        placeholder="Historic center"
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="zone-name-fr">Nombre (FR)</label>
                      <input
                        id="zone-name-fr"
                        value={nameFr}
                        onChange={(e) => setNameFr(e.target.value)}
                        placeholder="Centre historique"
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="zone-name-pt">Nombre (PT)</label>
                      <input
                        id="zone-name-pt"
                        value={namePt}
                        onChange={(e) => setNamePt(e.target.value)}
                        placeholder="Centro historico"
                      />
                    </div>
                  </details>

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
