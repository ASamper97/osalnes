/**
 * ImprovementSuggestions — sugerencias concretas IA por paso
 *
 * Decisión 1-C (paso 7b): la IA lee el recurso entero y devuelve
 * sugerencias accionables por paso. A diferencia del motor local
 * de calidad (que dice "descripción corta, 12 palabras"), la IA
 * da sugerencias de CONTENIDO ("añade cómo llegar, menciona si hay
 * aparcamiento cercano, el horario de invierno no está claro").
 *
 * Botón "Pedir sugerencias a la IA" activo solo si hay descripción
 * suficiente para analizar. Resultado: lista de chips por paso con
 * link "Editar" que salta al paso afectado.
 */

import { useState } from 'react';
import type { QualityStep } from '@osalnes/shared/data/quality-engine';

export interface ImprovementSuggestion {
  /** Paso al que aplica la sugerencia */
  stepRef: QualityStep;
  /** Frase corta y accionable: "Añade horario de invierno" */
  text: string;
  /** Importancia: high/medium/low para ordenar */
  priority: 'high' | 'medium' | 'low';
}

export interface ImprovementSuggestionsProps {
  /** Callback que llama al Edge Function ai-writer.suggestImprovements */
  onRequestSuggestions: () => Promise<ImprovementSuggestion[]>;
  /** Saltar a un paso concreto (reutiliza el handler del componente padre) */
  onGoToStep: (step: QualityStep) => void;
  /** ¿Hay descripción en el paso 2? Si no, el botón queda disabled */
  hasEnoughContent: boolean;
}

const STEP_LABELS: Record<QualityStep, string> = {
  identification: 'Identificación',
  content: 'Contenido',
  location: 'Ubicación',
  classification: 'Clasificación',
  multimedia: 'Multimedia',
  seo: 'SEO',
};

export default function ImprovementSuggestions({
  onRequestSuggestions,
  onGoToStep,
  hasEnoughContent,
}: ImprovementSuggestionsProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ImprovementSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  const handleRequest = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await onRequestSuggestions();
      setSuggestions(sortByPriority(result));
      setRequested(true);
    } catch {
      setError('No se han podido generar sugerencias. Inténtalo más tarde.');
    } finally {
      setLoading(false);
    }
  };

  // Agrupar por paso
  const grouped = groupByStep(suggestions);

  return (
    <section className="improvement-suggestions">
      <header>
        <div>
          <h4>Sugerencias de la IA para este recurso</h4>
          <p className="muted">
            La IA lee el recurso completo y propone mejoras concretas y accionables por paso.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-ai-primary"
          onClick={handleRequest}
          disabled={loading || !hasEnoughContent}
          title={!hasEnoughContent ? 'Añade primero una descripción en el paso 2' : undefined}
        >
          {loading ? '✨ Analizando…' : requested ? '✨ Volver a pedir' : '✨ Pedir sugerencias'}
        </button>
      </header>

      {!hasEnoughContent && (
        <p className="improvement-empty muted">
          Añade una descripción en el paso 2 para que la IA pueda analizar el recurso.
        </p>
      )}

      {error && (
        <p role="alert" className="improvement-error">
          ⚠️ {error}
        </p>
      )}

      {requested && suggestions.length === 0 && !loading && !error && (
        <p className="improvement-empty muted">
          La IA no ha encontrado mejoras que sugerir. El recurso parece bastante completo.
        </p>
      )}

      {suggestions.length > 0 && (
        <div className="improvement-groups">
          {Object.entries(grouped).map(([step, items]) => (
            <div key={step} className="improvement-group">
              <div className="improvement-group-head">
                <strong>{STEP_LABELS[step as QualityStep]}</strong>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => onGoToStep(step as QualityStep)}
                >
                  Ir al paso
                </button>
              </div>
              <ul className="improvement-list" role="list">
                {items.map((sug, i) => (
                  <li
                    key={`${step}-${i}`}
                    className={`improvement-item improvement-item-${sug.priority}`}
                  >
                    <span className="improvement-item-marker" aria-hidden>
                      {sug.priority === 'high' ? '!' : '•'}
                    </span>
                    <span>{sug.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function sortByPriority(list: ImprovementSuggestion[]): ImprovementSuggestion[] {
  const order = { high: 0, medium: 1, low: 2 };
  return [...list].sort((a, b) => order[a.priority] - order[b.priority]);
}

function groupByStep(list: ImprovementSuggestion[]): Record<string, ImprovementSuggestion[]> {
  const out: Record<string, ImprovementSuggestion[]> = {};
  for (const sug of list) {
    if (!out[sug.stepRef]) out[sug.stepRef] = [];
    out[sug.stepRef].push(sug);
  }
  return out;
}
