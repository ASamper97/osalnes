/**
 * SchedulePublishPicker — selector fecha+hora para publicación programada
 *
 * Decisión 4-A del usuario: fecha + hora (no solo fecha).
 *
 * Usa `<input type="datetime-local">` nativo (soporte moderno en todos
 * los navegadores). Timezone Europe/Madrid se maneja implícitamente
 * porque el navegador del funcionario está en España; los helpers de
 * publication-status.ts convierten a/desde UTC para BD.
 */

import { useState } from 'react';
import {
  localDateTimeToUtcIso,
  utcIsoToLocalDateTime,
  minScheduleDateTime,
  formatScheduleForDisplay,
  timeUntilSchedule,
} from '@osalnes/shared/data/publication-status';

export interface SchedulePublishPickerProps {
  /** Valor actual en UTC ISO string (o null si no está programado) */
  value: string | null;
  onChange: (utcIso: string | null) => void;
  /** Deshabilitar si el recurso no está en estado que permite programar */
  disabled?: boolean;
}

export default function SchedulePublishPicker({
  value,
  onChange,
  disabled = false,
}: SchedulePublishPickerProps) {
  const [localValue, setLocalValue] = useState<string>(
    value ? utcIsoToLocalDateTime(value) : '',
  );

  const handleChange = (next: string) => {
    setLocalValue(next);
    if (!next) {
      onChange(null);
    } else {
      onChange(localDateTimeToUtcIso(next));
    }
  };

  const handleClear = () => {
    setLocalValue('');
    onChange(null);
  };

  const minDateTime = minScheduleDateTime();

  return (
    <div className="schedule-picker">
      <label className="schedule-picker-label">
        <span className="schedule-picker-label-text">Fecha y hora de publicación</span>
        <input
          type="datetime-local"
          className="schedule-picker-input"
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          min={minDateTime}
          disabled={disabled}
          aria-label="Fecha y hora de publicación programada"
        />
      </label>

      {value && (
        <div className="schedule-picker-preview">
          <div className="schedule-picker-preview-date">
            📅 {formatScheduleForDisplay(value)}
          </div>
          <div className="schedule-picker-preview-time muted">
            Se publicará {timeUntilSchedule(value)}
          </div>
          <button
            type="button"
            className="schedule-picker-clear btn btn-ghost btn-sm"
            onClick={handleClear}
            disabled={disabled}
          >
            Quitar programación
          </button>
        </div>
      )}

      <p className="schedule-picker-hint muted">
        La publicación se hará automáticamente en la fecha indicada (zona horaria Europe/Madrid).
        Si hay un aviso crítico en el recurso, se publicará igual a la hora programada.
      </p>
    </div>
  );
}
