/**
 * PidCompletenessCard — tarjeta de resumen semántico para el paso 7 del wizard
 *
 * Se añade al grid de CompletionCards del paso "Revisión" y muestra:
 *   - Cuántas etiquetas hay por campo PID (type, touristType, amenityFeature…)
 *   - Si el recurso alcanza el mínimo semántico (≥1 type + ≥1 municipio)
 *   - Botón para saltar al paso 4 y ajustar
 *
 * No hace llamada al backend; calcula todo en cliente a partir de las tag_keys
 * seleccionadas y el catálogo.
 */

import { useMemo } from 'react';
import {
  TAGS_BY_KEY,
  type TagField,
} from '@osalnes/shared';

export interface PidCompletenessCardProps {
  /** Claves de etiquetas actualmente seleccionadas */
  selectedKeys: string[];
  /** Callback para navegar al paso de clasificación */
  onEdit?: () => void;
}

const FIELD_ORDER: TagField[] = [
  'type',
  'touristType',
  'amenityFeature',
  'accessibility',
  'addressLocality',
  'cuisine',
  'editorial',
  'cms',
];

const FIELD_LABEL: Record<TagField, string> = {
  type: 'Tipo schema.org',
  touristType: 'Tipología turística',
  amenityFeature: 'Servicios / amenities',
  accessibility: 'Accesibilidad',
  addressLocality: 'Municipio',
  cuisine: 'Gastronomía',
  editorial: 'Editorial (solo CMS)',
  cms: 'Flags CMS',
};

export default function PidCompletenessCard({
  selectedKeys,
  onEdit,
}: PidCompletenessCardProps) {
  const breakdown = useMemo(() => {
    const counts: Record<TagField, { total: number; pid: number }> = {
      type: { total: 0, pid: 0 },
      touristType: { total: 0, pid: 0 },
      amenityFeature: { total: 0, pid: 0 },
      accessibility: { total: 0, pid: 0 },
      addressLocality: { total: 0, pid: 0 },
      cuisine: { total: 0, pid: 0 },
      editorial: { total: 0, pid: 0 },
      cms: { total: 0, pid: 0 },
    };
    for (const k of selectedKeys) {
      const t = TAGS_BY_KEY[k];
      if (!t) continue;
      counts[t.field].total += 1;
      if (t.pidExportable) counts[t.field].pid += 1;
    }
    return counts;
  }, [selectedKeys]);

  const hasType = breakdown.type.total >= 1;
  const hasLocality = breakdown.addressLocality.total >= 1;
  const minimumMet = hasType && hasLocality;

  const pidTotal = FIELD_ORDER.reduce(
    (acc, f) => (f === 'editorial' || f === 'cms' ? acc : acc + breakdown[f].pid),
    0,
  );

  const status = !minimumMet
    ? ('incomplete' as const)
    : pidTotal < 5
    ? ('partial' as const)
    : ('ready' as const);

  const statusLabel =
    status === 'ready' ? 'Listo para PID' : status === 'partial' ? 'Mejorable' : 'Incompleto';

  return (
    <div
      className={`completion-card pid-completeness pid-completeness--${status}`}
      role="region"
      aria-label="Completitud semántica para PID"
    >
      <header className="pid-completeness-head">
        <h4>Completitud semántica PID</h4>
        <span className={`pid-completeness-status pid-completeness-status--${status}`}>
          {statusLabel}
        </span>
      </header>

      <dl className="pid-completeness-grid">
        {FIELD_ORDER.filter((f) => f !== 'cms').map((f) => {
          const c = breakdown[f];
          const isMin = f === 'type' || f === 'addressLocality';
          const missing = isMin && c.total === 0;
          return (
            <div
              key={f}
              className={`pid-completeness-row${missing ? ' pid-completeness-row--missing' : ''}`}
            >
              <dt>{FIELD_LABEL[f]}</dt>
              <dd>
                <strong>{c.total}</strong>
                {f !== 'editorial' && c.total > 0 && (
                  <span className="pid-completeness-pid-count">
                    · {c.pid} PID
                  </span>
                )}
                {missing && <span className="pid-completeness-required">obligatorio</span>}
              </dd>
            </div>
          );
        })}
      </dl>

      <footer className="pid-completeness-foot">
        <span>
          <strong>{pidTotal}</strong> etiquetas exportables a PID en total
        </span>
        {onEdit && (
          <button type="button" className="btn-link" onClick={onEdit}>
            Editar clasificación
          </button>
        )}
      </footer>
    </div>
  );
}
