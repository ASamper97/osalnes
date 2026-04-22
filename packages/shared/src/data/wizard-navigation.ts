/**
 * Modelo de navegación del wizard de recursos
 *
 * Define los pasos, reglas de navegación y lógica de "puedo saltar al
 * paso N desde aquí".
 *
 * Política de navegación (decisión A del usuario):
 *
 *   - Los pasos 1 y 2 son OBLIGATORIOS y SECUENCIALES. Hasta que no se
 *     haya pasado al menos por ellos y guardado el recurso, no se puede
 *     saltar libremente.
 *
 *   - Una vez el recurso tiene ID (ya existe en BD como borrador o
 *     publicado), el funcionario puede saltar a cualquier paso
 *     directamente. Los pasos opcionales (3, 4, 5, 6) son navegables.
 *
 *   - El paso 7 (Revisión) es accesible en cualquier momento si hay
 *     ID guardado — permite revisar el estado global.
 *
 *   - En edición (recurso ya guardado): todos los pasos clickables
 *     desde el primer momento.
 */

// ─── Definición de pasos ───────────────────────────────────────────────

export interface WizardStepDef {
  /** Número de paso (1-8) */
  number: WizardStepNumber;
  /** Clave estable para referenciar (identification, content, etc.) */
  key: WizardStepKey;
  /** Etiqueta visible en castellano */
  label: string;
  /** Icono del stepper */
  icon: string;
  /** Si es opcional (aparece "opcional" bajo el label) */
  optional: boolean;
  /** Si es un paso secuencial bloqueante (pasos 1 y 2) */
  requiresPriorCompletion: boolean;
}

/**
 * Número de paso del wizard.
 * Paso 8 (Revisión) añadido tras el paso 7 Relaciones (pliego 5.1.1).
 */
export type WizardStepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type WizardStepKey =
  | 'identification'  // 1 - obligatorio
  | 'content'         // 2 - obligatorio
  | 'location'        // 3 - opcional
  | 'classification'  // 4 - opcional
  | 'multimedia'      // 5 - opcional
  | 'seo'             // 6 - opcional
  | 'relations'       // 7 - opcional (UNE 178503)
  | 'review';         // 8 - revisión final

export const WIZARD_STEPS: readonly WizardStepDef[] = [
  { number: 1, key: 'identification', label: 'Identificación', icon: '📝', optional: false, requiresPriorCompletion: false },
  { number: 2, key: 'content',        label: 'Contenido',      icon: '📄', optional: false, requiresPriorCompletion: true  },
  { number: 3, key: 'location',       label: 'Ubicación',      icon: '📍', optional: true,  requiresPriorCompletion: false },
  { number: 4, key: 'classification', label: 'Clasificación',  icon: '🏷️', optional: true,  requiresPriorCompletion: false },
  { number: 5, key: 'multimedia',     label: 'Multimedia',     icon: '📷', optional: true,  requiresPriorCompletion: false },
  { number: 6, key: 'seo',            label: 'SEO e idiomas',  icon: '🌐', optional: true,  requiresPriorCompletion: false },
  { number: 7, key: 'relations',      label: 'Relaciones',     icon: '🔗', optional: true,  requiresPriorCompletion: false },
  { number: 8, key: 'review',         label: 'Revisión',       icon: '✅', optional: false, requiresPriorCompletion: false },
] as const;

export const TOTAL_STEPS = WIZARD_STEPS.length;

// ─── Estado de cada paso desde la perspectiva del stepper ──────────────

/**
 * Estado visual del paso en el stepper.
 *
 *   - 'current':    el paso activo ahora.
 *   - 'accessible': se puede saltar a él con un clic.
 *   - 'locked':     requiere cumplir pasos previos antes.
 *   - 'dirty':      tiene cambios sin guardar (se combina con los otros).
 *   - 'complete':   el paso tiene datos válidos (usado con badge ✓).
 */
