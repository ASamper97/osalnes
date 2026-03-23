import { useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';

interface NavItem {
  id: string;
  menuSlug: string;
  parentId: string | null;
  tipo: string;
  referencia: string | null;
  orden: number;
  visible: boolean;
  label: { es?: string; gl?: string };
}

const MENUS = ['header', 'footer', 'sidebar'];
const TIPOS = ['pagina', 'recurso', 'url_externa', 'categoria', 'tipologia'];

export function NavigationPage() {
  const [items, setItems] = useState<NavItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState('header');

  // Form state
  const [editing, setEditing] = useState<string | null>(null);
  const [menuSlug, setMenuSlug] = useState('header');
  const [tipo, setTipo] = useState('url_externa');
  const [referencia, setReferencia] = useState('');
  const [labelEs, setLabelEs] = useState('');
  const [labelGl, setLabelGl] = useState('');
  const [orden, setOrden] = useState('0');
  const [visible, setVisible] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadItems() {
    try {
      const data = await api.getAdminNavigation(activeMenu);
      setItems(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadItems();
  }, [activeMenu]);

  function resetForm() {
    setEditing(null);
    setMenuSlug(activeMenu);
    setTipo('url_externa');
    setReferencia('');
    setLabelEs('');
    setLabelGl('');
    setOrden('0');
    setVisible(true);
  }

  function startEdit(item: NavItem) {
    setEditing(item.id);
    setMenuSlug(item.menuSlug);
    setTipo(item.tipo);
    setReferencia(item.referencia || '');
    setLabelEs(item.label?.es || '');
    setLabelGl(item.label?.gl || '');
    setOrden(String(item.orden));
    setVisible(item.visible);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const body = {
      menu_slug: menuSlug,
      tipo,
      referencia: referencia || null,
      orden: parseInt(orden, 10) || 0,
      visible,
      label: { es: labelEs, gl: labelGl },
    };

    try {
      if (editing === 'new') {
        await api.createNavItem(body);
      } else if (editing) {
        await api.updateNavItem(editing, body);
      }
      resetForm();
      await loadItems();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminar este elemento de navegacion?')) return;
    try {
      await api.deleteNavItem(id);
      await loadItems();
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      <div className="page-header">
        <h1>Navegacion</h1>
        {!editing && (
          <button className="btn btn-primary" onClick={() => { setEditing('new'); setMenuSlug(activeMenu); }}>
            Nuevo elemento
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Menu tabs */}
      <div className="filters-bar">
        {MENUS.map((m) => (
          <button
            key={m}
            className={`btn btn-sm ${activeMenu === m ? 'btn-primary' : ''}`}
            onClick={() => { setActiveMenu(m); resetForm(); }}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      {/* Inline form */}
      {editing && (
        <form onSubmit={handleSubmit} className="resource-form" style={{ marginBottom: '1.5rem' }}>
          <fieldset>
            <legend>{editing === 'new' ? 'Nuevo elemento' : 'Editar elemento'}</legend>

            <div className="form-row">
              <div className="form-field">
                <label>Menu *</label>
                <select value={menuSlug} onChange={(e) => setMenuSlug(e.target.value)} required>
                  {MENUS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Tipo *</label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} required>
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>{t.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>Label (ES) *</label>
                <input value={labelEs} onChange={(e) => setLabelEs(e.target.value)} required placeholder="Inicio" />
              </div>
              <div className="form-field">
                <label>Label (GL)</label>
                <input value={labelGl} onChange={(e) => setLabelGl(e.target.value)} placeholder="Inicio" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-field">
                <label>Referencia</label>
                <input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="/playas o https://..." />
                <span className="field-hint">URL, slug de pagina, o ID segun el tipo</span>
              </div>
              <div className="form-field">
                <label>Orden</label>
                <input type="number" value={orden} onChange={(e) => setOrden(e.target.value)} />
              </div>
            </div>

            <div className="form-field">
              <label className="checkbox-label">
                <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
                Visible
              </label>
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

      {/* Navigation items table */}
      <table className="data-table">
        <thead>
          <tr>
            <th>Label (ES)</th>
            <th>Tipo</th>
            <th>Referencia</th>
            <th>Orden</th>
            <th>Visible</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr><td colSpan={6} style={{ textAlign: 'center', color: '#999' }}>Sin elementos en este menu</td></tr>
          ) : (
            items.map((item) => (
              <tr key={item.id}>
                <td>{item.label?.es || '—'}</td>
                <td><span className="status-badge" style={{ background: '#7f8c8d' }}>{item.tipo}</span></td>
                <td style={{ fontSize: '0.8rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.referencia || '—'}
                </td>
                <td>{item.orden}</td>
                <td>{item.visible ? 'Si' : 'No'}</td>
                <td>
                  <div className="action-btns">
                    <button className="btn btn-sm" onClick={() => startEdit(item)}>Editar</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item.id)}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
