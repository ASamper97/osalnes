import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

/**
 * SetupPasswordPage — Configuracion de contrasena tras invitacion
 *
 * Esta pagina es PUBLICA (no requiere login). Se accede desde el
 * link del email de invitacion enviado por Supabase Auth, que incluye
 * un token en la URL que crea automaticamente una sesion temporal.
 *
 * El usuario establece su contrasena, se actualiza en auth.users y
 * se redirige al dashboard del CMS.
 */

const MIN_LENGTH = 8;

export function SetupPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Check if there's a valid session from the email link
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setHasSession(true);
        setUserEmail(session.user?.email || null);
      } else {
        setHasSession(false);
      }
    });
  }, []);

  function validate(): string | null {
    if (password.length < MIN_LENGTH) return `La contraseña debe tener al menos ${MIN_LENGTH} caracteres`;
    if (!/[A-Z]/.test(password)) return 'La contraseña debe incluir al menos una letra mayuscula';
    if (!/[0-9]/.test(password)) return 'La contraseña debe incluir al menos un numero';
    if (password !== confirm) return 'Las contraseñas no coinciden';
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setSuccess(true);
      // Wait briefly so the user sees the success message, then redirect
      setTimeout(() => navigate('/'), 1500);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (hasSession === null) {
    return (
      <div className="setup-password-page">
        <div className="setup-password__card">
          <p>Verificando enlace...</p>
        </div>
      </div>
    );
  }

  if (hasSession === false) {
    return (
      <div className="setup-password-page">
        <div className="setup-password__card">
          <div className="setup-password__icon">⚠️</div>
          <h1>Enlace invalido o caducado</h1>
          <p>
            Este enlace de invitacion ya no es valido. Puede haber caducado o haberse usado antes.
            Pide a tu administrador que te envie una nueva invitacion.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/login')}>
            Ir al login
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="setup-password-page">
        <div className="setup-password__card">
          <div className="setup-password__icon setup-password__icon--success">✅</div>
          <h1>Contrasena configurada</h1>
          <p>Te estamos redirigiendo al CMS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="setup-password-page">
      <div className="setup-password__card">
        <div className="setup-password__icon">🔐</div>
        <h1>Bienvenido al CMS de O Salnes</h1>
        {userEmail && (
          <p className="setup-password__email">
            Configurando contrasena para <strong>{userEmail}</strong>
          </p>
        )}
        <p className="setup-password__intro">
          Elige una contrasena segura para acceder al CMS. Solo tu la conoceras.
        </p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="password">Nueva contrasena *</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              autoFocus
              placeholder="Minimo 8 caracteres"
            />
          </div>

          <div className="form-field">
            <label htmlFor="confirm">Confirmar contrasena *</label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="Repite la contrasena"
            />
          </div>

          <ul className="setup-password__rules">
            <li className={password.length >= MIN_LENGTH ? 'is-ok' : ''}>
              {password.length >= MIN_LENGTH ? '✓' : '○'} Al menos {MIN_LENGTH} caracteres
            </li>
            <li className={/[A-Z]/.test(password) ? 'is-ok' : ''}>
              {/[A-Z]/.test(password) ? '✓' : '○'} Al menos una letra mayuscula
            </li>
            <li className={/[0-9]/.test(password) ? 'is-ok' : ''}>
              {/[0-9]/.test(password) ? '✓' : '○'} Al menos un numero
            </li>
            <li className={password && password === confirm ? 'is-ok' : ''}>
              {password && password === confirm ? '✓' : '○'} Las contrasenas coinciden
            </li>
          </ul>

          <button type="submit" className="btn btn-primary setup-password__submit" disabled={saving}>
            {saving ? 'Guardando...' : 'Activar mi cuenta'}
          </button>
        </form>
      </div>
    </div>
  );
}
