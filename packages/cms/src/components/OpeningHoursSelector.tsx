/**
 * OpeningHoursSelector — selector estructurado de horarios con 7 plantillas
 *
 * Sustituye al textarea libre anterior. Cada plantilla tiene su propio
 * editor visual; el componente guarda el estado como `OpeningHoursPlan`,
 * que se mapea 1:1 a `hasOpeningHours` de UNE 178503 / PID.
 *
 * Las 7 plantillas (ver modelo en shared/data/opening-hours.ts):
 *   1. always       — 24/7
 *   2. weekly       — horario semanal fijo (con varios tramos por día)
 *   3. seasonal     — varios periodos (verano/invierno), cada uno con su semanal
 *   4. appointment  — cita previa (hereda teléfono del bloque contacto)
 *   5. event        — evento con fechas concretas
 *   6. external     — sin horario, consultar web
 *   7. closed       — cerrado temporalmente
 *
 * Los cierres puntuales (closures) son ORTOGONALES a la plantilla: se
 * pueden añadir N cierres con cualquier plantilla.
 */

import { useCallback } from 'react';
import {
  type OpeningHoursPlan,
  type DayHours,
  type TimeRange,
  type OpeningClosure,
  type PlanWeekly,
  type PlanSeasonal,
  type PlanSeasonalPeriod,
  type PlanEvent,
  type PlanClosed,
  WEEK_DAYS,
  WEEK_DAY_LABELS,
  emptyPlanByKind,
} from '@osalnes/shared/data/opening-hours';
import { STEP3_COPY } from '../pages/step3-location.copy';

const COPY = STEP3_COPY.hours;

// ─────────────────────────────────────────────────────────────────────────

export interface OpeningHoursSelectorProps {
  plan: OpeningHoursPlan;
  onChange: (next: OpeningHoursPlan) => void;
  /** Teléfono del bloque contacto (para mostrar en plantilla 'appointment') */
  contactPhone?: string;
  /** Web del bloque contacto (para mostrar en plantilla 'external') */
  contactWeb?: string;
}

