import { useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';

interface Category {
  id: string;
  slug: string;
  parentId: string | null;
  orden: number;
  activo: boolean;
  name: { es?: string; gl?: string };
}

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [editing, setEditing] = useState<string | null>(null); // id or 'new'
  const [slug, setSlug] = useState('');
  const [nameEs, setNameEs] = useState('');
  const [nameGl, setNameGl] = useState('');
  const [parentId, setParentId] = useState('');
  const [orden, setOrden] = useState('0');
  const [activo, setActivo] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadCategories() {
    try {
      const data = await api.getAdminCategories();
      setCategories(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCategories(); }, []);

  function resetForm() {
    setEditing(null);
    setSlug('');
    setNameEs('');
    setNameGl('');
    setParentId('');
    setOrden('0');
    setActivo(true);
  }

  function startEdit(cat: Category) {
    setEditing(cat.id);
    setSlug(cat.slug);
    setNameEs(cat.name?.es || '');
    setNameGl(cat.name?.gl || '');
    setParentId(cat.parentId || '');
    setOrden(String(cat.orden));
    setActivo(cat.activo);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const body = {
      slug,
      parent_id: parentId || null,
      orden: parseInt(orden, 10) || 0,
      activo,
      name: { es: nameEs, gl: nameGl },
    };

    try {
      if (editing === 'new') {
        await api.createCategory(body);
      } else if (editing) {
        await api.updateCategory(editing, body);
      }
      resetForm();
      await loadCategories();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminar esta categoria?')) return;
    try {
      await api.deleteCategory(id);
      await loadCategories();
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (loading) return <p>Cargando...</p>;

  const rootCategories = categories.filter((c) => !c.parentId);
  const subCategories = (pid: string) => categories.filter((c) => c.parentId === pid);

  return (
    <div>
      <div className="page-header">
        <h1>Categorias</h1>
        {!editing && (
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            Nueva categoria
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Inline form */}
      {editing && (
        <form onSubmit={handleSubmit} className="resource-form" style={{ marginBottom: '1.5rem' }}>
          <fieldset>
            <legend>{editing === 'new' ? 'Nueva categoria' : 'Editar categoria'}</legend>

            <div className="form-row">
              <div className="form-field">
                <label>Slug *</label>
                <input value={slug} onChange={(e) => setSlug(e.target.value)} required placeholder="playas" />
              </div>
              <div className="form-field">
                <label>Categoria padre</label>
                <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
                  <option value="">-- Raiz --</option>
                  {rootCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name?.es || c.slug}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>Nombre (ES) *</label>
                <input value={nameEs} onChange={(e) => setNameEs(e.target.value)} required placeholder="Playas" />
              </div>
              <div className="form-field">
                <label>Nombre (GL)</label>
                <input value={nameGl} onChange={(e) => setNameGl(e.target.value)} placeholder="Praias" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>Orden</label>
                <input type="number" value={orden} onChange={(e) => setOrden(e.target.value)} />
              </div>
              <div className="form-field" style={{ display: 'flex', alignItems: 'end' }}>
                <label className="checkbox-label">
                  <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
                  Activa
                </label>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : editing === 'new' ? 'Crear' : 'Guardar'}
              </button>
              <button type="button" className="btn" onClick={resetForm}>Cancelar</button>
            </div>
          </fieldset>
        </form>
      )}

      {/* Categories tree */}
      <table className="data-table">
        <thead>
          <tr>
            <th>Nombre (ES)</th>
            <th>Slug</th>
            <th>Orden</th>
            <th>Activa</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rootCategories.map((root) => (
            <>
              <tr key={root.id}>
                <td><strong>{root.name?.es || root.slug}</strong></td>
                <td>{root.slug}</td>
                <td>{root.orden}</td>
                <td>{root.activo ? 'Si' : 'No'}</td>
                <td>
                  <div className="action-btns">
                    <button className="btn btn-sm" onClick={() => startEdit(root)}>Editar</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(root.id)}>Eliminar</button>
                  </div>
                </td>
              </tr>
              {subCategories(root.id).map((sub) => (
                <tr key={sub.id}>
                  <td style={{ paddingLeft: '2rem' }}>{sub.name?.es || sub.slug}</td>
                  <td>{sub.slug}</td>
                  <td>{sub.orden}</td>
                  <td>{sub.activo ? 'Si' : 'No'}</td>
                  <td>
                    <div className="action-btns">
                      <button className="btn btn-sm" onClick={() => startEdit(sub)}>Editar</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(sub.id)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
