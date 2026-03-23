import { useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';

interface Product {
  id: string;
  slug: string;
  activo: boolean;
  name: Record<string, string>;
  description: Record<string, string>;
}

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slug, setSlug] = useState('');
  const [nameEs, setNameEs] = useState('');
  const [nameGl, setNameGl] = useState('');
  const [descEs, setDescEs] = useState('');
  const [descGl, setDescGl] = useState('');
  const [activo, setActivo] = useState(true);
  const [saving, setSaving] = useState(false);

  function loadProducts() {
    api.getProducts().then(setProducts).catch((e) => setError(e.message));
  }

  useEffect(() => { loadProducts(); }, []);

  function resetForm() {
    setEditingId(null);
    setSlug(''); setNameEs(''); setNameGl('');
    setDescEs(''); setDescGl(''); setActivo(true);
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setSlug(p.slug);
    setNameEs(p.name?.es || '');
    setNameGl(p.name?.gl || '');
    setDescEs(p.description?.es || '');
    setDescGl(p.description?.gl || '');
    setActivo(p.activo);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const body = {
      slug,
      activo,
      name: { es: nameEs, gl: nameGl },
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Eliminar producto "${name}"?`)) return;
    try {
      await api.deleteProduct(id);
      if (editingId === id) resetForm();
      loadProducts();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Productos turisticos</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

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
              <input value={nameEs} onChange={(e) => setNameEs(e.target.value)} required placeholder="Ruta do Viño" />
            </div>
            <div className="form-field">
              <label>Nombre (GL)</label>
              <input value={nameGl} onChange={(e) => setNameGl(e.target.value)} placeholder="Ruta do Viño" />
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
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {products.length === 0 && (
            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>Sin productos</td></tr>
          )}
          {products.map((p) => (
            <tr key={p.id}>
              <td><strong>{p.name?.es || p.slug}</strong></td>
              <td style={{ fontSize: '0.8rem' }}>{p.slug}</td>
              <td>
                <span className="status-badge" style={{ background: p.activo ? '#27ae60' : '#95a5a6' }}>
                  {p.activo ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td>
                <div className="action-btns">
                  <button className="btn btn-sm" onClick={() => startEdit(p)}>Editar</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p.id, p.name?.es || p.slug)}>
                    Eliminar
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