export default function OpeningHoursSelector({
  plan,
  onChange,
  contactPhone,
  contactWeb,
}: OpeningHoursSelectorProps) {
  const handleKindChange = (nextKind: OpeningHoursPlan['kind']) => {
    if (nextKind === plan.kind) return;
    // Preservamos closures y note al cambiar de plantilla
    const next = emptyPlanByKind(nextKind);
    next.closures = plan.closures;
    next.note = plan.note;
    onChange(next);
  };

  return (
    <div className="hours-selector">
      {/* Radio group con las 7 plantillas */}
      <fieldset className="hours-kind-group">
        <legend>{COPY.kindLabel}</legend>
        {(Object.keys(COPY.kinds) as OpeningHoursPlan['kind'][]).map((kind) => {
          const meta = COPY.kinds[kind];
          return (
            <label key={kind} className="hours-kind-option">
              <input
                type="radio"
                name="hours-kind"
                value={kind}
                checked={plan.kind === kind}
                onChange={() => handleKindChange(kind)}
              />
              <span className="hours-kind-body">
                <span className="hours-kind-label">{meta.label}</span>
                <span className="hours-kind-hint">{meta.hint}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {/* Editor específico de la plantilla activa */}
      <div className="hours-editor">
        {plan.kind === 'always' && <AlwaysEditor />}
        {plan.kind === 'weekly' && (
          <WeeklyEditor plan={plan} onChange={onChange} />
        )}
        {plan.kind === 'seasonal' && (
          <SeasonalEditor plan={plan} onChange={onChange} />
        )}
        {plan.kind === 'appointment' && (
          <AppointmentEditor contactPhone={contactPhone} />
        )}
        {plan.kind === 'event' && (
          <EventEditor plan={plan} onChange={onChange} />
        )}
        {plan.kind === 'external' && (
          <ExternalEditor contactWeb={contactWeb} />
        )}
        {plan.kind === 'closed' && (
          <ClosedEditor plan={plan} onChange={onChange} />
        )}
      </div>

      {/* Cierres temporales (común a todas las plantillas) */}
      <ClosuresEditor
        closures={plan.closures ?? []}
        onChange={(next) => onChange({ ...plan, closures: next })}
      />

      {/* Nota libre */}
      <div className="hours-note">
        <label htmlFor="hours-note-input">{COPY.noteLabel}</label>
        <textarea
          id="hours-note-input"
          value={plan.note ?? ''}
          onChange={(e) => onChange({ ...plan, note: e.target.value })}
          placeholder={COPY.notePlaceholder}
          rows={2}
        />
      </div>
    </div>
  );
}

// ─── Editores por plantilla ───────────────────────────────────────────

function AlwaysEditor() {
  return (
    <div className="hours-editor-card hours-editor-always">
      <p>🌞 Este recurso está disponible las 24 horas, todos los días del año.</p>
      <p className="muted">
        En la web pública aparecerá como "Abierto las 24 horas".
      </p>
    </div>
  );
}

// ─── Plantilla 2 · Weekly ─────────────────────────────────────────────

function WeeklyEditor({
  plan,
  onChange,
}: {
  plan: PlanWeekly;
  onChange: (p: OpeningHoursPlan) => void;
}) {
  const updateDay = useCallback(
    (day: DayHours['day'], patch: Partial<DayHours>) => {
      const nextDays = plan.days.map((d) =>
        d.day === day ? { ...d, ...patch } : d,
      );
      onChange({ ...plan, days: nextDays });
    },
    [plan, onChange],
  );

  const copyFirstToWeekdays = () => {
    const first = plan.days.find((d) => d.ranges.length > 0);
    if (!first) return;
    const nextDays = plan.days.map((d) =>
      ['Mo', 'Tu', 'We', 'Th', 'Fr'].includes(d.day)
        ? { ...d, ranges: cloneRanges(first.ranges) }
        : d,
    );
    onChange({ ...plan, days: nextDays });
  };

  const copyFirstToAll = () => {
    const first = plan.days.find((d) => d.ranges.length > 0);
    if (!first) return;
    const nextDays = plan.days.map((d) => ({ ...d, ranges: cloneRanges(first.ranges) }));
    onChange({ ...plan, days: nextDays });
  };

  return (
    <div className="hours-editor-card hours-editor-weekly">
      <div className="hours-weekly-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={copyFirstToWeekdays}>
          {COPY.weeklyCopyToWeekdays}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={copyFirstToAll}>
          {COPY.weeklyCopyToAll}
        </button>
      </div>

      <table className="hours-weekly-table">
        <tbody>
          {plan.days.map((d) => (
            <WeeklyDayRow key={d.day} day={d} onChangeDay={(patch) => updateDay(d.day, patch)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WeeklyDayRow({
  day,
  onChangeDay,
}: {
  day: DayHours;
  onChangeDay: (patch: Partial<DayHours>) => void;
}) {
  const closed = day.ranges.length === 0;
  const label = WEEK_DAY_LABELS[day.day];

  const toggleClosed = () => {
    if (closed) {
      onChangeDay({ ranges: [{ opensAt: '09:00', closesAt: '14:00' }] });
    } else {
      onChangeDay({ ranges: [] });
    }
  };

  const updateRange = (idx: number, patch: Partial<TimeRange>) => {
    const next = day.ranges.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    onChangeDay({ ranges: next });
  };

  const addRange = () => {
    onChangeDay({
      ranges: [...day.ranges, { opensAt: '16:00', closesAt: '19:00' }],
    });
  };

  const removeRange = (idx: number) => {
    onChangeDay({ ranges: day.ranges.filter((_, i) => i !== idx) });
  };

  return (
    <tr className={`hours-weekly-row ${closed ? 'is-closed' : ''}`}>
      <th scope="row" className="hours-weekly-day" title={label.long}>
        <span className="hours-weekly-day-short" aria-hidden>
          {label.short}
        </span>
        <span className="sr-only">{label.long}</span>
      </th>

      <td className="hours-weekly-ranges">
        {closed ? (
          <span className="hours-weekly-closed-label">Cerrado</span>
        ) : (
          day.ranges.map((r, idx) => (
            <span key={idx} className="hours-weekly-range">
              <input
                type="time"
                value={r.opensAt}
                onChange={(e) => updateRange(idx, { opensAt: e.target.value })}
                aria-label={`Apertura ${label.long} tramo ${idx + 1}`}
              />
              <span aria-hidden>–</span>
              <input
                type="time"
                value={r.closesAt}
                onChange={(e) => updateRange(idx, { closesAt: e.target.value })}
                aria-label={`Cierre ${label.long} tramo ${idx + 1}`}
              />
              {day.ranges.length > 1 && (
                <button
                  type="button"
                  className="hours-weekly-remove"
                  onClick={() => removeRange(idx)}
                  aria-label={COPY.weeklyRemoveRange}
                  title={COPY.weeklyRemoveRange}
                >
                  ×
                </button>
              )}
            </span>
          ))
        )}

        {!closed && (
          <button type="button" className="hours-weekly-add" onClick={addRange}>
            + {COPY.weeklyAddRange}
          </button>
        )}
      </td>

      <td className="hours-weekly-closed-cell">
        <label>
          <input type="checkbox" checked={closed} onChange={toggleClosed} />
          <span>{COPY.weeklyClosedCheckbox}</span>
        </label>
      </td>
    </tr>
  );
}

// ─── Plantilla 3 · Seasonal ───────────────────────────────────────────

function SeasonalEditor({
  plan,
  onChange,
}: {
  plan: PlanSeasonal;
  onChange: (p: OpeningHoursPlan) => void;
}) {
  const addPeriod = () => {
    const next: PlanSeasonalPeriod = {
      name: '',
      startDate: '',
      endDate: '',
      days: WEEK_DAYS.map((d) => ({ day: d, ranges: [] })),
    };
    onChange({ ...plan, periods: [...plan.periods, next] });
  };

  const removePeriod = (idx: number) => {
    onChange({ ...plan, periods: plan.periods.filter((_, i) => i !== idx) });
  };

  const updatePeriod = (idx: number, patch: Partial<PlanSeasonalPeriod>) => {
    onChange({
      ...plan,
      periods: plan.periods.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    });
  };

  return (
    <div className="hours-editor-card hours-editor-seasonal">
      {plan.periods.map((period, idx) => (
        <div key={idx} className="hours-seasonal-period">
          <header className="hours-seasonal-head">
            <input
              type="text"
              className="hours-seasonal-name"
              value={period.name}
              onChange={(e) => updatePeriod(idx, { name: e.target.value })}
              placeholder={COPY.seasonalPeriodNamePlaceholder}
              aria-label={COPY.seasonalPeriodNameLabel}
            />
            {plan.periods.length > 1 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => removePeriod(idx)}
              >
                {COPY.seasonalRemovePeriod}
              </button>
            )}
          </header>

          <div className="hours-seasonal-dates">
            <label>
              {COPY.seasonalPeriodStart}
              <input
                type="date"
                value={period.startDate}
                onChange={(e) => updatePeriod(idx, { startDate: e.target.value })}
              />
            </label>
            <label>
              {COPY.seasonalPeriodEnd}
              <input
                type="date"
                value={period.endDate}
                onChange={(e) => updatePeriod(idx, { endDate: e.target.value })}
              />
            </label>
          </div>

          {/* Cada temporada tiene su propio weekly interno, reutilizamos el subcomponente */}
          <WeeklyForSeason
            days={period.days}
            onChangeDays={(days) => updatePeriod(idx, { days })}
          />
        </div>
      ))}

      <button type="button" className="btn btn-primary btn-sm" onClick={addPeriod}>
        + {COPY.seasonalAddPeriod}
      </button>
    </div>
  );
}

function WeeklyForSeason({
  days,
  onChangeDays,
}: {
  days: DayHours[];
  onChangeDays: (days: DayHours[]) => void;
}) {
  const updateDay = (day: DayHours['day'], patch: Partial<DayHours>) => {
    onChangeDays(days.map((d) => (d.day === day ? { ...d, ...patch } : d)));
  };
  return (
    <table className="hours-weekly-table">
      <tbody>
        {days.map((d) => (
          <WeeklyDayRow key={d.day} day={d} onChangeDay={(patch) => updateDay(d.day, patch)} />
        ))}
      </tbody>
    </table>
  );
}

// ─── Plantilla 4 · Appointment ────────────────────────────────────────

function AppointmentEditor({ contactPhone }: { contactPhone?: string }) {
  return (
    <div className="hours-editor-card hours-editor-appointment">
      {contactPhone?.trim() ? (
        <p>
          📞 {COPY.appointmentUsesContactPhone} <strong>{contactPhone}</strong>
        </p>
      ) : (
        <p className="muted">{COPY.appointmentNoPhone}</p>
      )}
    </div>
  );
}

// ─── Plantilla 5 · Event ──────────────────────────────────────────────

function EventEditor({
  plan,
  onChange,
}: {
  plan: PlanEvent;
  onChange: (p: OpeningHoursPlan) => void;
}) {
  return (
    <div className="hours-editor-card hours-editor-event">
      <label>
        {COPY.eventNameLabel}
        <input
          type="text"
          value={plan.eventName ?? ''}
          onChange={(e) => onChange({ ...plan, eventName: e.target.value })}
          placeholder={COPY.eventNamePlaceholder}
        />
      </label>

      <div className="hours-event-dates">
        <label>
          {COPY.eventStart}
          <input
            type="datetime-local"
            value={plan.startDate}
            onChange={(e) => onChange({ ...plan, startDate: e.target.value })}
          />
        </label>
        <label>
          {COPY.eventEnd}
          <input
            type="datetime-local"
            value={plan.endDate}
            onChange={(e) => onChange({ ...plan, endDate: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}

// ─── Plantilla 6 · External ───────────────────────────────────────────

function ExternalEditor({ contactWeb }: { contactWeb?: string }) {
  return (
    <div className="hours-editor-card hours-editor-external">
      {contactWeb?.trim() ? (
        <p>
          🔗 {COPY.externalUsesContactWeb}{' '}
          <a href={contactWeb} target="_blank" rel="noreferrer">
            {contactWeb}
          </a>
        </p>
      ) : (
        <p className="muted">{COPY.externalNoWeb}</p>
      )}
    </div>
  );
}

// ─── Plantilla 7 · Closed ─────────────────────────────────────────────

function ClosedEditor({
  plan,
  onChange,
}: {
  plan: PlanClosed;
  onChange: (p: OpeningHoursPlan) => void;
}) {
  return (
    <div className="hours-editor-card hours-editor-closed">
      <label>
        {COPY.closedReopeningLabel}
        <input
          type="date"
          value={plan.reopeningDate ?? ''}
          onChange={(e) => onChange({ ...plan, reopeningDate: e.target.value || undefined })}
        />
      </label>

      <label>
        {COPY.closedReasonLabel}
        <input
          type="text"
          value={plan.reason ?? ''}
          onChange={(e) => onChange({ ...plan, reason: e.target.value || undefined })}
          placeholder={COPY.closedReasonPlaceholder}
        />
      </label>
    </div>
  );
}

// ─── Cierres temporales ───────────────────────────────────────────────

function ClosuresEditor({
  closures,
  onChange,
}: {
  closures: OpeningClosure[];
  onChange: (next: OpeningClosure[]) => void;
}) {
  const add = () => {
    onChange([...closures, { startDate: '', endDate: '', reason: '' }]);
  };
  const remove = (idx: number) => {
    onChange(closures.filter((_, i) => i !== idx));
  };
  const update = (idx: number, patch: Partial<OpeningClosure>) => {
    onChange(closures.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  return (
    <section className="hours-closures">
      <header>
        <h4>{COPY.closuresTitle}</h4>
        <p className="muted">{COPY.closuresDesc}</p>
      </header>

      {closures.map((c, idx) => (
        <div key={idx} className="hours-closure-row">
          <label>
            {COPY.closureStart}
            <input
              type="date"
              value={c.startDate}
              onChange={(e) => update(idx, { startDate: e.target.value })}
            />
          </label>
          <label>
            {COPY.closureEnd}
            <input
              type="date"
              value={c.endDate}
              onChange={(e) => update(idx, { endDate: e.target.value })}
            />
          </label>
          <label className="hours-closure-reason">
            {COPY.closureReason}
            <input
              type="text"
              value={c.reason ?? ''}
              onChange={(e) => update(idx, { reason: e.target.value })}
              placeholder={COPY.closureReasonPlaceholder}
            />
          </label>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => remove(idx)}
          >
            {COPY.closuresRemove}
          </button>
        </div>
      ))}

      <button type="button" className="btn btn-ghost btn-sm" onClick={add}>
        + {COPY.closuresAdd}
      </button>
    </section>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────

function cloneRanges(ranges: TimeRange[]): TimeRange[] {
  return ranges.map((r) => ({ ...r }));
}
