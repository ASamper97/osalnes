/**
 * AuditLogPanel — historial de cambios del recurso (decisión 5-A)
 *
 * Panel plegable que muestra las últimas N entradas de la tabla
 * `audit_log` filtradas por `resource_id`. El padre se encarga de
 * cargar los datos (lazy: solo cuando el panel se expande por
 * primera vez).
 */

import { useState, useEffect } from 'react';

export interface AuditEntry {
  id: string;
  /** Timestamp ISO */
  createdAt: string;
  /** Acción: create/update/publish/unpublish/delete */
  action: string;
  /** Usuario que hizo el cambio (email o nombre) */
  actor: string | null;
  /**
   * Campos modificados (si es un update). Array de pairs
   * [campo, valor_nuevo] resumido; o null si no hay detalle.
   */
  changedFields: string[] | null;
}

export interface AuditLogPanelProps {
  /** Callback que el padre usa para cargar entradas (lazy) */
  onLoadEntries: () => Promise<AuditEntry[]>;
  /** Opcional: entradas precargadas (si el padre quiere cargar eager) */
  initialEntries?: AuditEntry[];
}

const ACTION_LABELS: Record<string, { label: string; emoji: string }> = {
  create: { label: 'Creación del recurso', emoji: '✨' },
  update: { label: 'Edición', emoji: '✏️' },
  publish: { label: 'Publicación', emoji: '🚀' },
  unpublish: { label: 'Despublicación', emoji: '📥' },
  schedule: { label: 'Programación de publicación', emoji: '⏰' },
  delete: { label: 'Eliminación', emoji: '🗑️' },
};

export default function AuditLogPanel({ onLoadEntries, initialEntries }: AuditLogPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState<AuditEntry[]>(initialEntries ?? []);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(initialEntries != null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded || loaded || loading) return;
    setLoading(true);
    setError(null);
    onLoadEntries()
      .then((result) => {
        setEntries(result);
        setLoaded(true);
      })
      .catch(() => {
        setError('No se pudo cargar el historial.');
      })
      .finally(() => setLoading(false));
  }, [expanded, loaded, loading, onLoadEntries]);

  return (
    <section className="audit-log-panel">
      <button
        type="button"
        className="audit-log-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="audit-log-toggle-head">
          <span className="audit-log-icon" aria-hidden>📜</span>
          <div>
            <h4>Historial de cambios</h4>
            <p className="muted">Quién editó qué y cuándo.</p>
          </div>
        </div>
        <span className="audit-log-chevron" aria-hidden>{expanded ? '▼' : '▶'}</span>
      </button>

      {expanded && (
        <div className="audit-log-body">
          {loading && <p className="muted audit-log-loading">Cargando historial…</p>}
          {error && <p role="alert" className="audit-log-error">⚠️ {error}</p>}
          {!loading && !error && entries.length === 0 && (
            <p className="muted audit-log-empty">
              Sin cambios registrados todavía.
            </p>
          )}
          {!loading && !error && entries.length > 0 && (
            <ol className="audit-log-list" role="list">
              {entries.map((entry) => (
                <AuditEntryRow key={entry.id} entry={entry} />
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}

function AuditEntryRow({ entry }: { entry: AuditEntry }) {
  const meta = ACTION_LABELS[entry.action] ?? {
    label: entry.action,
    emoji: '•',
  };

  return (
    <li className="audit-entry">
      <div className="audit-entry-marker" aria-hidden>{meta.emoji}</div>
      <div className="audit-entry-body">
        <div className="audit-entry-head">
          <strong>{meta.label}</strong>
          <span className="muted audit-entry-date">
            {formatRelativeDate(entry.createdAt)}
          </span>
        </div>
        {entry.actor && (
          <div className="audit-entry-actor muted">por {entry.actor}</div>
        )}
        {entry.changedFields && entry.changedFields.length > 0 && (
          <ul className="audit-entry-fields" role="list">
            {entry.changedFields.slice(0, 4).map((field) => (
              <li key={field} className="audit-entry-field">{field}</li>
            ))}
            {entry.changedFields.length > 4 && (
              <li className="audit-entry-field-more muted">
                + {entry.changedFields.length - 4} más
              </li>
            )}
          </ul>
        )}
      </div>
    </li>
  );
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'ahora mismo';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} día${days === 1 ? '' : 's'}`;
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
