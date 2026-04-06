import { useState } from 'react';
import { aiValidate, aiCategorize, type ValidationResult, type CategorizationResult } from '@/lib/ai';

/**
 * AiQualityScore — Evaluacion de calidad con IA para el paso de revision
 */

interface AiQualityScoreProps {
  /** All resource data for evaluation */
  resourceData: Record<string, unknown>;
  /** Callback to apply suggested tourist types */
  onApplyTouristTypes?: (types: string[]) => void;
}

const LEVEL_COLORS: Record<string, string> = {
  excelente: '#27ae60',
  bueno: '#2ecc71',
  mejorable: '#f39c12',
  incompleto: '#e74c3c',
};

const LEVEL_ICONS: Record<string, string> = {
  excelente: '🏆',
  bueno: '✅',
  mejorable: '⚠️',
  incompleto: '❌',
};

export function AiQualityScore({ resourceData, onApplyTouristTypes }: AiQualityScoreProps) {
  const [loading, setLoading] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [categorization, setCategorization] = useState<CategorizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleEvaluate() {
    setLoading(true);
    setError(null);
    try {
      const [valResult, catResult] = await Promise.all([
        aiValidate(resourceData),
        aiCategorize({
          name: (resourceData.nameEs as string) || '',
          description: (resourceData.descEs as string) || '',
          type: (resourceData.rdfType as string) || '',
        }),
      ]);
      setValidation(valResult);
      setCategorization(catResult);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ai-quality">
      {!validation && (
        <div className="ai-quality__trigger">
          <button
            type="button"
            className="ai-writer__btn ai-quality__btn"
            onClick={handleEvaluate}
            disabled={loading}
          >
            {loading ? 'Evaluando con IA...' : '🔍 Evaluar calidad con IA'}
          </button>
          <p className="ai-quality__hint">
            La IA analiza la completitud, calidad del contenido y preparacion SEO del recurso
          </p>
        </div>
      )}

      {error && <div className="ai-writer__error">{error}</div>}

      {validation && (
        <div className="ai-quality__report">
          {/* Score circle */}
          <div className="ai-quality__score-section">
            <div
              className="ai-quality__score-circle"
              style={{ borderColor: LEVEL_COLORS[validation.level] || '#999' }}
            >
              <span className="ai-quality__score-number">{validation.score}</span>
              <span className="ai-quality__score-max">/100</span>
            </div>
            <div className="ai-quality__score-meta">
              <span className="ai-quality__score-level" style={{ color: LEVEL_COLORS[validation.level] }}>
                {LEVEL_ICONS[validation.level]} {validation.level.charAt(0).toUpperCase() + validation.level.slice(1)}
              </span>
              <span className="ai-quality__score-seo">
                SEO: {validation.seo_ready ? '✅ Preparado' : '⚠️ Mejorable'}
              </span>
              <span className="ai-quality__score-trad">
                Traducciones: {validation.translation_quality}
              </span>
            </div>
          </div>

          {/* Issues */}
          {validation.issues.length > 0 && (
            <div className="ai-quality__section">
              <h4 className="ai-quality__section-title">⚠️ Problemas detectados</h4>
              <ul className="ai-quality__list ai-quality__list--issues">
                {validation.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggestions */}
          {validation.suggestions.length > 0 && (
            <div className="ai-quality__section">
              <h4 className="ai-quality__section-title">💡 Sugerencias de mejora</h4>
              <ul className="ai-quality__list ai-quality__list--suggestions">
                {validation.suggestions.map((sug, i) => (
                  <li key={i}>{sug}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Missing fields */}
          {validation.missing_fields.length > 0 && (
            <div className="ai-quality__section">
              <h4 className="ai-quality__section-title">📋 Campos recomendados</h4>
              <ul className="ai-quality__list ai-quality__list--missing">
                {validation.missing_fields.map((field, i) => (
                  <li key={i}>{field}</li>
                ))}
              </ul>
            </div>
          )}

          {/* AI Category suggestions */}
          {categorization && categorization.tourist_types.length > 0 && (
            <div className="ai-quality__section">
              <h4 className="ai-quality__section-title">🏷️ Tipos de turismo sugeridos por IA</h4>
              <p className="ai-quality__reasoning">{categorization.reasoning}</p>
              <div className="ai-quality__tags">
                {categorization.tourist_types.map((t) => (
                  <span key={t} className="ai-quality__tag">{t.replace(' TOURISM', '').toLowerCase()}</span>
                ))}
              </div>
              {onApplyTouristTypes && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  style={{ marginTop: '0.5rem' }}
                  onClick={() => onApplyTouristTypes(categorization.tourist_types)}
                >
                  Aplicar tipos sugeridos
                </button>
              )}
            </div>
          )}

          <button type="button" className="btn btn-sm" onClick={() => { setValidation(null); setCategorization(null); }} style={{ marginTop: '0.75rem' }}>
            Cerrar evaluacion
          </button>
        </div>
      )}
    </div>
  );
}
