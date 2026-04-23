/**
 * ExportsRoute — wrapper de la página /exports (SCR-13 Fase B)
 *
 * Cambios respecto a Fase A:
 *   · Soporta ruta /exports/:id con drawer abierto sobre la tabla.
 *   · Instancia hook useExportJobDetail cuando hay :id en URL.
 *   · Propaga isAdmin para permitir el log completo (decisión B3-C).
 *
 * Patrón de montaje idéntico a DashboardRoute / ResourcesRoute:
 *   · supabase desde @/lib/supabase
 *   · useAuth desde @/lib/auth-context
 *   · Cast `as unknown as SupabaseLike` porque supabase-js devuelve
 *     PostgrestFilterBuilder (thenable) en `.rpc()`, que TS no
 *     reconoce como Promise nominal.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { parseUserRole } from '@osalnes/shared/data/rbac';
import { useExports, type SupabaseLike as ExportsSupabaseLike } from '@/hooks/useExports';
import {
  useExportJobDetail,
  type SupabaseLike as JobDetailSupabaseLike,
} from '@/hooks/useExportJobDetail';
import ExportsPage from '@/pages/ExportsPage';
import ExportJobDetailDrawer from '@/components/exports/ExportJobDetailDrawer';
import '@/pages/exports.css';
import '@/pages/exports-detail.css';

export default function ExportsRoute() {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const { user, role: legacyRole } = useAuth();

  // Permisos para el log completo (decisión B3-C). Admin en cualquiera
  // de los dos sistemas RBAC que coexisten hasta SCR-14:
  //   · legacy profile.role (tabla usuario)
  //   · shared user_metadata.role (SCR-02+)
  const sharedRole = parseUserRole(user?.user_metadata);
  const isAdmin = legacyRole === 'admin' || sharedRole === 'admin';

  const exportsState = useExports({
    supabase: supabase as unknown as ExportsSupabaseLike,
  });

  const [selectedJobId, setSelectedJobId] = useState<string | null>(
    params.id ?? null,
  );

  // Sincronizar el state con la URL (para back/forward del navegador)
  useEffect(() => {
    setSelectedJobId(params.id ?? null);
  }, [params.id]);

  const detailState = useExportJobDetail({
    supabase: supabase as unknown as JobDetailSupabaseLike,
    jobId: selectedJobId,
    isAdmin,
  });

  const handleOpenJobDetail = useCallback((jobId: string) => {
    navigate(`/exports/${jobId}`);
  }, [navigate]);

  const handleCloseDrawer = useCallback(() => {
    navigate('/exports');
  }, [navigate]);

  const handleRetryCreated = useCallback((newJobId: string) => {
    // Refresca el listado y navega al nuevo job (el drawer se
    // reabrirá con el detalle del reintento)
    void exportsState.refetch();
    navigate(`/exports/${newJobId}`);
  }, [exportsState, navigate]);

  const handleOpenResource = useCallback((resourceId: string) => {
    // Navega al wizard del recurso (ruta real del CMS)
    navigate(`/resources/${resourceId}`);
  }, [navigate]);

  return (
    <>
      <ExportsPage
        state={exportsState}
        onOpenJobDetail={handleOpenJobDetail}
      />

      <ExportJobDetailDrawer
        state={detailState}
        isAdmin={isAdmin}
        isOpen={selectedJobId !== null}
        onClose={handleCloseDrawer}
        onRetryCreated={handleRetryCreated}
        onOpenResource={handleOpenResource}
      />
    </>
  );
}
