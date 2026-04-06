import { useState } from 'react';
import { aiGenerateSeo, type SeoResult } from '@/lib/ai';

/**
 * AiSeoGenerator — Genera titulo y descripcion SEO con IA
 */

interface AiSeoGeneratorProps {
  name: string;
  description: string;
  type: string;
  municipality: string;
  onApply: (seo: SeoResult) => void;
}

export function AiSeoGenerator({ name, description, type, municipality, onApply }: AiSeoGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SeoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!name.trim() && !description.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const seo = await aiGenerateSeo({ name, description, type, municipality });
      setResult(seo);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleApply() {
    if (result) {
      onApply(result);
      setResult(null);
    }
  }

  const canGenerate = name.trim() || description.trim();

  return (
    <div className="ai-seo">
      <div className="ai-seo__trigger">
        <button
          type="button"
          className="ai-writer__btn ai-seo__btn"
          onClick={handleGenerate}
          disabled={!canGenerate || loading}
        >
          {loading ? 'Generando SEO...' : '🎯 Generar SEO con IA'}
        </button>
        <span className="ai-seo__hint">
          Genera titulo y descripcion optimizados para buscadores a partir del contenido del recurso
        </span>
      </div>

      {error && <div className="ai-writer__error">{error}</div>}

      {result && (
        <div className="ai-seo__preview">
          <div className="ai-seo__preview-header">
            <span className="ai-writer__result-badge">🎯 SEO generado por IA</span>
          </div>

          {/* Google preview ES */}
          <div className="ai-seo__google-preview">
            <span className="ai-seo__google-label">Vista previa Google (ES)</span>
            <div className="ai-seo__google-title">{result.title_es}</div>
            <div className="ai-seo__google-url">osalnes.gal/es/recurso/...</div>
            <div className="ai-seo__google-desc">{result.desc_es}</div>
          </div>

          {/* Google preview GL */}
          <div className="ai-seo__google-preview">
            <span className="ai-seo__google-label">Vista previa Google (GL)</span>
            <div className="ai-seo__google-title">{result.title_gl}</div>
            <div className="ai-seo__google-url">osalnes.gal/gl/recurso/...</div>
            <div className="ai-seo__google-desc">{result.desc_gl}</div>
          </div>

          <div className="ai-seo__preview-stats">
            <span>ES: titulo {result.title_es.length}/60 chars — desc {result.desc_es.length}/160 chars</span>
            <span>GL: titulo {result.title_gl.length}/60 chars — desc {result.desc_gl.length}/160 chars</span>
          </div>

          <div className="ai-writer__result-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={handleApply}>
              Aplicar SEO
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setResult(null)}>
              Descartar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
