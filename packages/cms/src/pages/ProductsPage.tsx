import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type ProductItem } from '@/lib/api';

export function ProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slug, setSlug] = useState('');
  const [nameEs, setNameEs] = useState('');
  const [nameGl, setNameGl] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameFr, setNameFr] = useState('');
  const [namePt, setNamePt] = useState('');
  const [descEs, setDescEs] = useState('');
  const [descGl, setDescGl] = useState('');
  const [activo, setActivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function loadProducts() {
    api.getProducts().then(setProducts).catch((e) => setError(e.message));
  }

  useEffect(() => { loadProducts(); }, []);

  function resetForm() {
    setEditingId(null);
    setSlug(''); setNameEs(''); setNameGl('');
    setNameEn(''); setNameFr(''); setNamePt('');
    setDescEs(''); setDescGl(''); setActivo(true);
  }

  function startEdit(p: ProductItem) {
    setEditingId(p.id);
    setSlug(p.slug);
    setNameEs(p.name?.es || '');
    setNameGl(p.name?.gl || '');
    setNameEn(p.name?.en || '');
    setNameFr(p.name?.fr || '');
    setNamePt(p.name?.pt || '');
    setDescEs(p.description?.es || '');
    setDescGl(p.description?.gl || '');
    setActivo(p.activo);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side validation
    const errs: string[] = [];
    if (!slug.trim()) errs.push('Slug es obligatorio');
    if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errs.push('Slug solo admite letras minusculas, numeros y guiones');
    if (!nameEs.trim()) errs.push('Nombre (ES) es obligatorio');
    if (errs.length > 0) { setError(errs.join('\n')); return; }

    setSaving(true);

    const body = {
      slug,
      activo,
      name: { es: nameEs, gl: nameGl, ...(nameEn && { en: nameEn }), ...(nameFr && { fr: nameFr }), ...(namePt && { pt: namePt }) },
      description: { es: descEs, gl: descGl },
    };

    try {
      if (editingId) {
        await api.updateProduct(editingId, body);
      } else {
        await api.createProduct(body);
      }
      resetForm();
      loadProducts();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Eliminar producto "${name}"? Esta accion no se puede deshacer.`)) return;
    setBusyId(id);
    try {
      await api.deleteProduct(id);
      if (editingId === id) resetForm();
      loadProducts();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Productos turisticos</h1>
        <div className="page-header__actions">
          <button className="btn btn-primary" onClick={() => navigate('/products/new')}>
            + Nuevo producto (asistente)
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ whiteSpace: 'pre-line' }}>{error}</div>}

      {/* Form */}
      <form onSubmit={handleSubmit} className="resource-form" style={{ marginBottom: '2rem' }}>
        <fieldset>
          <legend>{editingId ? 'Editar producto' : 'Nuevo producto'}</legend>

          <div className="form-row">
            <div className="form-field">
              <label>Slug *</label>
              <input value={slug} onChange={(e) => setSlug(e.target.value)} required placeholder="ruta-do-vino" />
            </div>
            <div className="form-field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
              <label className="checkbox-label">
                <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
                Activo
              </label>
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Nombre (ES) *</label>
              <input value={nameEs} onChange={(e) => setNameEs(e.target.value)} required placeholder="Ruta do Vino" />
            </div>
            <div className="form-field">
              <label>Nombre (GL)</label>
              <input value={nameGl} onChange={(e) => setNameGl(e.target.value)} placeholder="Ruta do Viño" />
            </div>
          </div>

          <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="form-field">
              <label>Nombre (EN)</label>
              <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Wine Route" />
            </div>
            <div className="form-field">
              <label>Nombre (FR)</label>
              <input value={nameFr} onChange={(e) => setNameFr(e.target.value)} placeholder="Route du Vin" />
            </div>
            <div className="form-field">
              <label>Nombre (PT)</label>
              <input value={namePt} onChange={(e) => setNamePt(e.target.value)} placeholder="Rota do Vinho" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Descripcion (ES)</label>
              <textarea rows={3} value={descEs} onChange={(e) => setDescEs(e.target.value)} />
            </div>
            <div className="form-field">
              <label>Descripcion (GL)</label>
              <textarea rows={3} value={descGl} onChange={(e) => setDescGl(e.target.value)} />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear producto'}
            </button>
            {editingId && <button type="button" className="btn" onClick={resetForm}>Cancelar</button>}
          </div>
        </fieldset>
      </form>

      {/* Table */}
      <table className="data-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Slug</th>
            <th>Recursos</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {products.length === 0 && (
            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>Sin productos</td></tr>
          )}
          {products.map((p) => (
            <tr key={p.id}>
              <td><strong>{p.name?.es || p.slug}</strong></td>
              <td style={{ fontSize: '0.8rem' }}>{p.slug}</td>
              <td style={{ textAlign: 'center' }}>{(p as any).resourceCount || 0}</td>
              <td>
                <span className="status-badge" style={{ background: p.activo ? '#27ae60' : '#95a5a6' }}>
                  {p.activo ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td>
                <div className="action-btns">
                  <button className="btn btn-sm" onClick={() => navigate(`/products/${p.id}/edit`)} disabled={busyId === p.id}>Editar</button>
                  <button className="btn btn-sm btn-outline" onClick={() => startEdit(p)} disabled={busyId === p.id}>Edicion rapida</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p.id, p.name?.es || p.slug)} disabled={busyId === p.id}>
                    {busyId === p.id ? '...' : 'Eliminar'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
