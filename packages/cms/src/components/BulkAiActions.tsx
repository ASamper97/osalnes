import { useState } from 'react';
import { aiBatch, BATCH_MAX_SIZE, type BatchAction, type BatchResponse } from '@/lib/ai';
import { useNotifications } from '@/lib/notifications';

/**
 * BulkAiActions — Modal con acciones de IA en lote
 *
 * Permite ejecutar acciones (traducir, mejorar, SEO, validar, categorizar)
 * sobre multiples recursos a la vez. Procesa en chunks de BATCH_MAX_SIZE.
 */

interface BulkAiActionsProps {
  selectedIds: string[];
  onClose: () => void;
  /** Called after a successful batch so the parent can refresh the list */
  onComplete?: () => void;
}

interface ActionDef {
  id: BatchAction;
  icon: string;
  name: string;
  description: string;
  needsLang?: boolean;
}

const ACTIONS: ActionDef[] = [
  {
    id: 'translate',
    icon: '🌐',
    name: 'Traducir a un idioma',
    description: 'Traduce nombre y descripcion al idioma elegido. Salta los recursos que ya estan traducidos.',
    needsLang: true,
  },
  {
    id: 'improve',
    icon: '✨',
    name: 'Mejorar descripcion (ES)',
    description: 'Reescribe la descripcion en castellano haciendola mas atractiva y profesional.',
  },
  {
    id: 'seo',
    icon: '🎯',
    name: 'Generar SEO (ES + GL)',
    description: 'Crea titulo y descripcion SEO optimizados en ambos idiomas.',
  },
  {
    id: 'validate',
    icon: '🔍',
    name: 'Evaluar calidad',
    description: 'Puntua de 0 a 100 cada recurso y muestra problemas/sugerencias.',
  },
  {
    id: 'categorize',
    icon: '🏷️',
    name: 'Auto-categorizar',
    description: 'La IA sugiere y aplica tipos de turismo UNE 178503 a cada recurso.',
  },
];

const LANG_OPTIONS = [
  { value: 'gl', label: 'Gallego' },
  { value: 'en', label: 'Ingles' },
  { value: 'fr', label: 'Frances' },
  { value: 'pt', label: 'Portugues' },
];

type Phase = 'select' | 'running' | 'done';

