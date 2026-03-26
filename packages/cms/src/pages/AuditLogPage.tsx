import { useEffect, useState } from 'react';
import { api, type PaginatedResult, type AuditLogEntry } from '@/lib/api';

const ACCION_LABELS: Record<string, string> = {
  crear: 'Creado',
  modificar: 'Modificado',
  eliminar: 'Eliminado',
  publicar: 'Publicado',
  archivar: 'Archivado',
};

const ACCION_COLORS: Record<string, string> = {
  crear: 'var(--status-publicado)',
  modificar: 'var(--status-revision)',
  eliminar: '#e74c3c',
  publicar: 'var(--status-publicado)',
  archivar: 'var(--status-archivado)',
};

const ENTIDAD_LABELS: Record<string, string> = {
  recurso_turistico: 'Recurso',
  categoria: 'Categoria',
  pagina: 'Pagina',
  navegacion: 'Navegacion',
  producto_turistico: 'Producto',
  usuario: 'Usuario',
};

export function AuditLogPage() {
  const [data, setData] = useState<PaginatedResult<AuditLogEntry> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filterTipo, setFilterTipo] = useState('');

  async function load() {
    setLoading(true);
    try {
      const result = await api.getAuditLog({
        page,
        ...(filterTipo && { entidad_tipo: filterTipo }),
      });
      setData(result);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page, filterTipo]);

  return (
    <div>
      <h1>Registro de actividad</h1>
      <p style={{ color: 'var(--cms-text-light)', marginBottom: '1.5rem' }}>
        Trazabilidad de cambios — UNE 178502 sec. 6.4
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ marginBottom: '1rem' }}>
        <select value={filterTipo} onChange={(e) => { setFilterTipo(e.target.value); setPage(1); }}>
          <option value="">Todas las entidades</option>
          <option value="recurso_turistico">Recursos</option>
          <option value="categoria">Categorias</option>
          <option value="pagina">Paginas</option>
          <option value="navegacion">Navegacion</option>
          <option value="producto_turistico">Productos</option>
          <option value="usuario">Usuarios</option>
        </select>
      </div>

      {loading && <p style={{ color: 'var(--cms-text-light)' }}>Cargando...</p>}

      {data && (
        <>
          <p style={{ fontSize: '0.8rem', color: 'var(--cms-text-light)', marginBottom: '0.75rem' }}>
            {data.total} registros en total
          </p>

          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Accion</th>
                <th>Entidad</th>
                <th>ID</th>
                <th>Detalles</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>Sin registros de actividad</td></tr>
              )}
              {data.items.map((entry) => (
                <tr key={entry.id}>
                  <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    {new Date(entry.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>
                    <span
                      className="status-badge"
                      style={{ background: ACCION_COLORS[entry.accion] || '#999' }}
                    >
                      {ACCION_LABELS[entry.accion] || entry.accion}
                    </span>
                  </td>
                  <td>{ENTIDAD_LABELS[entry.entidad_tipo] || entry.entidad_tipo}</td>
                  <td>
                    <code style={{ fontSize: '0.72rem', color: 'var(--cms-text-light)' }}>
                      {entry.entidad_id?.slice(0, 8)}...
                    </code>
                  </td>
                  <td style={{ fontSize: '0.78rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {entry.cambios ? JSON.stringify(entry.cambios).slice(0, 100) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data.pages > 1 && (
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
              <span>Pagina {page} de {data.pages}</span>
              <button disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Siguiente</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
