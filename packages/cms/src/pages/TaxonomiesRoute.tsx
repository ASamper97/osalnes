/**
 * TaxonomiesRoute — wrapper /taxonomies
 *
 * Instancia el hook useTaxonomies y resuelve el rol del usuario para
 * pasarlo a TaxonomiesPage, que aplicará el RBAC por catálogo.
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import TaxonomiesPage from './TaxonomiesPage';
import { useTaxonomies } from '../hooks/useTaxonomies';

// Imports específicos del proyecto (se resuelven al integrar)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const supabase: any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const useAuth: () => {
  user?: { user_metadata?: { role?: string } };
  profile?: { role?: string };
};

/**
 * Resuelve el rol del usuario combinando los dos sistemas RBAC
 * coexistentes en el proyecto (profile.role legacy + user_metadata.role shared).
 * Patrón idéntico al usado en Layout.tsx y ExportsRoute.tsx.
 */
function resolveUserRole(auth: ReturnType<typeof useAuth>):
  'admin' | 'platform' | 'tourist_manager' | 'operator' | 'unknown' {
  const sharedRole = auth.user?.user_metadata?.role;
  const legacyRole = auth.profile?.role;

  if (sharedRole === 'admin' || legacyRole === 'admin') return 'admin';
  if (sharedRole === 'platform') return 'platform';
  if (sharedRole === 'tourist_manager' || legacyRole === 'gestor_turistico') return 'tourist_manager';
  if (legacyRole === 'tecnico' || legacyRole === 'operator') return 'operator';
  return 'unknown';
}

export default function TaxonomiesRoute() {
  const navigate = useNavigate();
  const auth = useAuth();
  const userRole = resolveUserRole(auth);

  const state = useTaxonomies({ supabase });

  const handleOpenResource = useCallback((resourceId: string) => {
    if (!resourceId) {
      // caso "ver los X en el listado" (no hay id específico)
      navigate('/resources');
      return;
    }
    navigate(`/resources/${resourceId}/edit`);
  }, [navigate]);

  return (
    <TaxonomiesPage
      state={state}
      userRole={userRole}
      onOpenResource={handleOpenResource}
    />
  );
}
