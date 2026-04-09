import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { api, clearAuthCache, type UserProfile } from './api';

type UserRole = UserProfile['role'];

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Get initial session and profile
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (cancelled) return;
      setSession(s);
      setUser(s?.user ?? null);

      if (s) {
        try {
          const p = await api.getProfile();
          if (!cancelled) setProfile(p);
        } catch {
          // Not registered in DTI or deactivated — clear session
          if (!cancelled) setProfile(null);
        }
      }
      if (!cancelled) setLoading(false);
    });

    // Listen for future auth changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (!s) {
        setProfile(null);
        setLoading(false);
      }
      // Profile will be fetched after signIn navigates to Dashboard
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Map common Supabase auth errors to friendly Spanish messages
      const m = error.message.toLowerCase();
      if (m.includes('invalid login credentials')) return { error: 'Email o contrasena incorrectos.' };
      if (m.includes('email not confirmed')) return { error: 'Tu cuenta aun no esta confirmada. Pide a tu administrador un nuevo enlace de invitacion.' };
      if (m.includes('user not found')) return { error: 'No existe ningun usuario con ese email.' };
      if (m.includes('rate')) return { error: 'Demasiados intentos. Espera unos minutos.' };
      return { error: error.message };
    }

    // Fetch profile right after successful login
    try {
      const p = await api.getProfile();
      setProfile(p);
    } catch (e) {
      // Log the actual error so transient failures (network, 5xx) can be diagnosed
      console.error('[auth] Profile fetch failed after sign-in:', e);
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      const errMsg = (e as Error).message || '';
      if (errMsg.toLowerCase().includes('network') || errMsg.toLowerCase().includes('fetch')) {
        return { error: 'Error de conexion al cargar tu perfil. Intentalo de nuevo en unos segundos.' };
      }
      if (errMsg.includes('404') || errMsg.toLowerCase().includes('not found')) {
        return { error: 'Tu email no esta registrado en el CMS de O Salnes. Pide acceso a tu administrador.' };
      }
      if (errMsg.includes('403') || errMsg.toLowerCase().includes('forbidden') || errMsg.toLowerCase().includes('inactive')) {
        return { error: 'Tu cuenta ha sido desactivada. Contacta con tu administrador.' };
      }
      return { error: `No se pudo cargar tu perfil: ${errMsg || 'error desconocido'}` };
    }

    return { error: null };
  }

  async function signOut() {
    clearAuthCache();
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, role: profile?.role ?? null, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
