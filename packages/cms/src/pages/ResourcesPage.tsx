import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';

const STATUS_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  revision: 'Revision',
  publicado: 'Publicado',
  archivado: 'Archivado',
};

const STATUS_COLORS: Record<string, string> = {
  borrador: '#f39c12',
  revision: '#3498db',
  publicado: '#27ae60',
  archivado: '#95a5a6',
};

// Transiciones permitidas (BRI-6.1)
const STATE_TRANSITIONS: Record<string, { target: string; label: string; style?: string }[]> = {
  borrador:  [{ target: 'revision', label: 'Enviar a revision' }, { target: 'archivado', label: 'Archivar', style: 'btn-danger' }],
  revision:  [{ target: 'publicado', label: 'Publicar', style: 'btn-primary' }, { target: 'borrador', label: 'Devolver a borrador' }],
  publicado: [{ target: 'archivado', label: 'Archivar' }, { target: 'borrador', label: 'Despublicar' }],
  archivado: [{ target: 'borrador', label: 'Reactivar' }],
};

export function ResourcesPage() {
  const navigate = useNavigate();
  const [resources, setResources] = useState<any | null>(null);
  const [typologies, setTypologies] = useState<any[]>([]);
  const [municipalities, setMunicipalities] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);

  function loadResources() {
    const params: Record<string, string> = { page: String(page), limit: '20' };
    if (filterType) params.type = filterType;
    if (filterStatus) params.status = filterStatus;

    api.getResources(params)
      .then(setResources)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    loadResources();
  }, [page, filterType, filterStatus]);

  useEffect(() => {
    api.getTypologies().then(setTypologies).catch(() => {});
    api.getMunicipalities().then(setMunicipalities).catch(() => {});
  }, []);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Eliminar "${name}"?`)) return;
    try {
      await api.deleteResource(id);
      loadResources();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleStatusChange(id: string, newStatus: string) {
    try {
      await api.updateResourceStatus(id, newStatus);
      loadResources();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Recursos turisticos</h1>
        <button className="btn btn-primary" onClick={() => navigate('/resources/new')}>
          + Nuevo recurso
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Filters */}
      <div className="filters-bar">
        <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }}>
          <option value="">Todas las tipologias</option>
          {typologies.map((t) => (
            <option key={t.typeCode} value={t.typeCode}>
              {t.name?.es || t.typeCode} ({t.grupo})
            </option>
          ))}
        </select>

        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
          <option value="">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="revision">Revision</option>
          <option value="publicado">Publicado</option>
          <option value="archivado">Archivado</option>
        </select>
      </div>

      {!resources && !error && <p>Cargando...</p>}

      {resources && (
        <>
          <p className="results-count">
            {resources.total} recursos encontrados (pagina {resources.page} de {resources.pages})
          </p>

          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipologia</th>
                <th>Estado</th>
                <th>Actualizado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {resources.items.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>Sin recursos</td></tr>
              )}
              {resources.items.map((r: any) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.name?.es || r.name?.gl || r.slug}</strong>
                    <br />
                    <span style={{ fontSize: '0.75rem', color: '#999' }}>{r.slug}</span>
                  </td>
                  <td>{r.rdfType}</td>
                  <td>
                    <span
                      className="status-badge"
                      style={{ background: STATUS_COLORS[r.status] || '#999' }}
                    >
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>
                    {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('es') : '-'}
                  </td>
                  <td>
                    <div className="action-btns">
                      <button className="btn btn-sm" onClick={() => navigate(`/resources/${r.id}`)}>
                        Editar
                      </button>
                      {(STATE_TRANSITIONS[r.status] || []).map((t) => (
                        <button
                          key={t.target}
                          className={`btn btn-sm ${t.style || 'btn-outline'}`}
                          onClick={() => handleStatusChange(r.id, t.target)}
                        >
                          {t.label}
                        </button>
                      ))}
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r.id, r.name?.es || r.slug)}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {resources.pages > 1 && (
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
              <span>Pagina {page} de {resources.pages}</span>
              <button disabled={page >= resources.pages} onClick={() => setPage(page + 1)}>Siguiente</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
