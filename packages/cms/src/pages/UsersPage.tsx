import { useEffect, useState, type FormEvent } from 'react';
import { api, type UserItem } from '@/lib/api';

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'editor', label: 'Editor' },
  { value: 'validador', label: 'Validador' },
  { value: 'tecnico', label: 'Tecnico' },
  { value: 'analitica', label: 'Analitica' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState('editor');
  const [activo, setActivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function loadUsers() {
    api.getUsers().then(setUsers).catch((e) => setError(e.message));
  }

  useEffect(() => { loadUsers(); }, []);

  function resetForm() {
    setEditingId(null);
    setEmail('');
    setNombre('');
    setRol('editor');
    setActivo(true);
  }

  function startEdit(u: UserItem) {
    setEditingId(u.id);
    setEmail(u.email);
    setNombre(u.nombre);
    setRol(u.rol);
    setActivo(u.activo);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Client-side validation
    const errs: string[] = [];
    if (!email.trim()) errs.push('Email es obligatorio');
    if (email && !EMAIL_RE.test(email)) errs.push('Formato de email invalido');
    if (!nombre.trim()) errs.push('Nombre es obligatorio');
    if (errs.length > 0) { setError(errs.join('\n')); return; }

    setSaving(true);

    try {
      if (editingId) {
        await api.updateUser(editingId, { nombre, rol, activo });
      } else {
        await api.createUser({ email, nombre, rol });
      }
      resetForm();
      loadUsers();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: string, name: string) {
    if (!confirm(`Desactivar usuario "${name}"? No podra acceder al CMS.`)) return;
    setBusyId(id);
    try {
      await api.deleteUser(id);
      if (editingId === id) resetForm();
      loadUsers();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Usuarios</h1>
      </div>

      {error && <div className="alert alert-error" style={{ whiteSpace: 'pre-line' }}>{error}</div>}

      {/* Form */}
      <form onSubmit={handleSubmit} className="resource-form" style={{ marginBottom: '2rem' }}>
        <fieldset>
          <legend>{editingId ? 'Editar usuario' : 'Nuevo usuario'}</legend>

          <div className="form-row">
            <div className="form-field">
              <label>Email *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="usuario@osalnes.gal" disabled={!!editingId} />
              {editingId && <span className="field-hint">El email no se puede cambiar</span>}
            </div>
            <div className="form-field">
              <label>Nombre *</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} required placeholder="Nombre Apellidos" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Rol *</label>
              <select value={rol} onChange={(e) => setRol(e.target.value)}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="form-field" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
              <label className="checkbox-label">
                <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
                Activo
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear usuario'}
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
            <th>Email</th>
            <th>Rol</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 && (
            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>Sin usuarios</td></tr>
          )}
          {users.map((u) => (
            <tr key={u.id}>
              <td><strong>{u.nombre}</strong></td>
              <td>{u.email}</td>
              <td>{ROLES.find((r) => r.value === u.rol)?.label || u.rol}</td>
              <td>
                <span className="status-badge" style={{ background: u.activo ? '#27ae60' : '#95a5a6' }}>
                  {u.activo ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td>
                <div className="action-btns">
                  <button className="btn btn-sm" onClick={() => startEdit(u)} disabled={busyId === u.id}>Editar</button>
                  {u.activo && (
                    <button className="btn btn-sm btn-danger" onClick={() => handleDeactivate(u.id, u.nombre)} disabled={busyId === u.id}>
                      {busyId === u.id ? '...' : 'Desactivar'}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
