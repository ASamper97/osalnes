import { useEffect, useState, type FormEvent } from 'react';
import { api, type UserItem } from '@/lib/api';
import { EmptyState } from '@/components/EmptyState';
import { useConfirm } from '@/components/ConfirmDialog';
import { useNotifications } from '@/lib/notifications';

/**
 * UsersPage — Gestion de usuarios con selector de rol explicativo
 *
 * En lugar de un dropdown opaco "Rol", el usuario ve 5 cards visuales
 * con descripcion clara de que puede y que no puede hacer cada rol.
 */

interface RoleDef {
  value: string;
  label: string;
  icon: string;
  short: string;
  permissions: string[];
  color: string;
}

const ROLES: RoleDef[] = [
  {
    value: 'admin',
    label: 'Administrador',
    icon: '👑',
    short: 'Acceso completo al CMS',
    permissions: [
      'Crear, editar y eliminar todo',
      'Gestionar usuarios y roles',
      'Configurar navegacion del portal',
      'Ejecutar exportaciones a SEGITTUR',
      'Ver auditoria completa',
    ],
    color: '#1a5276',
  },
  {
    value: 'editor',
    label: 'Editor',
    icon: '✏️',
    short: 'Crea y edita contenido',
    permissions: [
      'Crear y editar recursos turisticos',
      'Subir multimedia y documentos',
      'Crear paginas editoriales',
      'Enviar a revision',
      'NO puede publicar directamente',
    ],
    color: '#27ae60',
  },
  {
    value: 'validador',
    label: 'Validador',
    icon: '✅',
    short: 'Aprueba y publica',
    permissions: [
      'Revisar contenido pendiente',
      'Aprobar y publicar recursos',
      'Devolver a borrador con comentarios',
      'NO puede crear contenido nuevo',
    ],
    color: '#3498db',
  },
  {
    value: 'tecnico',
    label: 'Tecnico',
    icon: '🔧',
    short: 'Mantenimiento y operacion',
    permissions: [
      'Ejecutar exportaciones',
      'Ver logs de actividad',
      'Acceso a recursos en modo lectura',
      'NO puede modificar contenido',
      'NO puede gestionar usuarios',
    ],
    color: '#f39c12',
  },
  {
    value: 'analitica',
    label: 'Analitica',
    icon: '📊',
    short: 'Solo consulta',
    permissions: [
      'Ver dashboard y metricas',
      'Consultar todos los recursos',
      'Ver actividad y exportaciones',
      'NO puede modificar nada',
    ],
    color: '#8e44ad',
  },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function UsersPage() {
  const confirm = useConfirm();
  const { notify } = useNotifications();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState('editor');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function loadUsers() {
    api.getUsers().then(setUsers).catch((e) => setError(e.message));
  }

  useEffect(() => { loadUsers(); }, []);

  function resetForm() {
    setEditingId(null);
    setShowForm(false);
    setEmail('');
    setNombre('');
    setRol('editor');
  }

  function startCreate() {
    resetForm();
    setShowForm(true);
  }

  function startEdit(u: UserItem) {
    setEditingId(u.id);
    setShowForm(true);
    setEmail(u.email);
    setNombre(u.nombre);
    setRol(u.rol);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const errs: string[] = [];
    if (!email.trim()) errs.push('Email es obligatorio');
    if (email && !EMAIL_RE.test(email)) errs.push('Formato de email invalido');
    if (!nombre.trim()) errs.push('Nombre es obligatorio');
    if (errs.length > 0) { setError(errs.join('\n')); return; }

    setSaving(true);

    try {
      if (editingId) {
        await api.updateUser(editingId, { nombre, rol });
        notify({
          type: 'success',
          title: 'Usuario actualizado',
          message: `Cambios guardados para "${nombre}".`,
        });
      } else {
        await api.createUser({ email, nombre, rol });
        notify({
          type: 'success',
          title: 'Invitacion enviada',
          message: `Se ha enviado un email a ${email} para que configure su contrasena.`,
        });
      }
      resetForm();
      loadUsers();
    } catch (err: unknown) {
      const msg = (err as Error).message;
      setError(msg);
      notify({ type: 'error', title: 'Error', message: msg });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: string, name: string) {
    const ok = await confirm({
      title: `Desactivar usuario "${name}"?`,
      message: 'El usuario no podra volver a acceder al CMS hasta que sea reactivado. La cuenta y su historial se conservan.',
      confirmLabel: 'Desactivar',
      variant: 'warning',
    });
    if (!ok) return;
    setBusyId(id);
    try {
      await api.deactivateUser(id);
      notify({ type: 'warning', title: 'Usuario desactivado', message: `"${name}" ya no puede acceder al CMS.` });
      loadUsers();
    } catch (err: unknown) {
      const msg = (err as Error).message;
      setError(msg);
      notify({ type: 'error', title: 'Error al desactivar', message: msg });
    } finally {
      setBusyId(null);
    }
  }

  async function handleActivate(id: string, name: string) {
    const ok = await confirm({
      title: `Reactivar usuario "${name}"?`,
      message: 'El usuario podra volver a acceder al CMS con su contrasena anterior.',
      confirmLabel: 'Reactivar',
      variant: 'default',
    });
    if (!ok) return;
    setBusyId(id);
    try {
      await api.activateUser(id);
      notify({ type: 'success', title: 'Usuario reactivado', message: `"${name}" ya puede acceder al CMS.` });
      loadUsers();
    } catch (err: unknown) {
      const msg = (err as Error).message;
      setError(msg);
      notify({ type: 'error', title: 'Error al reactivar', message: msg });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirm({
      title: `Eliminar usuario "${name}" PERMANENTEMENTE?`,
      message: 'Esta accion no se puede deshacer. Se eliminara la cuenta del sistema de autenticacion y el perfil de la base de datos. Si el usuario tiene contenido asociado (recursos creados), no se podra eliminar — desactivalo en su lugar.',
      confirmLabel: 'Eliminar definitivamente',
      variant: 'danger',
    });
    if (!ok) return;
    setBusyId(id);
    try {
      await api.deleteUser(id);
      notify({ type: 'success', title: 'Usuario eliminado', message: `"${name}" ha sido eliminado permanentemente.` });
      if (editingId === id) resetForm();
      loadUsers();
    } catch (err: unknown) {
      const msg = (err as Error).message;
      setError(msg);
      notify({ type: 'error', title: 'No se pudo eliminar', message: msg });
    } finally {
      setBusyId(null);
    }
  }

  async function handleResendInvite(id: string, name: string, userEmail: string) {
    const ok = await confirm({
      title: `Reenviar invitacion a "${name}"?`,
      message: `Se enviara un nuevo email de invitacion a ${userEmail} con un enlace para configurar su contrasena.`,
      confirmLabel: 'Reenviar invitacion',
      variant: 'default',
    });
    if (!ok) return;
    setBusyId(id);
    try {
      await api.resendInvite(id);
      notify({
        type: 'success',
        title: 'Invitacion reenviada',
        message: `Email enviado a ${userEmail}.`,
      });
    } catch (err: unknown) {
      const msg = (err as Error).message;
      setError(msg);
      notify({ type: 'error', title: 'Error al reenviar', message: msg });
    } finally {
      setBusyId(null);
    }
  }

  function getRoleLabel(value: string): string {
    return ROLES.find((r) => r.value === value)?.label || value;
  }

  function getRoleIcon(value: string): string {
    return ROLES.find((r) => r.value === value)?.icon || '👤';
  }

  return (
    <div>
      <div className="page-header">
        <h1>Usuarios</h1>
        <div className="page-header__actions">
          {!showForm && (
            <button className="btn btn-primary" onClick={startCreate}>
              + Nuevo usuario
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ whiteSpace: 'pre-line' }}>{error}</div>}

      {/* Form with role cards */}
      {showForm && (
        <form onSubmit={handleSubmit} className="users-form">
          <h2 className="users-form__title">{editingId ? 'Editar usuario' : 'Nuevo usuario'}</h2>

          {!editingId && (
            <div className="users-form__info">
              <span className="users-form__info-icon">📧</span>
              <div>
                <strong>El usuario configurara su propia contrasena</strong>
                <p>
                  Al crear el usuario se enviara automaticamente un email de invitacion con un enlace seguro
                  para que el destinatario elija su contrasena. Tu nunca veras ni gestionaras contrasenas.
                </p>
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-field">
              <label>Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="usuario@osalnes.gal"
                disabled={!!editingId}
              />
              {editingId && <span className="field-hint">El email no se puede cambiar</span>}
            </div>
            <div className="form-field">
              <label>Nombre *</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} required placeholder="Nombre Apellidos" />
            </div>
          </div>

          {/* Role selector — visual cards */}
          <div className="users-role-section">
            <h3 className="users-role-title">Rol del usuario</h3>
            <p className="users-role-hint">Cada rol tiene permisos diferentes. Elige el que mejor se ajuste a las funciones de esta persona.</p>

            <div className="users-role-grid">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  className={`role-card ${rol === r.value ? 'role-card--active' : ''}`}
                  onClick={() => setRol(r.value)}
                  style={{ '--role-color': r.color } as React.CSSProperties}
                >
                  <div className="role-card__header">
                    <span className="role-card__icon">{r.icon}</span>
                    <div>
                      <strong>{r.label}</strong>
                      <span className="role-card__short">{r.short}</span>
                    </div>
                    {rol === r.value && <span className="role-card__check">✓</span>}
                  </div>
                  <ul className="role-card__permissions">
                    {r.permissions.map((perm, i) => {
                      const isNegative = perm.startsWith('NO');
                      return (
                        <li key={i} className={isNegative ? 'role-card__perm--no' : 'role-card__perm--yes'}>
                          {isNegative ? '✕' : '✓'} {perm}
                        </li>
                      );
                    })}
                  </ul>
                </button>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear usuario y enviar invitacion'}
            </button>
            <button type="button" className="btn" onClick={resetForm}>Cancelar</button>
          </div>
        </form>
      )}

      {/* Table or empty state */}
      {users.length === 0 && !showForm ? (
        <EmptyState
          icon="👥"
          title="Aun no hay usuarios"
          description="Anade usuarios para que tu equipo pueda colaborar en el CMS. Cada usuario tiene un rol con permisos especificos."
          action={{ label: '+ Crear el primer usuario', onClick: startCreate }}
        />
      ) : users.length > 0 && (
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
          {users.map((u) => (
            <tr key={u.id}>
              <td><strong>{u.nombre}</strong></td>
              <td>{u.email}</td>
              <td>
                <span className="users-role-badge">
                  {getRoleIcon(u.rol)} {getRoleLabel(u.rol)}
                </span>
              </td>
              <td>
                <span className="status-badge" style={{ background: u.activo ? '#27ae60' : '#95a5a6' }}>
                  {u.activo ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td>
                <div className="action-btns">
                  <button
                    className="btn btn-sm"
                    onClick={() => startEdit(u)}
                    disabled={busyId === u.id}
                    title="Editar nombre y rol"
                  >
                    Editar
                  </button>
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => handleResendInvite(u.id, u.nombre, u.email)}
                    disabled={busyId === u.id}
                    title="Reenviar email de invitacion para configurar contrasena"
                  >
                    📧 Invitar
                  </button>
                  {u.activo ? (
                    <button
                      className="btn btn-sm btn-warning"
                      onClick={() => handleDeactivate(u.id, u.nombre)}
                      disabled={busyId === u.id}
                      title="Bloquear acceso al CMS sin eliminar"
                    >
                      {busyId === u.id ? '...' : '🚫 Desactivar'}
                    </button>
                  ) : (
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => handleActivate(u.id, u.nombre)}
                      disabled={busyId === u.id}
                      title="Restaurar acceso al CMS"
                    >
                      {busyId === u.id ? '...' : '✓ Reactivar'}
                    </button>
                  )}
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDelete(u.id, u.nombre)}
                    disabled={busyId === u.id}
                    title="Eliminar usuario permanentemente del sistema"
                  >
                    {busyId === u.id ? '...' : '🗑️ Eliminar'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </div>
  );
}
