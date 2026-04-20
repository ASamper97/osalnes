import { useState } from 'react';
import { aiImportFromUrl, type ImportedResource } from '@/lib/ai';

/**
 * ImportFromUrlModal — flujo "Importar desde URL con IA" extraído del
 * TemplateSelector.legacy.tsx (paso 0 · tarea 3).
 *
 * El picker nuevo (TemplatePicker) delega este flujo al padre vía
 * onImportFromUrl(). El padre monta este modal condicionalmente y, cuando
 * el import termina, recibe los datos por onImported(resource) para
 * aplicarlos al state del wizard (nombre, descripción, contacto, etc.).
 */

export interface ImportFromUrlModalProps {
  onImported: (resource: ImportedResource) => void;
  onCancel: () => void;
}

export function ImportFromUrlModal({ onImported, onCancel }: ImportFromUrlModalProps) {
  const [url, setUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    if (!url.trim()) return;
    setImporting(true);
    setError(null);
    try {
      const imported = await aiImportFromUrl(url);
      onImported(imported);
    } catch (err) {
      setError((err as Error).message || 'Error al importar la URL');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-url-title"
    >
      <div className="modal-dialog modal-dialog--import">
        <div className="modal-dialog__header">
          <h2 id="import-url-title">✨ Importar desde una URL con IA</h2>
          <button type="button" className="btn btn-sm" onClick={onCancel} disabled={importing}>
            Cerrar
          </button>
        </div>
        <p className="modal-dialog__body">
          Pega aquí la URL del recurso (web propia, TripAdvisor, Google Maps, etc.).
          La IA extraerá nombre, descripción, contacto, dirección y más.
        </p>
        <div className="modal-dialog__form">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://ejemplo.gal/mi-hotel"
            disabled={importing}
            autoFocus
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleImport}
            disabled={!url.trim() || importing}
          >
            {importing ? 'Importando…' : 'Importar'}
          </button>
        </div>
        {error && (
          <div className="alert alert-error" style={{ marginTop: '0.75rem' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
