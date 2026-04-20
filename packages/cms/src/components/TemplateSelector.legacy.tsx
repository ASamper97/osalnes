import { useState } from 'react';
import { RESOURCE_TEMPLATES, type ResourceTemplate } from '@/data/resource-templates';
import { aiImportFromUrl, type ImportedResource } from '@/lib/ai';

/**
 * TemplateSelector — Selector de plantillas para crear recursos
 *
 * Se muestra al inicio del flujo "Nuevo recurso" y permite:
 * 1. Elegir una plantilla pre-configurada por tipologia
 * 2. Importar datos desde una URL externa con IA
 * 3. Empezar en blanco
 */

interface TemplateSelectorProps {
  onSelect: (template: ResourceTemplate, imported?: ImportedResource) => void;
  onCancel: () => void;
}

export function TemplateSelector({ onSelect, onCancel }: TemplateSelectorProps) {
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  async function handleImport() {
    if (!importUrl.trim()) return;
    setImporting(true);
    setImportError(null);
    try {
      const imported = await aiImportFromUrl(importUrl);
      // Match imported type to a template (or fallback to blank)
      const matchedTemplate = RESOURCE_TEMPLATES.find(
        (t) => t.rdfType.toLowerCase() === (imported.rdf_type || '').toLowerCase()
      ) || RESOURCE_TEMPLATES.find((t) => t.id === 'blank')!;
      onSelect(matchedTemplate, imported);
    } catch (err: any) {
      setImportError(err.message || 'Error al importar la URL');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="template-selector">
      <div className="template-selector__header">
        <div>
          <h1 className="template-selector__title">¿Como quieres empezar?</h1>
          <p className="template-selector__subtitle">
            Elige una plantilla con campos pre-configurados, importa los datos desde una web o empieza desde cero
          </p>
        </div>
        <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
      </div>

      {/* Import from URL — feature destacada */}
      {!showImport ? (
        <button
          type="button"
          className="template-selector__import-btn"
          onClick={() => setShowImport(true)}
        >
          <span className="template-selector__import-icon">✨</span>
          <div className="template-selector__import-text">
            <strong>Importar desde una URL con IA</strong>
            <span>Pega la web de tu negocio o un perfil de TripAdvisor y la IA rellenara los campos automaticamente</span>
          </div>
          <span className="template-selector__import-arrow">→</span>
        </button>
      ) : (
        <div className="template-selector__import-panel">
          <div className="template-selector__import-panel-header">
            <strong>✨ Importar desde URL</strong>
            <button type="button" className="btn btn-sm" onClick={() => { setShowImport(false); setImportError(null); }}>Cerrar</button>
          </div>
          <p className="template-selector__import-hint">
            Pega aqui la URL del recurso. La IA extraera nombre, descripcion, contacto, direccion y mas.
          </p>
          <div className="template-selector__import-form">
            <input
              type="url"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              placeholder="https://ejemplo.gal/mi-hotel"
              disabled={importing}
              autoFocus
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleImport}
              disabled={!importUrl.trim() || importing}
            >
              {importing ? 'Importando...' : 'Importar'}
            </button>
          </div>
          {importError && <div className="alert alert-error" style={{ marginTop: '0.75rem' }}>{importError}</div>}
        </div>
      )}

      <div className="template-selector__divider">
        <span>O elige una plantilla</span>
      </div>

      {/* Template grid */}
      <div className="template-selector__grid">
        {RESOURCE_TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            className={`template-card template-card--${tpl.id}`}
            onClick={() => onSelect(tpl)}
          >
            <div className="template-card__icon">{tpl.icon}</div>
            <h3 className="template-card__name">{tpl.name}</h3>
            <p className="template-card__desc">{tpl.description}</p>
            <div className="template-card__highlights">
              {tpl.highlights.map((h, i) => (
                <span key={i} className="template-card__highlight">{h}</span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
