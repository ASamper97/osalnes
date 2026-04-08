import { useEffect, useState, useCallback } from 'react';
import { api, type ExportJob, type MunicipalityItem } from '../lib/api';
import { useNotifications } from '../lib/notifications';

/**
 * ExportsPage — Catalogo visual de presets de exportacion
 *
 * Reemplaza los botones planos por cards de "1 click" que cubren los
 * casos de uso tipicos: exportacion mensual a PID, snapshots a Data Lake,
 * descargas JSON-LD para integracion externa.
 */

const STATUS_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  completado: 'Completado',
  error: 'Error',
};

const STATUS_CLASS: Record<string, string> = {
  pendiente: 'revision',
  en_proceso: 'revision',
  completado: 'publicado',
  error: 'borrador',
};

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

interface PresetDef {
  id: string;
  icon: string;
  title: string;
  description: string;
  badge?: string;
  badgeColor?: 'pid' | 'data' | 'json' | 'csv';
  /** Returns null if no API call (link), otherwise calls the API */
  action: () => Promise<void> | void;
  isLink?: boolean;
  href?: string;
}

export function ExportsPage() {
  const { notify } = useNotifications();
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [municipalities, setMunicipalities] = useState<MunicipalityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedMunicipio, setSelectedMunicipio] = useState('');

  const fetchJobs = useCallback(async () => {
    try {
      const data = await api.getExports();
      setJobs(data);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    api.getMunicipalities().then(setMunicipalities).catch(() => {});
  }, [fetchJobs]);

  async function runPreset(presetId: string, fn: () => Promise<unknown>) {
    setTriggering(presetId);
    setError('');
    setSuccess('');
    try {
      await fn();
      setSuccess('Exportacion iniciada correctamente. Revisa el historial mas abajo.');
      setTimeout(() => setSuccess(''), 5000);
      notify({
        type: 'success',
        title: 'Exportacion iniciada',
        message: `La exportacion "${presetId}" ha comenzado.`,
        link: '/exports',
      });
      await fetchJobs();
    } catch (e: unknown) {
      const msg = (e as Error).message;
      setError(msg);
      notify({
        type: 'error',
        title: 'Error en exportacion',
        message: msg,
      });
    } finally {
      setTriggering(null);
    }
  }

  const presets: PresetDef[] = [
    {
      id: 'pid-full',
      icon: '🚀',
      title: 'Exportacion completa a PID',
      description: 'Envia todos los recursos publicados al PID de SEGITTUR. Es la exportacion principal y la que cumple los requisitos del DTI.',
      badge: 'PID · Completa',
      badgeColor: 'pid',
      action: () => runPreset('pid-full', () => api.createExportPid()),
    },
    {
      id: 'pid-recent',
      icon: '📅',
      title: 'Novedades del ultimo mes a PID',
      description: 'Solo los recursos creados o modificados en los ultimos 30 dias. Util para mantener el PID actualizado sin reenviar todo.',
      badge: 'PID · Mensual',
      badgeColor: 'pid',
      action: () => runPreset('pid-recent', () => api.createExportPid({ since_days: 30 })),
    },
    {
      id: 'datalake',
      icon: '💧',
      title: 'Snapshot a Data Lake',
      description: 'Volcado completo del catalogo para analisis interno. Ideal para reportes mensuales y BI.',
      badge: 'Data Lake',
      badgeColor: 'data',
      action: () => runPreset('datalake', () => api.createExportDatalake()),
    },
    {
      id: 'jsonld',
      icon: '🔗',
      title: 'JSON-LD publico (schema.org)',
      description: 'Descarga el catalogo en formato JSON-LD compatible con Google, Bing y motores de IA. Sin proceso, descarga inmediata.',
      badge: 'JSON-LD · Publico',
      badgeColor: 'json',
      isLink: true,
      href: `${API_BASE}/export/jsonld`,
      action: () => {},
    },
    {
      id: 'jsonld-municipio',
      icon: '📍',
      title: 'JSON-LD filtrado por municipio',
      description: 'Descarga solo los recursos de un municipio especifico. Util para integraciones con webs municipales independientes.',
      badge: 'JSON-LD · Por municipio',
      badgeColor: 'json',
      isLink: true,
      href: selectedMunicipio
        ? `${API_BASE}/export/jsonld?municipio=${selectedMunicipio}`
        : `${API_BASE}/export/jsonld`,
      action: () => {},
    },
  ];

  // Last successful PID export — useful as a stat
  const lastPid = jobs.find((j) => j.tipo === 'pid' && j.estado === 'completado');
  const lastDatalake = jobs.find((j) => j.tipo === 'datalake' && j.estado === 'completado');

  return (
    <div>
      <div className="page-header">
        <h1>Exportaciones</h1>
        <span className="exports-page__hint">Interoperabilidad con SEGITTUR / Data Lake / Schema.org</span>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
      {success && <div className="alert" style={{ background: '#d5f5e3', color: '#1e8449', borderLeft: '3px solid #1e8449', marginBottom: '1rem' }}>{success}</div>}

      {/* Quick stats */}
      <div className="exports-stats">
        <div className="exports-stat">
          <span className="exports-stat__label">Ultima exportacion PID</span>
          <strong>{lastPid ? formatDate(lastPid.created_at) : 'Nunca'}</strong>
          {lastPid && <span className="exports-stat__sub">{lastPid.registros_ok} registros</span>}
        </div>
        <div className="exports-stat">
          <span className="exports-stat__label">Ultimo Data Lake</span>
          <strong>{lastDatalake ? formatDate(lastDatalake.created_at) : 'Nunca'}</strong>
          {lastDatalake && <span className="exports-stat__sub">{lastDatalake.registros_ok} registros</span>}
        </div>
        <div className="exports-stat">
          <span className="exports-stat__label">Total exportaciones</span>
          <strong>{jobs.length}</strong>
          <span className="exports-stat__sub">{jobs.filter((j) => j.estado === 'completado').length} exitosas</span>
        </div>
      </div>

      {/* Preset catalog */}
      <h2 className="exports-section-title">Acciones rapidas</h2>
      <p className="exports-section-desc">
        Cada accion ejecuta una exportacion preconfigurada con un solo click. Perfecta para tareas rutinarias mensuales.
      </p>

      <div className="exports-preset-grid">
        {presets.map((preset) => {
          const isLoading = triggering === preset.id;
          const needsMunicipio = preset.id === 'jsonld-municipio' && !selectedMunicipio;
          return (
            <div key={preset.id} className={`exports-preset exports-preset--${preset.badgeColor || 'default'}`}>
              <div className="exports-preset__icon">{preset.icon}</div>
              {preset.badge && (
                <span className={`exports-preset__badge exports-preset__badge--${preset.badgeColor || 'default'}`}>
                  {preset.badge}
                </span>
              )}
              <h3 className="exports-preset__title">{preset.title}</h3>
              <p className="exports-preset__desc">{preset.description}</p>

              {preset.id === 'jsonld-municipio' && (
                <select
                  value={selectedMunicipio}
                  onChange={(e) => setSelectedMunicipio(e.target.value)}
                  className="exports-preset__select"
                >
                  <option value="">Elige un municipio...</option>
                  {municipalities.map((m) => (
                    <option key={m.id} value={m.id}>{m.name?.es || m.slug}</option>
                  ))}
                </select>
              )}

              {preset.isLink ? (
                <a
                  href={preset.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`btn btn-primary btn-sm exports-preset__action ${needsMunicipio ? 'is-disabled' : ''}`}
                  onClick={(e) => { if (needsMunicipio) e.preventDefault(); }}
                >
                  Descargar →
                </a>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-sm exports-preset__action"
                  onClick={() => preset.action()}
                  disabled={isLoading || triggering !== null}
                >
                  {isLoading ? 'Ejecutando...' : 'Ejecutar →'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Job history */}
      <h2 className="exports-section-title">Historial reciente</h2>

      {loading ? (
        <p style={{ color: 'var(--cms-text-light)' }}>Cargando...</p>
      ) : jobs.length === 0 ? (
        <p className="dashboard-empty">Sin exportaciones registradas todavia</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Estado</th>
              <th>Tipo</th>
              <th>Registros OK</th>
              <th>Errores</th>
              <th>Inicio</th>
              <th>Fin</th>
            </tr>
          </thead>
          <tbody>
            {jobs.slice(0, 20).map((job) => (
              <tr key={job.id}>
                <td>
                  <span className={`status-badge status-badge--${STATUS_CLASS[job.estado] || 'revision'}`}>
                    {STATUS_LABELS[job.estado] || job.estado}
                  </span>
                </td>
                <td style={{ textTransform: 'uppercase', fontWeight: 600, fontSize: '0.8rem' }}>
                  {job.tipo}
                </td>
                <td>{job.registros_ok}</td>
                <td style={job.registros_err > 0 ? { color: '#e74c3c', fontWeight: 600 } : undefined}>
                  {job.registros_err}
                </td>
                <td className="table-date">{formatDate(job.created_at)}</td>
                <td className="table-date">{job.completed_at ? formatDate(job.completed_at) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
