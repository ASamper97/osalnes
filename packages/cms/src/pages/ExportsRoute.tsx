/**
 * ExportsRoute — wrapper de la página /exports (actualizado para Fase B)
 *
 * Cambios respecto a Fase A:
 *   · Soporta ruta /exports/:id con drawer abierto sobre la tabla
 *   · Instancia hook useExportJobDetail cuando hay :id en URL
 *   · Propaga isAdmin para permitir el log completo (decisión B3-C)
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useExports } from '../hooks/useExports';
import { useExportJobDetail } from '../hooks/useExportJobDetail';
import ExportsPage from './ExportsPage';
import ExportJobDetailDrawer from '../components/exports/ExportJobDetailDrawer';

// El proyecto tiene acceso a su supabase client de alguna forma —
// dejamos el import tal como lo haga el resto del CMS.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const supabase: any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const useAuth: () => { user?: { user_metadata?: { role?: string } }; profile?: { role?: string } };

export default function ExportsRoute() {
  const navigate = useNavigate();
  const params = useParams<{ id?: string }>();
  const auth = useAuth();

  // Permisos para el log completo: admin (o tecnico/platform según RBAC del CMS)
  const isAdmin =
    auth.profile?.role === 'admin' ||
    auth.user?.user_metadata?.role === 'admin';

  const exportsState = useExports({ supabase });

  const [selectedJobId, setSelectedJobId] = useState<string | null>(
    params.id ?? null,
  );

  // Sincronizar el state con la URL
  useEffect(() => {
    setSelectedJobId(params.id ?? null);
  }, [params.id]);

  const detailState = useExportJobDetail({
    supabase,
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
    // Refresca el listado y navega al nuevo job
    void exportsState.refetch();
    navigate(`/exports/${newJobId}`);
  }, [exportsState, navigate]);

  const handleOpenResource = useCallback((resourceId: string) => {
    navigate(`/resources/${resourceId}/edit`);
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
