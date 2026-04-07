import { useEffect, useState } from 'react';
import { api, type AuditLogEntry } from '@/lib/api';

/**
 * ActivityTimeline — Historial de actividad de un recurso
 *
 * Carga el log de cambios filtrado por entidad_id y los muestra en
 * formato timeline vertical con iconos y descripciones humanas.
 */

interface ActivityTimelineProps {
  entidadTipo: string;
  entidadId: string;
}

const ACCION_LABELS: Record<string, string> = {
  crear: 'Recurso creado',
  modificar: 'Datos modificados',
  publicar: 'Publicado en la web',
  archivar: 'Archivado',
  eliminar: 'Eliminado',
  enviar_revision: 'Enviado a revision',
  devolver: 'Devuelto a borrador',
  reactivar: 'Reactivado',
};

const ACCION_ICONS: Record<string, string> = {
  crear: '✨',
  modificar: '✏️',
  publicar: '🌐',
  archivar: '📦',
  eliminar: '🗑️',
  enviar_revision: '👀',
  devolver: '↩️',
  reactivar: '🔄',
};

const ACCION_COLORS: Record<string, string> = {
  crear: '#1abc9c',
  modificar: '#3498db',
  publicar: '#27ae60',
  archivar: '#95a5a6',
  eliminar: '#c0392b',
};

function timeAgo(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Hace un momento';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHour < 24) return `Hace ${diffHour}h`;
  if (diffDay < 7) return `Hace ${diffDay}d`;
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function describeChanges(entry: AuditLogEntry): string {
  const cambios = entry.cambios as Record<string, unknown> | null;
  if (!cambios) return ACCION_LABELS[entry.accion] || entry.accion;

  if (entry.accion === 'crear' && cambios.slug) {
    return `Recurso creado con slug "${cambios.slug}"`;
  }
  if (entry.accion === 'publicar' || entry.accion === 'archivar') {
    return `Estado cambiado a "${cambios.newStatus || entry.accion}"`;
  }
  if (entry.accion === 'modificar' && Array.isArray(cambios.fields)) {
    const fields = cambios.fields as string[];
    if (fields.length === 0) return 'Datos modificados';
    if (fields.length <= 3) return `Modificado: ${fields.join(', ')}`;
    return `Modificados ${fields.length} campos (${fields.slice(0, 2).join(', ')}…)`;
  }
  return ACCION_LABELS[entry.accion] || entry.accion;
}

export function ActivityTimeline({ entidadTipo, entidadId }: ActivityTimelineProps) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .getAuditLog({ entidad_tipo: entidadTipo, entidad_id: entidadId })
      .then((res) => {
        setEntries(res.items);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [entidadTipo, entidadId]);

  if (loading) {
    return <div className="activity-timeline activity-timeline--loading">Cargando historial...</div>;
  }

  if (error) {
    return <div className="activity-timeline activity-timeline--empty">No se pudo cargar el historial</div>;
  }

  if (entries.length === 0) {
    return (
      <div className="activity-timeline activity-timeline--empty">
        <span>📋</span>
        <p>Sin actividad registrada todavia</p>
      </div>
    );
  }

  const visible = expanded ? entries : entries.slice(0, 5);
  const hasMore = entries.length > 5;

  return (
    <div className="activity-timeline">
      <h3 className="activity-timeline__title">Historial de actividad</h3>
      <ol className="activity-timeline__list">
        {visible.map((entry) => {
          const color = ACCION_COLORS[entry.accion] || '#666';
          const icon = ACCION_ICONS[entry.accion] || '•';
          return (
            <li key={entry.id} className="activity-timeline__item">
              <div className="activity-timeline__dot" style={{ background: color }}>
                <span>{icon}</span>
              </div>
              <div className="activity-timeline__content">
                <p className="activity-timeline__action">{describeChanges(entry)}</p>
                <p className="activity-timeline__meta">
                  {timeAgo(entry.created_at)}
                  {entry.usuario_id && <span> · usuario {entry.usuario_id.slice(0, 8)}</span>}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      {hasMore && (
        <button
          type="button"
          className="btn btn-sm btn-outline activity-timeline__more"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Mostrar menos' : `Mostrar ${entries.length - 5} mas`}
        </button>
      )}
    </div>
  );
}
