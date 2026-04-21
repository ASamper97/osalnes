/**
 * EstablishmentDetails — bloque condicional con campos específicos
 *
 * Solo se renderiza si la tipología principal del recurso tiene al menos
 * un campo aplicable (rating, aforo, cocina). Ver establishment-fields.ts
 * para la lógica completa.
 *
 * Este componente NO decide si mostrarse; eso lo hace el padre llamando a
 * `hasAnyEstablishmentField(mainTypeKey)` antes de montarlo.
 */

import {
  getEstablishmentFields,
  getRatingOptions,
} from '@osalnes/shared/data/establishment-fields';
import CuisineSelector from './CuisineSelector';
import { STEP4_COPY } from '../pages/step4-classification.copy';

export interface EstablishmentData {
  /** Valor de estrellas/tenedores/categoría; null = sin clasificar */
  rating: number | null;
  /** Aforo máximo; null = sin informar */
  occupancy: number | null;
  /** Códigos UNE de tipos de cocina */
  cuisineCodes: string[];
}

export interface EstablishmentDetailsProps {
  mainTypeKey: string | null;
  data: EstablishmentData;
  onChange: (next: EstablishmentData) => void;
}

export default function EstablishmentDetails({
  mainTypeKey,
  data,
  onChange,
}: EstablishmentDetailsProps) {
  const fields = getEstablishmentFields(mainTypeKey);
  const COPY = STEP4_COPY.establishment;

  if (!fields.showRating && !fields.showOccupancy && !fields.showCuisine) {
    // Comportamiento seguro: el padre debería haber decidido no montarnos,
    // pero por si acaso, renderizamos nada.
    return null;
  }

  const ratingOptions = fields.ratingKind ? getRatingOptions(fields.ratingKind) : [];
  const ratingHint = fields.ratingKind ? COPY.ratingHints[fields.ratingKind] : '';

  return (
    <section className="step4-establishment">
      <header>
        <h3>{COPY.sectionTitle}</h3>
        <p className="muted">{COPY.sectionDesc}</p>
      </header>

      <div className="step4-establishment-grid">
        {/* Clasificación oficial */}
        {fields.showRating && (
          <label className="step4-field">
            <span className="step4-field-label">{COPY.ratingLabel}</span>
            <select
              value={data.rating ?? ''}
              onChange={(e) =>
                onChange({
                  ...data,
                  rating: e.target.value === '' ? null : Number(e.target.value),
                })
              }
            >
              <option value="">{COPY.ratingPlaceholder}</option>
              {ratingOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.symbol}  ·  {o.label}
                </option>
              ))}
            </select>
            <small className="field-hint">{ratingHint}</small>
          </label>
        )}

        {/* Aforo */}
        {fields.showOccupancy && (
          <label className="step4-field">
            <span className="step4-field-label">{COPY.occupancyLabel}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={data.occupancy ?? ''}
              onChange={(e) =>
                onChange({
                  ...data,
                  occupancy: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              placeholder={COPY.occupancyPlaceholder}
            />
            <small className="field-hint">{COPY.occupancyHint}</small>
          </label>
        )}
      </div>

      {/* Tipos de cocina (multi-select a ancho completo) */}
      {fields.showCuisine && (
        <div className="step4-field step4-field-cuisine">
          <span className="step4-field-label">{COPY.cuisineLabel}</span>
          <CuisineSelector
            selected={data.cuisineCodes}
            onChange={(next) => onChange({ ...data, cuisineCodes: next })}
          />
          <small className="field-hint">{COPY.cuisineHint}</small>
        </div>
      )}
    </section>
  );
}
