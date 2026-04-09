import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { type ZoneItem } from '@/lib/api';
import { useZones } from '@/lib/use-zones';
import { useConfirm } from '@/components/ConfirmDialog';

// Mirror of admin/index.ts SLUG_RE — gives instant feedback before round-trip.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function ZonesPage() {
  const confirm = useConfirm();
  // Shared data layer — same hook used by ZonesMapPage. See lib/use-zones.ts.
  const { zones, municipalities, loading, error, setError, create, update, remove, busyId } = useZones();

  // ── Form state (UI only — data layer lives in the hook) ───────────────────
  const [editing, setEditing] = useState<string | null>(null);
  const [slug, setSlug] = useState('');
  const [municipioId, setMunicipioId] = useState('');
  // ES + GL required (Lei 5/1988 cooficialidad), EN/FR/PT optional for tourism.
  const [nameEs, setNameEs] = useState('');
  const [nameGl, setNameGl] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameFr, setNameFr] = useState('');
  const [namePt, setNamePt] = useState('');
  const [saving, setSaving] = useState(false);
  const [filterMunicipio, setFilterMunicipio] = useState('');

  function resetForm() {
    setEditing(null);
    setSlug('');
    setMunicipioId('');
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
    setMunicipioId(z.municipioId);
    setNameEs(z.name?.es || '');
    setNameGl(z.name?.gl || '');
    setNameEn(z.name?.en || '');
    setNameFr(z.name?.fr || '');
    setNamePt(z.name?.pt || '');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!slug || !municipioId || !nameEs.trim() || !nameGl.trim()) {
      setError('Los nombres en castellano y gallego son obligatorios (Lei 5/1988).');
      return;
    }
    if (!SLUG_RE.test(slug)) {
      setError('El slug solo admite letras minúsculas, números y guiones (ej. centro-historico).');
      return;
    }
    setSaving(true);
    const payload = {
      slug,
      municipio_id: municipioId,
      name: {
        es: nameEs.trim(),
        gl: nameGl.trim(),
        en: nameEn.trim(),
        fr: nameFr.trim(),
        pt: namePt.trim(),
      },
    };
    const ok = editing && editing !== 'new'
      ? await update(editing, payload)
      : await create(payload);
    setSaving(false);
    if (ok) resetForm();
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirm({
      title: `¿Eliminar zona "${name}"?`,
      message: 'Los recursos turísticos asociados a esta zona perderán la asociación. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar zona',
      variant: 'danger',
    });
    if (!ok) return;
    await remove(id);
  }

  function getMunicipioName(id: string) {
    return municipalities.find((m) => m.id === id)?.name?.es || id;
  }

  const filtered = filterMunicipio
    ? zones.filter((z) => z.municipioId === filterMunicipio)
    : zones;

  if (loading) return <div><h1>Zonas</h1><p style={{ color: 'var(--cms-text-light)' }}>Cargando…</p></div>;

  return (
    <div>
      <div className="page-header">
        <h1>Zonas geográficas</h1>
        <button className="btn btn-primary" onClick={() => { setError(null); resetForm(); setEditing('new'); }}>
          + Nueva zona
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Filter */}
      <div style={{ marginBottom: '1rem' }}>
        <select value={filterMunicipio} onChange={(e) => setFilterMunicipio(e.target.value)}>
          <option value="">Todos los municipios</option>
          {municipalities.map((m) => (
            <option key={m.id} value={m.id}>{m.name?.es || m.slug}</option>
          ))}
        </select>
      </div>

      {/* Form */}
      {editing && (
        <form onSubmit={handleSubmit} className="inline-form" style={{ marginBottom: '1.5rem' }}>
          <div className="form-row">
            <div className="form-field">
              <label>Nombre (ES) *</label>
              <input
                value={nameEs}
                onChange={(e) => {
                  setNameEs(e.target.value);
                  // Auto-derive slug only on create — never silently change
                  // a published URL while editing.
                  if (editing === 'new') setSlug(slugify(e.target.value));
                }}
                placeholder="Centro histórico"
                required
              />
            </div>
            <div className="form-field">
              <label>Municipio *</label>
              <select value={municipioId} onChange={(e) => setMunicipioId(e.target.value)} required>
                <option value="">Seleccionar...</option>
                {municipalities.map((m) => (
                  <option key={m.id} value={m.id}>{m.name?.es || m.slug}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>Slug *</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="centro-historico"
                required
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                title="Solo letras minúsculas, números y guiones"
              />
              {slug && !SLUG_RE.test(slug) && (
                <span className="field-hint" style={{ color: '#c0392b' }}>
                  Solo letras minúsculas, números y guiones.
                </span>
              )}
            </div>
            <div className="form-field">
              <label>Nombre (GL) *</label>
              <input
                value={nameGl}
                onChange={(e) => setNameGl(e.target.value)}
                placeholder="Centro histórico"
                required
              />
              <span className="field-hint">Obligatorio (Lei 5/1988)</span>
            </div>
          </div>

          <details className="zones-form-details" style={{ marginBottom: '1rem' }}>
            <summary style={{ cursor: 'pointer', padding: '0.5rem 0', fontSize: '0.9rem' }}>
              Añadir traducciones (opcional) — EN / FR / PT
            </summary>
            <div className="form-row" style={{ marginTop: '0.5rem' }}>
              <div className="form-field">
                <label htmlFor="zone-cls-name-en">Nombre (EN)</label>
                <input
                  id="zone-cls-name-en"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="Historic center"
                />
              </div>
              <div className="form-field">
                <label htmlFor="zone-cls-name-fr">Nombre (FR)</label>
                <input
                  id="zone-cls-name-fr"
                  value={nameFr}
                  onChange={(e) => setNameFr(e.target.value)}
                  placeholder="Centre historique"
                />
              </div>
              <div className="form-field">
                <label htmlFor="zone-cls-name-pt">Nombre (PT)</label>
                <input
                  id="zone-cls-name-pt"
                  value={namePt}
                  onChange={(e) => setNamePt(e.target.value)}
                  placeholder="Centro histórico"
                />
              </div>
            </div>
          </details>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : editing === 'new' ? 'Crear' : 'Guardar'}
            </button>
            <button type="button" className="btn btn-outline" onClick={resetForm}>Cancelar</button>
          </div>
        </form>
      )}

      {/* Table */}
      <table className="data-table">
        <thead>
          <tr>
            <th>Slug</th>
            <th>Nombre (ES)</th>
            <th>Nombre (GL)</th>
            <th>Idiomas</th>
            <th>Municipio</th>
            <th>Recursos</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>Sin zonas{filterMunicipio ? ' en este municipio' : ''}</td></tr>
          )}
          {filtered.map((z) => {
            const langs = ['es', 'gl', 'en', 'fr', 'pt'].filter((l) => z.name?.[l]);
            return (
            <tr key={z.id}>
              <td><code style={{ fontSize: '0.8rem' }}>{z.slug}</code></td>
              <td>{z.name?.es || '-'}</td>
              <td>{z.name?.gl || '-'}</td>
              <td title={`Idiomas con traducción: ${langs.join(', ').toUpperCase()}`} style={{ fontSize: '0.78rem', color: 'var(--cms-text-light)' }}>
                {langs.length}/5
              </td>
              <td>{getMunicipioName(z.municipioId)}</td>
              {/* F3: clickable resource count — links to filtered list */}
              <td>
                <Link
                  to={`/resources?zona=${z.id}`}
                  className="zones-table__count-link"
                  title={
                    z.resourceCount === 0
                      ? 'Esta zona no tiene recursos asociados'
                      : `Ver los ${z.resourceCount} recursos de esta zona`
                  }
                >
                  {z.resourceCount}
                </Link>
              </td>
              <td>
                <div className="action-btns">
                  <button className="btn btn-sm" onClick={() => startEdit(z)}>Editar</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(z.id, z.name?.es || z.slug)} disabled={busyId === z.id}>
                    {busyId === z.id ? 'Eliminando…' : 'Eliminar'}
                  </button>
                </div>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
