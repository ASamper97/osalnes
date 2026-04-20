/**
 * Modelo de datos de horarios (Paso 3 · sección horarios)
 *
 * Este módulo define el shape TS del plan de horarios que se guarda por
 * recurso. Está alineado con la norma UNE 178503 / schema.org
 * `OpeningHoursSpecification` y mapea 1:1 al campo `hasOpeningHours` del
 * PID (manual GraphQL §10.1.11 y §10.2.10).
 *
 * PRINCIPIO DE DISEÑO
 * ───────────────────
 * El usuario no rellena a mano "Mo-Fr 9-14". Elige una de 7 plantillas
 * ("kind") y el componente le pide solo los datos mínimos de esa
 * plantilla. En el export a PID, cada plantilla se traduce al formato
 * estructurado schema.org (función `planToPidPayload`).
 *
 * LAS 7 PLANTILLAS
 * ────────────────
 *   1. `always`        · Siempre abierto (24/7, sin restricciones)
 *   2. `weekly`        · Horario semanal fijo (L-D con tramos)
 *   3. `seasonal`      · Horarios diferentes por temporada (verano/invierno)
 *   4. `appointment`   · Solo con cita previa (depende del teléfono)
 *   5. `event`         · Evento con fechas concretas (inicio–fin)
 *   6. `external`      · Sin horario definido, consultar web
 *   7. `closed`        · Cerrado temporalmente (p.ej. obras)
 *
 * CIERRES TEMPORALES (ortogonal a la plantilla)
 * ─────────────────────────────────────────────
 * Independientemente de la plantilla elegida, el usuario puede añadir
 * N "closures" (fiestas, vacaciones, obras…) que se exportan a PID
 * como `specialOpeningHoursSpecification[]`.
 */

// ─── Tipos primitivos ──────────────────────────────────────────────────

/** Día de la semana en formato schema.org (URIs de https://schema.org/...) */
export type WeekDay = 'Mo' | 'Tu' | 'We' | 'Th' | 'Fr' | 'Sa' | 'Su';

export const WEEK_DAYS: WeekDay[] = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/** Etiqueta localizada en castellano (para la UI) */
export const WEEK_DAY_LABELS: Record<WeekDay, { short: string; long: string }> = {
  Mo: { short: 'L', long: 'Lunes' },
  Tu: { short: 'M', long: 'Martes' },
  We: { short: 'X', long: 'Miércoles' },
  Th: { short: 'J', long: 'Jueves' },
  Fr: { short: 'V', long: 'Viernes' },
  Sa: { short: 'S', long: 'Sábado' },
  Su: { short: 'D', long: 'Domingo' },
};

/** Rango HH:MM – HH:MM */
export interface TimeRange {
  /** "HH:MM" en 24h */
  opensAt: string;
  /** "HH:MM" en 24h */
  closesAt: string;
}

/** Horario de un día: cero o más tramos; vacío = cerrado */
export interface DayHours {
  day: WeekDay;
  /** Tramos de apertura del día. Vacío o ausente = "cerrado". */
  ranges: TimeRange[];
}

// ─── Cierre temporal (ortogonal) ───────────────────────────────────────

export interface OpeningClosure {
  /** ISO date "YYYY-MM-DD" */
  startDate: string;
  endDate: string;
  /** Motivo visible al visitante (ES) */
  reason?: string;
}

// ─── Plantillas de plan ────────────────────────────────────────────────

interface PlanBase {
  /** Cierres temporales superpuestos (siempre disponible) */
  closures?: OpeningClosure[];
  /** Nota libre del editor que se muestra al visitante si existe */
  note?: string;
}

/** Plantilla 1 — 24/7 */
export interface PlanAlways extends PlanBase {
  kind: 'always';
}

/** Plantilla 2 — Horario semanal fijo */
export interface PlanWeekly extends PlanBase {
  kind: 'weekly';
  /** Horario para los 7 días; los ausentes = cerrado */
  days: DayHours[];
}

