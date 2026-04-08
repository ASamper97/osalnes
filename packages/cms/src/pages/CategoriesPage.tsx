import { useEffect, useState, Fragment, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type CategoryItem } from '@/lib/api';
import { EmptyState } from '@/components/EmptyState';
import { useConfirm } from '@/components/ConfirmDialog';

export function CategoriesPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
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
  const [nameEn, setNameEn] = useState('');
  const [nameFr, setNameFr] = useState('');
  const [namePt, setNamePt] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadCategories() {
    try {
      const data = await api.getAdminCategories();
      setCategories(data);
    } catch (err: unknown) {
      setError((err as Error).message);
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
    setNameEn('');
    setNameFr('');
    setNamePt('');
    setParentId('');
    setOrden('0');
    setActivo(true);
  }

  function startEdit(cat: CategoryItem) {
    setEditing(cat.id);
    setSlug(cat.slug);
    setNameEs(cat.name?.es || '');
    setNameGl(cat.name?.gl || '');
    setParentId(cat.parentId || '');
    setOrden(String(cat.orden));
    setActivo(cat.activo);
    setNameEn(cat.name?.en || '');
    setNameFr(cat.name?.fr || '');
    setNamePt(cat.name?.pt || '');
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
      parent_id: parentId || null,
      orden: parseInt(orden, 10) || 0,
      activo,
      name: { es: nameEs, gl: nameGl, ...(nameEn && { en: nameEn }), ...(nameFr && { fr: nameFr }), ...(namePt && { pt: namePt }) },
    };

    try {
      if (editing === 'new') {
        await api.createCategory(body);
      } else if (editing) {
        await api.updateCategory(editing, body);
      }
      resetForm();
      await loadCategories();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: 'Eliminar categoria?',
      message: 'Esta accion no se puede deshacer. Los recursos asociados perderan esta categoria.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    });
    if (!ok) return;
    setBusyId(id);
    try {
      await api.deleteCategory(id);
      await loadCategories();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p>Cargando...</p>;

  const rootCategories = categories.filter((c) => !c.parentId);
  const subCategories = (pid: string) => categories.filter((c) => c.parentId === pid);

  return (
    <div>
      <div className="page-header">
        <h1>Categorias</h1>
        <div className="page-header__actions">
          <button className="btn btn-primary" onClick={() => navigate('/categories/new')}>
            + Nueva categoria (asistente)
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ whiteSpace: 'pre-line' }}>{error}</div>}

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

            <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div className="form-field">
                <label>Nombre (EN)</label>
                <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Beaches" />
              </div>
              <div className="form-field">
                <label>Nombre (FR)</label>
                <input value={nameFr} onChange={(e) => setNameFr(e.target.value)} placeholder="Plages" />
              </div>
              <div className="form-field">
                <label>Nombre (PT)</label>
                <input value={namePt} onChange={(e) => setNamePt(e.target.value)} placeholder="Praias" />
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

      {/* Categories tree or empty state */}
      {categories.length === 0 ? (
        <EmptyState
          icon="🌳"
          title="Aun no hay categorias"
          description="Las categorias organizan los recursos turisticos en grupos (Alojamientos, Restauracion, Naturaleza...). El asistente te guia paso a paso para crear la primera."
          action={{ label: '+ Crear la primera categoria', onClick: () => navigate('/categories/new') }}
        />
      ) : (
      <table className="data-table">
        <thead>
          <tr>
            <th>Nombre (ES)</th>
            <th>Slug</th>
            <th>Recursos</th>
            <th>Orden</th>
            <th>Activa</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {rootCategories.map((root) => (
            <Fragment key={root.id}>
              <tr>
                <td><strong>{root.name?.es || root.slug}</strong></td>
                <td>{root.slug}</td>
                <td style={{ textAlign: 'center' }}>{root.resourceCount || 0}</td>
                <td>{root.orden}</td>
                <td>{root.activo ? 'Si' : 'No'}</td>
                <td>
                  <div className="action-btns">
                    <button className="btn btn-sm" onClick={() => navigate(`/categories/${root.id}/edit`)} disabled={busyId === root.id}>Editar</button>
                    <button className="btn btn-sm btn-outline" onClick={() => startEdit(root)} disabled={busyId === root.id}>Edicion rapida</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(root.id)} disabled={busyId === root.id}>{busyId === root.id ? '...' : 'Eliminar'}</button>
                  </div>
                </td>
              </tr>
              {subCategories(root.id).map((sub) => (
                <tr key={sub.id}>
                  <td style={{ paddingLeft: '2rem' }}>{sub.name?.es || sub.slug}</td>
                  <td>{sub.slug}</td>
                  <td style={{ textAlign: 'center' }}>{sub.resourceCount || 0}</td>
                  <td>{sub.orden}</td>
                  <td>{sub.activo ? 'Si' : 'No'}</td>
                  <td>
                    <div className="action-btns">
                      <button className="btn btn-sm" onClick={() => navigate(`/categories/${sub.id}/edit`)} disabled={busyId === sub.id}>Editar</button>
                      <button className="btn btn-sm btn-outline" onClick={() => startEdit(sub)} disabled={busyId === sub.id}>Edicion rapida</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(sub.id)} disabled={busyId === sub.id}>{busyId === sub.id ? '...' : 'Eliminar'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
      )}
    </div>
  );
}
