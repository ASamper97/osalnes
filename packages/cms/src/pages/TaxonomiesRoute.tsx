/**
 * TaxonomiesRoute — wrapper de /taxonomies (SCR-10 v2)
 *
 * Instancia el hook useTaxonomies y resuelve el rol del usuario para
 * pasarlo a TaxonomiesPage, que aplica el RBAC por catálogo.
 *
 * Patrón idéntico a ExportsRoute / DashboardRoute:
 *   · supabase desde @/lib/supabase
 *   · useAuth desde @/lib/auth-context
 *   · Cast `as unknown as SupabaseLike` porque supabase-js devuelve
 *     PostgrestFilterBuilder (thenable) en `.rpc()`.
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { parseUserRole } from '@osalnes/shared/data/rbac';
import { useTaxonomies, type SupabaseLike } from '@/hooks/useTaxonomies';
import TaxonomiesPage from '@/pages/TaxonomiesPage';
import '@/pages/taxonomies.css';

/**
 * Resuelve el rol efectivo combinando los dos sistemas RBAC que
 * coexisten en el proyecto (decisión 7-C del SCR-10):
 *   · profile.role (legacy, 5 valores: admin|editor|validador|tecnico|analitica)
 *   · user_metadata.role (shared, 5 valores del pliego)
 *
 * Reducción al set que TaxonomiesPage entiende:
 *   admin | platform | tourist_manager | operator | unknown.
 *
 * Mapeo legacy → shared (explícito):
 *   · admin (legacy)    → admin
 *   · tecnico (legacy)  → operator (no es platform: el tecnico de la
 *                         tabla usuario es rol operativo, no estratégico)
 *   · analitica         → operator (solo lectura; canEdit=false cae
 *                         igualmente por RBAC del catálogo)
 *
 * Si hay conflicto (p. ej. legacy='admin' y shared='operator'), gana
 * el más permisivo. No debería ocurrir en prod — cuando llegue SCR-14
 * se unificarán.
 */
function resolveUserRole(
  profileRole: string | null | undefined,
  userMetadata: unknown,
): 'admin' | 'platform' | 'tourist_manager' | 'operator' | 'unknown' {
  const sharedRole = parseUserRole(userMetadata);

  if (sharedRole === 'admin' || profileRole === 'admin') return 'admin';
  if (sharedRole === 'platform') return 'platform';
  if (sharedRole === 'tourism_manager') return 'tourist_manager';
  if (
    sharedRole === 'operator' ||
    profileRole === 'tecnico' ||
    profileRole === 'editor' ||
    profileRole === 'validador' ||
    profileRole === 'analitica'
  ) return 'operator';
  return 'unknown';
}

export default function TaxonomiesRoute() {
  const navigate = useNavigate();
  const { user, role: legacyRole } = useAuth();
  const userRole = resolveUserRole(legacyRole, user?.user_metadata);

  const state = useTaxonomies({
    supabase: supabase as unknown as SupabaseLike,
  });

  const handleOpenResource = useCallback((resourceId: string) => {
    if (!resourceId) {
      // caso "ver los X recursos con este término" (sin id específico)
      navigate('/resources');
      return;
    }
    // Ruta del wizard del recurso (idem DashboardRoute / ResourcesRoute)
    navigate(`/resources/${resourceId}`);
  }, [navigate]);

  return (
    <TaxonomiesPage
      state={state}
      userRole={userRole}
      onOpenResource={handleOpenResource}
    />
  );
}
