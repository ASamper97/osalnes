import { useEffect, useState, useCallback } from 'react';
import { api, type ExportJob } from '../lib/api';

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

export function ExportsPage() {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [filterTipo, setFilterTipo] = useState('');

  const fetchJobs = useCallback(async () => {
    try {
      const data = await api.getExports(filterTipo || undefined);
      setJobs(data);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filterTipo]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  async function triggerExport(tipo: 'pid' | 'datalake') {
    setTriggering(tipo);
    setError('');
    try {
      await (tipo === 'pid' ? api.createExportPid() : api.createExportDatalake());
      await fetchJobs();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setTriggering(null);
    }
  }

  return (
    <div>
      <h1>Exportaciones PID / Data Lake</h1>
      <p style={{ color: 'var(--cms-text-light)', marginBottom: '1.5rem' }}>
        Interoperabilidad con Plataforma Inteligente de Destinos (SEGITTUR)
      </p>

      {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {/* Trigger buttons */}
      <div className="exports-actions">
        <button
          className="btn btn-primary"
          onClick={() => triggerExport('pid')}
          disabled={triggering !== null}
        >
          {triggering === 'pid' ? 'Exportando...' : 'Exportar a PID'}
        </button>
        <button
          className="btn btn-outline"
          onClick={() => triggerExport('datalake')}
          disabled={triggering !== null}
        >
          {triggering === 'datalake' ? 'Exportando...' : 'Exportar a Data Lake'}
        </button>
        <a
          href={`${import.meta.env.VITE_API_URL || '/api/v1'}/export/jsonld`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn"
        >
          Ver JSON-LD publico
        </a>

        <select
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value)}
          className="exports-filter"
        >
          <option value="">Todos los tipos</option>
          <option value="pid">PID</option>
          <option value="datalake">Data Lake</option>
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </select>
      </div>

      {/* Summary cards */}
      {jobs.length > 0 && (
        <div className="exports-summary">
          <SummaryCard
            label="Ultimo exitoso"
            job={jobs.find((j) => j.estado === 'completado') || null}
          />
          <SummaryCard
            label="Ultimo error"
            job={jobs.find((j) => j.estado === 'error') || null}
          />
          <div className="stat-card">
            <div className="stat-card__label">Total exportaciones</div>
            <div className="stat-card__value">{jobs.length}</div>
          </div>
        </div>
      )}

      {/* Job history */}
      <h2 style={{ marginTop: '2rem', marginBottom: '0.75rem' }}>Historial</h2>

      {loading ? (
        <p style={{ color: 'var(--cms-text-light)' }}>Cargando...</p>
      ) : jobs.length === 0 ? (
        <p className="dashboard-empty">Sin exportaciones registradas</p>
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
            {jobs.map((job) => (
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

function SummaryCard({ label, job }: { label: string; job: ExportJob | null }) {
  if (!job) {
    return (
      <div className="stat-card">
        <div className="stat-card__label">{label}</div>
        <div style={{ color: 'var(--cms-text-light)', fontSize: '0.85rem' }}>Ninguno</div>
      </div>
    );
  }
  return (
    <div className="stat-card">
      <div className="stat-card__label">{label}</div>
      <div style={{ fontSize: '0.85rem' }}>
        <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{job.tipo}</span>
        {' — '}
        {job.registros_ok} registros
        {job.registros_err > 0 && <span style={{ color: '#e74c3c' }}> ({job.registros_err} err)</span>}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--cms-text-light)', marginTop: '0.25rem' }}>
        {formatDate(job.created_at)}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
