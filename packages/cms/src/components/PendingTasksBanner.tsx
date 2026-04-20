import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

/**
 * PendingTasksBanner — bloque superior del listado de recursos, cambia según
 * el rol del usuario autenticado:
 *
 *   - editor:      "Tus borradores" — cuántos recursos en estado borrador
 *   - validador:   cola de pendientes de revisión + antigüedad del más viejo
 *   - admin:       resumen del sistema (revisión + borrador)
 *   - tecnico:     modo consulta, se oculta
 *   - analitica:   modo consulta, se oculta
 *
 * v1 (guía-burros lote 3a) no filtra por `created_by=me` para Editor, eso
 * entra en Lote 3b cuando la edge function /resources acepte el parámetro
 * y se despliegue. Mientras tanto, Editor ve el total global de borradores.
 */

interface StatusCount {
  total: number;
  oldest?: string | null;
}

export function PendingTasksBanner() {
  const { profile } = useAuth();
  const role = profile?.role;
  const [counts, setCounts] = useState<Record<string, StatusCount>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!role || role === 'tecnico' || role === 'analitica') {
      setLoading(false);
      return;
    }
    // Peticiones mínimas: sólo los estados que el rol actual necesita ver.
    const interesting: string[] =
      role === 'editor' ? ['borrador'] :
      role === 'validador' ? ['revision'] :
      /* admin */ ['borrador', 'revision'];

    Promise.all(
      interesting.map((status) =>
        // limit=1 + sort=updated → sólo necesitamos total y el más antiguo
        api.getResources({ status, limit: '1', sort: 'updated' })
          .then((res) => {
            const oldest = res.items[0]?.updatedAt ?? null;
            return [status, { total: res.total, oldest }] as const;
          })
          .catch(() => [status, { total: 0, oldest: null }] as const),
      ),
    ).then((entries) => {
      const next: Record<string, StatusCount> = {};
      for (const [s, v] of entries) next[s] = v;
      setCounts(next);
      setLoading(false);
    });
  }, [role]);

  if (!role || role === 'tecnico' || role === 'analitica') return null;
  if (loading) return null; // Silencio inicial — aparece cuando hay datos
  const anyCount = (counts.borrador?.total ?? 0) + (counts.revision?.total ?? 0);
  if (anyCount === 0) return null; // Nada pendiente → no molestamos

  return (
    <div className="pending-tasks">
      {role === 'editor' && renderEditor(counts)}
      {role === 'validador' && renderValidador(counts)}
      {role === 'admin' && renderAdmin(counts)}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Renderers por rol
// ─────────────────────────────────────────────────────────────────────────

function renderEditor(counts: Record<string, StatusCount>) {
  const n = counts.borrador?.total ?? 0;
  if (n === 0) return null;
  return (
    <div className="pending-tasks__card pending-tasks__card--editor">
      <div className="pending-tasks__header">
        <span className="pending-tasks__icon">📝</span>
        <h3 className="pending-tasks__title">Tu trabajo</h3>
      </div>
      <p className="pending-tasks__line">
        <strong>{n}</strong> {n === 1 ? 'borrador' : 'borradores'} sin publicar.
        <span className="pending-tasks__hint">
          {' '}Completa y envía a revisión cuando estén listos.
        </span>
      </p>
      <div className="pending-tasks__actions">
        <Link to="/resources?status=borrador" className="btn btn-sm btn-primary">
          Ver borradores →
        </Link>
      </div>
    </div>
  );
}

function renderValidador(counts: Record<string, StatusCount>) {
  const n = counts.revision?.total ?? 0;
  if (n === 0) return null;
  const daysOld = daysSince(counts.revision?.oldest);
  return (
    <div className="pending-tasks__card pending-tasks__card--validador">
      <div className="pending-tasks__header">
        <span className="pending-tasks__icon">⏳</span>
        <h3 className="pending-tasks__title">Pendiente de tu aprobación</h3>
      </div>
      <p className="pending-tasks__line">
        <strong>{n}</strong> {n === 1 ? 'recurso espera' : 'recursos esperan'} tu revisión.
        {daysOld !== null && (
          <span className="pending-tasks__hint">
            {' '}El más antiguo lleva <strong>{daysOld} {daysOld === 1 ? 'día' : 'días'}</strong>.
          </span>
        )}
      </p>
      <div className="pending-tasks__actions">
        <Link to="/resources?status=revision" className="btn btn-sm btn-primary">
          Revisar cola →
        </Link>
      </div>
    </div>
  );
}

function renderAdmin(counts: Record<string, StatusCount>) {
  const borradores = counts.borrador?.total ?? 0;
  const revision = counts.revision?.total ?? 0;
  return (
    <div className="pending-tasks__card pending-tasks__card--admin">
      <div className="pending-tasks__header">
        <span className="pending-tasks__icon">🎛️</span>
        <h3 className="pending-tasks__title">Estado del sistema</h3>
      </div>
      <p className="pending-tasks__line">
        <strong>{borradores}</strong> en borrador ·{' '}
        <strong>{revision}</strong> en revisión
      </p>
      {revision > 0 && (
        <div className="pending-tasks__actions">
          <Link to="/resources?status=revision" className="btn btn-sm">
            Ver cola de revisión →
          </Link>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (isNaN(then)) return null;
  const diff = Date.now() - then;
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
}
