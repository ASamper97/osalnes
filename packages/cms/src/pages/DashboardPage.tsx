import { memo, useEffect, useState, useMemo, type FormEvent, type ReactNode, type DragEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type DashboardStats } from '../lib/api';
import { SkeletonDashboard } from '../components/Skeleton';

const ORDER_STORAGE_KEY = 'osalnes_dashboard_widgets_v1';

const DEFAULT_WIDGET_ORDER = [
  'actions', 'editorial', 'catalog', 'une', 'quality', 'distribution', 'export', 'activity',
];

function loadWidgetOrder(): string[] {
  if (typeof window === 'undefined') return DEFAULT_WIDGET_ORDER;
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY);
    if (!raw) return DEFAULT_WIDGET_ORDER;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
      // Ensure all defaults are present (for backwards compat when adding new widgets)
      const missing = DEFAULT_WIDGET_ORDER.filter((id) => !parsed.includes(id));
      return [...parsed, ...missing];
    }
    return DEFAULT_WIDGET_ORDER;
  } catch {
    return DEFAULT_WIDGET_ORDER;
  }
}

function saveWidgetOrder(order: string[]): void {
  try { localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order)); } catch { /* ignore */ }
}

const LANG_LABELS: Record<string, string> = { es: 'Espanol', gl: 'Gallego', en: 'Ingles', fr: 'Frances', pt: 'Portugues' };
const GROUP_LABELS: Record<string, string> = {
  alojamiento: 'Alojamiento', restauracion: 'Restauracion', recurso: 'Atracciones',
  evento: 'Eventos', transporte: 'Transporte', servicio: 'Servicios',
};
const GROUP_COLORS: Record<string, string> = {
  alojamiento: '#2E86C1', restauracion: '#E67E22', recurso: '#27AE60',
  evento: '#8E44AD', transporte: '#607D8B', servicio: '#E74C3C',
};

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState('');
  const [widgetOrder, setWidgetOrder] = useState<string[]>(() => loadWidgetOrder());
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  useEffect(() => {
    api.getStats().then(setStats).catch((e) => setError(e.message));
  }, []);

  function handleDragStart(id: string) {
    setDraggedId(id);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, id: string) {
    e.preventDefault();
    if (id !== dragOverId) setDragOverId(id);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, targetId: string) {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    const newOrder = [...widgetOrder];
    const fromIdx = newOrder.indexOf(draggedId);
    const toIdx = newOrder.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, draggedId);
    setWidgetOrder(newOrder);
    saveWidgetOrder(newOrder);
    setDraggedId(null);
    setDragOverId(null);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDragOverId(null);
  }

  function resetOrder() {
    setWidgetOrder(DEFAULT_WIDGET_ORDER);
    saveWidgetOrder(DEFAULT_WIDGET_ORDER);
  }

  if (error) {
    return (
      <div>
        <h1>Dashboard</h1>
        <div className="alert alert-error">Error cargando estadisticas: {error}</div>
      </div>
    );
  }

  // Build widget JSX once per stats change. The .node values are stable JSX
  // references, so React reconciliation bails out for widget contents on
  // re-renders triggered by drag state — only the wrapper div className
  // (drag styling) actually changes.
  const widgets = useMemo<Record<string, { title: string; node: ReactNode }>>(() => {
    if (!stats) return {};
    const r = stats.resources;
    return {
      actions: {
        title: 'Acciones rapidas',
        node: (
          <div className="dashboard-actions">
            <QuickSearch />
            <Link to="/resources?new=1" className="btn btn-primary">+ Nuevo recurso</Link>
            <Link to="/resources?status=revision" className="btn btn-outline">
              Pendientes de revision ({r.review})
            </Link>
          </div>
        ),
      },
      editorial: {
        title: 'Estado del trabajo',
        node: (
          <div className="dashboard-grid dashboard-grid--editorial">
            <StatCard icon="📊" label="Recursos totales" value={r.total} />
            <StatCard icon="🌐" label="Publicados" value={r.published} color="var(--status-publicado)" />
            <StatCard icon="👀" label="En revision" value={r.review} color="var(--status-revision)" />
            <StatCard icon="✏️" label="Borradores" value={r.draft} color="var(--status-borrador)" />
            <StatCard icon="📦" label="Archivados" value={r.archived} color="var(--status-archivado)" />
          </div>
        ),
      },
      catalog: {
        title: 'Catalogo del destino',
        node: (
          <div className="dashboard-grid dashboard-grid--catalog">
            <StatCard icon="📍" label="Municipios" value={stats.municipalities} />
            <StatCard icon="🏷️" label="Categorias" value={stats.categories} />
          </div>
        ),
      },
      une: {
        title: 'Indicadores UNE 178502',
        node: stats.une178502 ? (
          <>
            <p style={{ fontSize: '0.8rem', color: 'var(--cms-text-light)', marginBottom: '1rem' }}>
              Indicadores de madurez del Destino Turistico Intelixente
            </p>
            <div className="une-indicators">
              <UneIndicator label="Indice de digitalizacion" value={stats.une178502.digitalizacion} desc="Recursos con coordenadas + descripcion + imagen" />
              <UneIndicator label="Indice de multilinguismo" value={stats.une178502.multilinguismo} desc="Media de traducciones en 5 idiomas" />
              <UneIndicator label="Indice de geolocalizacion" value={stats.une178502.geolocalizacion} desc="Recursos con coordenadas GPS" />
              <UneIndicator label="Actualizacion (30 dias)" value={stats.une178502.actualizacion30d} desc="Recursos modificados ultimo mes" />
              <UneIndicator label="Actualizacion (90 dias)" value={stats.une178502.actualizacion90d} desc="Recursos modificados ultimo trimestre" />
              <UneIndicator label="Interoperabilidad PID" value={stats.une178502.interoperabilidad} desc="Exportaciones exitosas a SEGITTUR" />
            </div>
          </>
        ) : null,
      },
      quality: {
        title: 'Calidad del dato',
        node: (
          <>
            <div className="dashboard-grid dashboard-grid--2">
              <QualityBar label="Con coordenadas" percent={stats.quality.withCoordinates} />
              <QualityBar label="Con imagenes" percent={stats.quality.withImages} />
              <QualityBar label="Con descripcion" percent={stats.quality.withDescription} />
            </div>
            <h3 style={{ fontSize: '0.95rem', margin: '1rem 0 0.5rem', color: 'var(--cms-text)' }}>
              Completitud de traducciones
            </h3>
            <div className="dashboard-grid dashboard-grid--2">
              {Object.entries(stats.quality.translations).map(([lang, pct]) => (
                <QualityBar key={lang} label={LANG_LABELS[lang] || lang} percent={pct as number} />
              ))}
            </div>
          </>
        ),
      },
      distribution: {
        title: 'Distribucion del catalogo',
        node: (
          <div className="dashboard-columns">
            <div>
              <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.75rem', color: 'var(--cms-text)' }}>Por municipio</h3>
              {stats.resourcesByMunicipio.length > 0 ? (
                <table className="data-table data-table--compact">
                  <thead><tr><th>Municipio</th><th style={{ textAlign: 'right' }}>Recursos</th></tr></thead>
                  <tbody>
                    {stats.resourcesByMunicipio.map((m) => (
                      <tr key={m.id}>
                        <td>{m.slug}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{m.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="dashboard-empty">Sin datos</p>
              )}
            </div>
            <div>
              <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.75rem', color: 'var(--cms-text)' }}>Por tipologia</h3>
              {stats.resourcesByGroup.length > 0 ? (
                <div className="dashboard-bars">
                  {stats.resourcesByGroup.map(({ grupo, count }) => (
                    <div key={grupo} className="bar-row">
                      <span className="bar-row__label">
                        <span className="bar-row__dot" style={{ background: GROUP_COLORS[grupo] || '#999' }} />
                        {GROUP_LABELS[grupo] || grupo}
                      </span>
                      <div className="bar-row__track">
                        <div
                          className="bar-row__fill"
                          style={{
                            width: `${r.total > 0 ? Math.round((count / r.total) * 100) : 0}%`,
                            background: GROUP_COLORS[grupo] || '#999',
                          }}
                        />
                      </div>
                      <span className="bar-row__count">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="dashboard-empty">Sin datos</p>
              )}
            </div>
          </div>
        ),
      },
      export: {
        title: 'Ultima exportacion PID',
        node: stats.lastExport ? (
          <div className="dashboard-export">
            <span className={`status-badge status-badge--${stats.lastExport.estado === 'completado' ? 'publicado' : stats.lastExport.estado === 'error' ? 'borrador' : 'revision'}`}>
              {stats.lastExport.estado}
            </span>
            <span>{stats.lastExport.tipo.toUpperCase()}</span>
            <span>{stats.lastExport.registros_ok} registros OK</span>
            {stats.lastExport.registros_err > 0 && (
              <span style={{ color: '#e74c3c' }}>{stats.lastExport.registros_err} errores</span>
            )}
            <span style={{ color: 'var(--cms-text-light)' }}>
              {new Date(stats.lastExport.created_at).toLocaleString('es-ES')}
            </span>
          </div>
        ) : <p className="dashboard-empty">Sin exportaciones registradas</p>,
      },
      activity: {
        title: 'Actividad reciente',
        node: stats.recentChanges.length > 0 ? (
          <table className="data-table data-table--compact">
            <thead>
              <tr><th>Accion</th><th>Entidad</th><th>Fecha</th></tr>
            </thead>
            <tbody>
              {stats.recentChanges.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className={`status-badge status-badge--${actionColor(c.accion)}`}>
                      {c.accion}
                    </span>
                  </td>
                  <td>{c.entidad_tipo}</td>
                  <td>{new Date(c.created_at).toLocaleString('es-ES')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="dashboard-empty">Sin actividad registrada aun</p>,
      },
    };
  }, [stats]);

  if (!stats) {
    return <SkeletonDashboard />;
  }

  // Filter out widgets that don't apply (e.g. UNE if no data)
  const orderedWidgets = widgetOrder.filter((id) => widgets[id]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p style={{ color: 'var(--cms-text-light)' }}>
            Panel de control operativo — UNE 178502
          </p>
        </div>
        <div className="page-header__actions">
          <button
            type="button"
            className="btn btn-sm"
            onClick={resetOrder}
            title="Restablecer el orden por defecto de los widgets"
          >
            ↺ Restablecer orden
          </button>
        </div>
      </div>

      {/* Content alerts — top priority, never reorderable */}
      {stats.alerts.length > 0 && (
        <div className="dashboard-alerts" style={{ marginBottom: '1.25rem' }}>
          {stats.alerts.map((a, i) => (
            <div key={i} className={`alert alert-${a.level}`}>
              {a.level === 'error' ? '!!' : '!'} {a.message}
            </div>
          ))}
        </div>
      )}

      <p className="dashboard-hint">
        💡 Tip: arrastra los widgets por la cabecera para reordenarlos. Tu orden se guarda automaticamente.
      </p>

      {/* Reorderable widget grid */}
      {orderedWidgets.map((id) => {
        const widget = widgets[id];
        if (!widget) return null;
        const isDragging = draggedId === id;
        const isOver = dragOverId === id;
        return (
          <div
            key={id}
            className={`dashboard-section dashboard-widget ${isDragging ? 'dashboard-widget--dragging' : ''} ${isOver && !isDragging ? 'dashboard-widget--over' : ''}`}
            draggable
            onDragStart={() => handleDragStart(id)}
            onDragOver={(e) => handleDragOver(e, id)}
            onDrop={(e) => handleDrop(e, id)}
            onDragEnd={handleDragEnd}
          >
            <div className="dashboard-widget__header">
              <span className="dashboard-widget__handle" aria-hidden="true">⋮⋮</span>
              <h2>{widget.title}</h2>
            </div>
            {widget.node}
          </div>
        );
      })}
    </div>
  );
}

function actionColor(accion: string) {
  switch (accion) {
    case 'crear': case 'publicar': return 'publicado';
    case 'eliminar': return 'borrador';
    default: return 'revision';
  }
}

// Leaf components are memoized so React skips re-rendering them when props
// are reference-equal. Combined with the useMemo'd `widgets` dict above, the
// dashboard content does no work during drag operations — only the wrapper
// div className updates.
const StatCard = memo(function StatCard({ icon, label, value, color }: { icon?: string; label: string; value: number; color?: string }) {
  return (
    <div className="stat-card">
      {icon && <div className="stat-card__icon">{icon}</div>}
      <div className="stat-card__body">
        <div className="stat-card__label">{label}</div>
        <div className="stat-card__value" style={color ? { color } : undefined}>{value}</div>
      </div>
    </div>
  );
});

const QualityBar = memo(function QualityBar({ label, percent }: { label: string; percent: number }) {
  const barColor = percent >= 80 ? '#27ae60' : percent >= 50 ? '#f39c12' : '#e74c3c';
  return (
    <div className="quality-bar">
      <div className="quality-bar__header">
        <span>{label}</span>
        <span style={{ fontWeight: 700 }}>{percent}%</span>
      </div>
      <div className="quality-bar__track">
        <div className="quality-bar__fill" style={{ width: `${percent}%`, background: barColor }} />
      </div>
    </div>
  );
});

const UneIndicator = memo(function UneIndicator({ label, value, desc }: { label: string; value: number; desc: string }) {
  const color = value >= 80 ? '#27ae60' : value >= 50 ? '#f39c12' : '#e74c3c';
  const grade = value >= 80 ? 'A' : value >= 60 ? 'B' : value >= 40 ? 'C' : 'D';
  return (
    <div className="une-indicator">
      <div className="une-indicator__gauge">
        <svg viewBox="0 0 36 36" className="une-indicator__circle">
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none" stroke="#e5e8eb" strokeWidth="3"
          />
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none" stroke={color} strokeWidth="3"
            strokeDasharray={`${value}, 100`}
            strokeLinecap="round"
          />
        </svg>
        <div className="une-indicator__value">{grade}</div>
      </div>
      <div className="une-indicator__text">
        <div className="une-indicator__label">{label}</div>
        <div className="une-indicator__pct" style={{ color }}>{value}%</div>
        <div className="une-indicator__desc">{desc}</div>
      </div>
    </div>
  );
});

function QuickSearch() {
  const [q, setQ] = useState('');
  const navigate = useNavigate();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (q.trim().length >= 2) {
      navigate(`/resources?q=${encodeURIComponent(q.trim())}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="quick-search">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar recurso..."
        className="quick-search__input"
        aria-label="Buscar recurso"
      />
    </form>
  );
}
