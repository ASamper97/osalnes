import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';

export function ProtectedRoute() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Cargando...</p>
      </div>
    );
  }

  // No Supabase session
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // User authenticated but not registered in DTI or deactivated
  // (auth-context already signs out in this case, but guard just in case)
  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