export interface WizardStepState {
  number: number;
  key: WizardStepKey;
  isCurrent: boolean;
  isAccessible: boolean;
  isLocked: boolean;
  isDirty: boolean;
  isComplete: boolean;
  /** Razón por la que está bloqueado (para tooltip) */
  lockReason?: string;
}

// ─── Reglas de navegación ──────────────────────────────────────────────

export interface NavigationContext {
  /** Paso actual (1-7) */
  currentStep: number;
  /** ID del recurso en BD (null si creación sin guardar) */
  resourceId: string | null;
  /** ¿Se ha completado el paso 1? (campos obligatorios) */
  step1Complete: boolean;
  /** ¿Se ha completado el paso 2? (campos obligatorios) */
  step2Complete: boolean;
  /** Pasos con cambios sin guardar */
  dirtySteps: Set<number>;
  /** Pasos que tienen datos válidos (para el checkmark) */
  completeSteps: Set<number>;
}

/**
 * Política: a qué paso puedo saltar desde la situación actual.
 *
 * Reglas (decisión A):
 *   - Paso 1: siempre accesible.
 *   - Paso 2: accesible si el paso 1 está completo.
 *   - Pasos 3-7: accesibles si los pasos 1 y 2 están completos
 *     Y el recurso tiene ID (es decir, hay algo guardado en BD).
 *
 * En edición (resourceId != null al inicio), los pasos 1 y 2 ya se
 * consideran completos porque vienen rellenos desde BD.
 */
export function canNavigateToStep(
  targetStep: number,
  ctx: NavigationContext,
): { allowed: boolean; reason?: string } {
  if (targetStep < 1 || targetStep > TOTAL_STEPS) {
    return { allowed: false, reason: 'Paso inválido.' };
  }

  // Paso 1 siempre accesible
  if (targetStep === 1) return { allowed: true };

  // Paso 2 requiere paso 1 completo
  if (targetStep === 2) {
    if (!ctx.step1Complete) {
      return {
        allowed: false,
        reason: 'Completa primero la tipología, el nombre y el municipio.',
      };
    }
    return { allowed: true };
  }

  // Pasos 3-7 requieren pasos 1 y 2 completos + recurso guardado en BD
  if (!ctx.step1Complete) {
    return {
      allowed: false,
      reason: 'Completa primero el paso 1 (tipología, nombre y municipio).',
    };
  }
  if (!ctx.step2Complete) {
    return {
      allowed: false,
      reason: 'Completa primero el paso 2 (descripción del recurso).',
    };
  }
  if (!ctx.resourceId) {
    return {
      allowed: false,
      reason: 'Guarda primero el recurso como borrador para poder saltar libremente entre pasos.',
    };
  }

  return { allowed: true };
}

/**
 * Deriva el estado completo del stepper (7 entradas) desde el contexto.
 * Se usa para renderizar.
 */
export function buildStepperState(ctx: NavigationContext): WizardStepState[] {
  return WIZARD_STEPS.map((def) => {
    const canNav = canNavigateToStep(def.number, ctx);
    return {
      number: def.number,
      key: def.key,
      isCurrent: ctx.currentStep === def.number,
      isAccessible: canNav.allowed,
      isLocked: !canNav.allowed,
      isDirty: ctx.dirtySteps.has(def.number),
      isComplete: ctx.completeSteps.has(def.number),
      lockReason: canNav.reason,
    };
  });
}

/**
 * Porcentaje de progreso del wizard.
 *
 * Lógica: "paso_actual / total_pasos * 100", redondeado.
 * Esto corrige el bug "86% en el paso 7 de 7" (debería ser 100%).
 */
export function computeProgressPercent(currentStep: number): number {
  if (currentStep < 1) return 0;
  if (currentStep >= TOTAL_STEPS) return 100;
  return Math.round((currentStep / TOTAL_STEPS) * 100);
}