export function BulkAiActions({ selectedIds, onClose, onComplete }: BulkAiActionsProps) {
  const { notify } = useNotifications();
  const [phase, setPhase] = useState<Phase>('select');
  const [action, setAction] = useState<BatchAction | null>(null);
  const [targetLang, setTargetLang] = useState('gl');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<BatchResponse[]>([]);
  const [error, setError] = useState<string | null>(null);

  const totalCount = selectedIds.length;
  const chunkCount = Math.ceil(totalCount / BATCH_MAX_SIZE);

  async function handleRun() {
    if (!action) return;
    setPhase('running');
    setError(null);
    setResults([]);
    setProgress({ current: 0, total: totalCount });

    // Split into chunks of BATCH_MAX_SIZE
    const chunks: string[][] = [];
    for (let i = 0; i < selectedIds.length; i += BATCH_MAX_SIZE) {
      chunks.push(selectedIds.slice(i, i + BATCH_MAX_SIZE));
    }

    const allResults: BatchResponse[] = [];
    let processedCount = 0;

    try {
      for (const chunk of chunks) {
        const response = await aiBatch(action, chunk, action === 'translate' ? { target_lang: targetLang } : undefined);
        allResults.push(response);
        processedCount += response.processed;
        setProgress({ current: processedCount, total: totalCount });
        setResults([...allResults]);
      }
      setPhase('done');
      // Aggregated stats for notification
      const completed = allResults.reduce((acc, r) => acc + r.completed, 0);
      const errors = allResults.reduce((acc, r) => acc + r.errors, 0);
      notify({
        type: errors > 0 ? 'warning' : 'success',
        title: 'Operacion IA en lote completada',
        message: `${completed} recursos completados${errors > 0 ? `, ${errors} con errores` : ''}.`,
      });
    } catch (err: any) {
      setError(err.message || 'Error al procesar el lote');
      setPhase('done');
      notify({
        type: 'error',
        title: 'Error en operacion IA',
        message: err.message || 'Error al procesar el lote',
      });
    }
  }

  function handleClose() {
    if (phase === 'done') {
      onComplete?.();
    }
    onClose();
  }

  // Aggregated stats
  const totals = results.reduce(
    (acc, r) => ({
      completed: acc.completed + r.completed,
      errors: acc.errors + r.errors,
      skipped: acc.skipped + r.skipped,
    }),
    { completed: 0, errors: 0, skipped: 0 },
  );

  const allItems = results.flatMap((r) => r.results);

  return (
    <>
      <div className="bulk-ai__backdrop" onClick={phase === 'running' ? undefined : handleClose} role="presentation" />
      <div className="bulk-ai__modal" role="dialog" aria-label="Acciones IA en lote">
        <header className="bulk-ai__header">
          <div>
            <span className="bulk-ai__label">Acciones IA en lote</span>
            <h2>{totalCount} recursos seleccionados</h2>
          </div>
          {phase !== 'running' && (
            <button type="button" className="bulk-ai__close" onClick={handleClose} aria-label="Cerrar">✕</button>
          )}
        </header>

        <div className="bulk-ai__body">
          {/* PHASE 1 — Select action */}
          {phase === 'select' && (
            <>
              <p className="bulk-ai__hint">
                Elige que quieres hacer con los recursos seleccionados. La IA procesara hasta {BATCH_MAX_SIZE} recursos por lote.
                {chunkCount > 1 && ` Se ejecutaran ${chunkCount} lotes secuenciales.`}
              </p>

              <div className="bulk-ai__actions">
                {ACTIONS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`bulk-ai__action ${action === a.id ? 'bulk-ai__action--active' : ''}`}
                    onClick={() => setAction(a.id)}
                  >
                    <span className="bulk-ai__action-icon">{a.icon}</span>
                    <div>
                      <strong>{a.name}</strong>
                      <p>{a.description}</p>
                    </div>
                  </button>
                ))}
              </div>

              {action === 'translate' && (
                <div className="bulk-ai__lang">
                  <label>Idioma destino</label>
                  <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
                    {LANG_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              )}

              <div className="bulk-ai__footer">
                <button type="button" className="btn" onClick={handleClose}>Cancelar</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleRun}
                  disabled={!action}
                >
                  Ejecutar en {totalCount} recursos
                </button>
              </div>
            </>
          )}

          {/* PHASE 2 — Running */}
          {phase === 'running' && (
            <div className="bulk-ai__running">
              <div className="bulk-ai__spinner">⚙️</div>
              <h3>Procesando con IA...</h3>
              <p>{progress.current} de {progress.total} recursos completados</p>
              <div className="wizard__progress-bar" style={{ maxWidth: '420px', margin: '1rem auto' }}>
                <div
                  className="wizard__progress-fill"
                  style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="bulk-ai__running-hint">No cierres esta ventana. Esto puede tardar unos segundos por cada recurso.</p>
            </div>
          )}

          {/* PHASE 3 — Done */}
          {phase === 'done' && (
            <div className="bulk-ai__done">
              {error && <div className="alert alert-error" style={{ marginBottom: '0.85rem' }}>{error}</div>}

              <div className="bulk-ai__summary">
                <div className="bulk-ai__summary-card bulk-ai__summary-card--ok">
                  <strong>{totals.completed}</strong>
                  <span>Completados</span>
                </div>
                <div className="bulk-ai__summary-card bulk-ai__summary-card--skip">
                  <strong>{totals.skipped}</strong>
                  <span>Saltados</span>
                </div>
                <div className="bulk-ai__summary-card bulk-ai__summary-card--err">
                  <strong>{totals.errors}</strong>
                  <span>Errores</span>
                </div>
              </div>

              <h3 className="bulk-ai__results-title">Detalle por recurso</h3>
              <ul className="bulk-ai__results-list">
                {allItems.map((item) => (
                  <li key={item.id} className={`bulk-ai__result bulk-ai__result--${item.status}`}>
                    <span className="bulk-ai__result-icon">
                      {item.status === 'ok' && '✓'}
                      {item.status === 'skipped' && '⊘'}
                      {item.status === 'error' && '✕'}
                    </span>
                    <span className="bulk-ai__result-slug">{item.slug}</span>
                    <span className="bulk-ai__result-msg">{item.message || ''}</span>
                  </li>
                ))}
              </ul>

              <div className="bulk-ai__footer">
                <button type="button" className="btn btn-primary" onClick={handleClose}>
                  Cerrar y refrescar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
