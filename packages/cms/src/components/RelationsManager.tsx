import { useEffect, useState } from 'react';
import { api, type ResourceSummary } from '@/lib/api';
import { useConfirm } from './ConfirmDialog';

/** UNE 178503 — relation types between tourist resources */
export const RELATION_TYPES = [
  { value: 'cerca_de', label: 'Cerca de' },
  { value: 'pertenece_a', label: 'Pertenece a' },
  { value: 'complementa', label: 'Complementa' },
  { value: 'alternativa', label: 'Alternativa a' },
  { value: 'incluye', label: 'Incluye' },
  { value: 'recomendado_con', label: 'Recomendado con' },
] as const;

interface Relation {
  id: string;
  recursoOrigen: string;
  recursoDestino: string;
  tipoRelacion: string;
  orden: number;
  relatedResourceName: Record<string, string>;
}

interface RelationsManagerProps {
  recursoId: string;
}

export function RelationsManager({ recursoId }: RelationsManagerProps) {
  const confirm = useConfirm();
  const [relations, setRelations] = useState<Relation[]>([]);
  const [allResources, setAllResources] = useState<ResourceSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // New relation form
  const [targetId, setTargetId] = useState('');
  const [tipoRelacion, setTipoRelacion] = useState('cerca_de');
  const [saving, setSaving] = useState(false);

  async function loadRelations() {
    try {
      const data = await api.getRelations(recursoId);
      setRelations(data);
    } catch {
      // silently fail
    }
  }

  useEffect(() => {
    if (recursoId) loadRelations();
  }, [recursoId]);

  async function loadResources() {
    if (allResources.length > 0) return;
    try {
      const result = await api.getResources({ limit: '500' });
      setAllResources(result.items.filter((r) => r.id !== recursoId));
    } catch {
      // silently fail
    }
  }

  function startAdd() {
    setAdding(true);
    loadResources();
  }

  async function handleAdd() {
    if (!targetId) return;
    setSaving(true);
    setError(null);

    try {
      await api.createRelation({
        recurso_origen: recursoId,
        recurso_destino: targetId,
        tipo_relacion: tipoRelacion,
      });
      setAdding(false);
      setTargetId('');
      await loadRelations();
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(relationId: string) {
    const ok = await confirm({
      title: 'Eliminar esta relacion?',
      message: 'La relacion entre los dos recursos se eliminara. Los recursos en si no se ven afectados.',
      confirmLabel: 'Eliminar',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await api.deleteRelation(relationId);
      await loadRelations();
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  }

  const relatedIds = new Set(relations.map((r) =>
    r.recursoOrigen === recursoId ? r.recursoDestino : r.recursoOrigen,
  ));
  const availableResources = allResources.filter((r) => !relatedIds.has(r.id));

  return (
    <fieldset>
      <legend>Relaciones con otros recursos</legend>

      {error && <div className="alert alert-error">{error}</div>}

      {relations.length > 0 && (
        <table className="data-table" style={{ marginTop: '0.5rem' }}>
          <thead>
            <tr>
              <th>Recurso relacionado</th>
              <th>Tipo de relacion</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {relations.map((r) => (
              <tr key={r.id}>
                <td>{r.relatedResourceName?.es || r.relatedResourceName?.gl || '(sin nombre)'}</td>
                <td>{RELATION_TYPES.find((t) => t.value === r.tipoRelacion)?.label || r.tipoRelacion}</td>
                <td>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r.id)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {relations.length === 0 && !adding && (
        <p style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.5rem' }}>Sin relaciones</p>
      )}

      {adding ? (
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-field" style={{ flex: '1', minWidth: '200px' }}>
            <label>Recurso destino</label>
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">-- Seleccionar --</option>
              {availableResources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name?.es || r.name?.gl || r.slug}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ minWidth: '150px' }}>
            <label>Tipo</label>
            <select value={tipoRelacion} onChange={(e) => setTipoRelacion(e.target.value)}>
              {RELATION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="action-btns">
            <button className="btn btn-sm btn-primary" onClick={handleAdd} disabled={saving || !targetId}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button className="btn btn-sm" onClick={() => setAdding(false)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-sm" style={{ marginTop: '0.5rem' }} onClick={startAdd}>
          + Anadir relacion
        </button>
      )}
    </fieldset>
  );
}
