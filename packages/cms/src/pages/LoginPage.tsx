import { useState, useRef, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000; // 30 seconds

export function LoginPage() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const attempts = useRef(0);

  // If already logged in, redirect
  if (user) {
    navigate('/', { replace: true });
    return null;
  }

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (isLocked) {
      const secsLeft = Math.ceil(((lockedUntil ?? 0) - Date.now()) / 1000);
      setError(`Demasiados intentos. Espera ${secsLeft} segundos.`);
      return;
    }

    setError(null);
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      attempts.current += 1;
      if (attempts.current >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCKOUT_MS;
        setLockedUntil(until);
        setError(`Demasiados intentos fallidos. Bloqueado durante ${LOCKOUT_MS / 1000} segundos.`);
        // Auto-unlock after lockout period
        setTimeout(() => {
          setLockedUntil(null);
          attempts.current = 0;
          setError(null);
        }, LOCKOUT_MS);
      } else {
        setError(error);
      }
      setLoading(false);
    } else {
      attempts.current = 0;
      navigate('/', { replace: true });
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>DTI Salnes</h1>
          <p>Panel de administracion</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="login-error">{error}</div>}

          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@osalnes.gal"
              required
              autoFocus
              disabled={isLocked}
              autoComplete="email"
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">Contrasena</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={isLocked}
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading || isLocked}>
            {isLocked ? 'Bloqueado' : loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
