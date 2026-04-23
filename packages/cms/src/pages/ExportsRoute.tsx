/**
 * ExportsRoute — entry point de la ruta `/exports` (SCR-13 Centro de
 * exportaciones · fase A).
 *
 * Orquesta el `ExportsPage` "dumb" con `useExports` (listado + KPIs +
 * validación + launch) y el navigate para el detalle.
 *
 * Sigue el mismo patrón que DashboardRoute / ResourcesRoute:
 *   - Instancia el hook al nivel del wrapper.
 *   - Pasa el estado completo + callbacks a la page dumb.
 *
 * Decisiones:
 *   - `onOpenJobDetail` es un placeholder en fase A: navega a
 *     `/exports/${jobId}` pero la ruta del drawer aún no existe. El
 *     ErrorBoundary de App.tsx muestra un fallback si el usuario
 *     pulsa "Ver detalle" (no bloquea el resto). El drawer real es
 *     fase B.
 *   - Cast `supabase as unknown as SupabaseLike`: mismo motivo que en
 *     DashboardRoute / useRelations. supabase-js devuelve
 *     PostgrestFilterBuilder (thenable) en `.rpc()`, que TS no
 *     reconoce como `Promise<…>` aunque en runtime funciona.
 */

import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useExports, type SupabaseLike } from '@/hooks/useExports';
import ExportsPage from '@/pages/ExportsPage';
import '@/pages/exports.css';

export default function ExportsRoute() {
  const navigate = useNavigate();

  const state = useExports({
    supabase: supabase as unknown as SupabaseLike,
  });

  return (
    <ExportsPage
      state={state}
      onOpenJobDetail={(jobId) => navigate(`/exports/${jobId}`)}
    />
  );
}