/** Plantilla 3 — Temporada (N periodos con horario propio) */
export interface PlanSeasonalPeriod {
  /** Nombre visible, p.ej. "Verano" */
  name: string;
  /** ISO "YYYY-MM-DD" (año opcional: si el usuario usa recurrente, se ignora el año) */
  startDate: string;
  endDate: string;
  /** Horario que aplica en este periodo */
  days: DayHours[];
}
export interface PlanSeasonal extends PlanBase {
  kind: 'seasonal';
  periods: PlanSeasonalPeriod[];
}

/** Plantilla 4 — Cita previa */
export interface PlanAppointment extends PlanBase {
  kind: 'appointment';
  /** Teléfono prioritario para concertar cita (suele heredarse del bloque contacto) */
  preferredPhone?: string;
}

/** Plantilla 5 — Evento con fechas concretas */
export interface PlanEvent extends PlanBase {
  kind: 'event';
  /** ISO "YYYY-MM-DDTHH:MM" o "YYYY-MM-DD" */
  startDate: string;
  endDate: string;
  /** Nombre del evento (p.ej. "Festa do Albariño") */
  eventName?: string;
}

/** Plantilla 6 — Sin horario, consultar web */
export interface PlanExternal extends PlanBase {
  kind: 'external';
  /** URL donde el visitante puede consultar horarios (suele heredarse del bloque contacto) */
  externalUrl?: string;
}

/** Plantilla 7 — Cerrado temporalmente */
export interface PlanClosed extends PlanBase {
  kind: 'closed';
  /** ISO "YYYY-MM-DD"; opcional si no se sabe */
  reopeningDate?: string;
  /** Motivo visible al visitante (ES) */
  reason?: string;
}

export type OpeningHoursPlan =
  | PlanAlways
  | PlanWeekly
  | PlanSeasonal
  | PlanAppointment
  | PlanEvent
  | PlanExternal
  | PlanClosed;

// ─── Helpers ───────────────────────────────────────────────────────────

export function emptyPlanByKind(kind: OpeningHoursPlan['kind']): OpeningHoursPlan {
  switch (kind) {
    case 'always':
      return { kind: 'always' };
    case 'weekly':
      return {
        kind: 'weekly',
        days: WEEK_DAYS.map((d) => ({ day: d, ranges: [] })),
      };
    case 'seasonal':
      return {
        kind: 'seasonal',
        periods: [
          {
            name: 'Verano',
            startDate: '',
            endDate: '',
            days: WEEK_DAYS.map((d) => ({ day: d, ranges: [] })),
          },
        ],
      };
    case 'appointment':
      return { kind: 'appointment' };
    case 'event':
      return { kind: 'event', startDate: '', endDate: '' };
    case 'external':
      return { kind: 'external' };
    case 'closed':
      return { kind: 'closed' };
  }
}

/**
 * Valida un plan. Devuelve una lista de errores legibles (vacía = OK).
 * Se ejecuta al intentar avanzar al paso 4.
 */
export function validatePlan(plan: OpeningHoursPlan): string[] {
  const errors: string[] = [];
  switch (plan.kind) {
    case 'weekly': {
      const anyRange = plan.days.some((d) => d.ranges.length > 0);
      if (!anyRange) {
        errors.push('Si hay horario semanal, al menos un día debe tener un tramo abierto.');
      }
      for (const d of plan.days) {
        for (const r of d.ranges) {
          if (!r.opensAt || !r.closesAt) {
            errors.push(`Revisa los tramos del ${WEEK_DAY_LABELS[d.day].long.toLowerCase()}.`);
          }
        }
      }
      break;
    }
    case 'seasonal': {
      if (plan.periods.length === 0) {
        errors.push('Añade al menos una temporada.');
      }
      for (const p of plan.periods) {
        if (!p.name.trim()) errors.push('Cada temporada necesita un nombre.');
        if (!p.startDate || !p.endDate) {
          errors.push(`La temporada "${p.name || 'sin nombre'}" necesita fechas de inicio y fin.`);
        }
      }
      break;
    }
    case 'event': {
      if (!plan.startDate || !plan.endDate) {
        errors.push('Un evento necesita fecha de inicio y fin.');
      }
      break;
    }
    case 'closed': {
      // reopeningDate es opcional, no validamos
      break;
    }
    // always, appointment, external — sin validación
  }
  return errors;
}
