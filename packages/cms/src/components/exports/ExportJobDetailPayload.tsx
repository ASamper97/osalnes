/**
 * ExportJobDetailPayload — tab "Payload" del drawer
 *
 * Selector de recurso + viewer JSON. Lazy fetch del payload al
 * seleccionar (para no cargar 100 JSONs pesados de golpe).
 */

import { useEffect, useState } from 'react';
import type { ExportJobRecord } from '@osalnes/shared/data/exports-detail';
import { EXPORTS_DETAIL_COPY } from '../../pages/exports-detail.copy';

const COPY = EXPORTS_DETAIL_COPY.payload;

export interface ExportJobDetailPayloadProps {
  records: ExportJobRecord[];
  onGetPayload: (recordId: string) => Promise<unknown>;
}

export default function ExportJobDetailPayload({
  records,
  onGetPayload,
}: ExportJobDetailPayloadProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    records.length > 0 ? records[0].id : null,
  );
  const [payload, setPayload] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!selectedId) {
      setPayload(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const p = await onGetPayload(selectedId);
        if (!cancelled) setPayload(p);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error cargando payload');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId, onGetPayload]);

  const handleCopy = async () => {
    if (payload == null) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  if (records.length === 0) {
    return (
      <div className="drawer-payload-empty">
        <strong>{COPY.emptyTitle}</strong>
        <p className="muted">{COPY.emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="drawer-payload">
      <div className="drawer-payload-selector">
        <label>
          <span className="muted">Recurso:</span>
          <select
            value={selectedId ?? ''}
            onChange={(e) => setSelectedId(e.target.value || null)}
          >
            {records.map((r) => (
              <option key={r.id} value={r.id}>
                {r.resourceName ?? r.resourceSlug ?? '(sin nombre)'}
              </option>
            ))}
          </select>
        </label>

        {payload != null && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void handleCopy()}
          >
            {copied ? COPY.copiedLabel : '📋 ' + COPY.copyButton}
          </button>
        )}
      </div>

      {loading && <div className="drawer-payload-loading muted">Cargando…</div>}
      {error && <div className="drawer-payload-error" role="alert">⚠️ {error}</div>}

      {!loading && !error && payload != null && (
        <pre className="drawer-payload-code">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </div>
  );
}
