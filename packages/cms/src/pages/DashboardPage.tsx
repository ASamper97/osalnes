import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type DashboardStats } from '../lib/api';
import { SkeletonDashboard } from '../components/Skeleton';

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

  useEffect(() => {
    api.getStats().then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div>
        <h1>Dashboard</h1>
        <div className="alert alert-error">Error cargando estadisticas: {error}</div>
      </div>
    );
  }

  if (!stats) {
    return <SkeletonDashboard />;
  }

  const r = stats.resources;

  return (
    <div>
      <h1>Dashboard</h1>
      <p style={{ color: 'var(--cms-text-light)', marginBottom: '1.5rem' }}>
        Panel de control operativo — UNE 178502
      </p>

      {/* KPI cards (UNE 178502 sec. 6.3) */}
      <div className="dashboard-grid">
        <StatCard label="Recursos totales" value={r.total} />
        <StatCard label="Publicados" value={r.published} color="var(--status-publicado)" />
        <StatCard label="En revision" value={r.review} color="var(--status-revision)" />
        <StatCard label="Borradores" value={r.draft} color="var(--status-borrador)" />
        <StatCard label="Archivados" value={r.archived} color="var(--status-archivado)" />
        <StatCard label="Municipios" value={stats.municipalities} />
        <StatCard label="Categorias" value={stats.categories} />
      </div>

      {/* Content alerts */}
      {stats.alerts.length > 0 && (
        <div className="dashboard-section">
          <div className="dashboard-alerts">
            {stats.alerts.map((a, i) => (
              <div key={i} className={`alert alert-${a.level}`}>
                {a.level === 'error' ? '!!' : '!'} {a.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick search + actions */}
      <div className="dashboard-section">
        <h2>Acciones rapidas</h2>
        <div className="dashboard-actions">
          <QuickSearch />
          <Link to="/resources?new=1" className="btn btn-primary">Nuevo recurso</Link>
          <Link to="/resources?status=revision" className="btn btn-outline">
            Pendientes de revision ({r.review})
          </Link>
        </div>
      </div>

      {/* UNE 178502 — Indicadores del destino */}
      {stats.une178502 && (
        <div className="dashboard-section">
          <h2>Indicadores UNE 178502</h2>
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
        </div>
      )}

      {/* Data quality detail */}
      <div className="dashboard-section">
        <h2>Calidad del dato</h2>
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
      </div>

      {/* UNE 178502 sec. 6.3 — Distribution indicators */}
      <div className="dashboard-columns">
        {/* Resources per municipality */}
        <div className="dashboard-section">
          <h2>Recursos por municipio</h2>
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

        {/* Resources per typology group */}
        <div className="dashboard-section">
          <h2>Recursos por tipologia</h2>
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

      {/* Last export */}
      {stats.lastExport && (
        <div className="dashboard-section">
          <h2>Ultima exportacion PID</h2>
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
        </div>
      )}

      {/* UNE 178502 sec. 6.4 — Traceability */}
      <div className="dashboard-section">
        <h2>Actividad reciente (UNE 178502 sec. 6.4)</h2>
        {stats.recentChanges.length > 0 ? (
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
        ) : (
          <p className="dashboard-empty">Sin actividad registrada aun</p>
        )}
      </div>
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

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value" style={color ? { color } : undefined}>{value}</div>
    </div>
  );
}

function QualityBar({ label, percent }: { label: string; percent: number }) {
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
}

function UneIndicator({ label, value, desc }: { label: string; value: number; desc: string }) {
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
}

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
