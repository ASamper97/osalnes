# Checklist E2E · Wizard global (stepper + autosave + recuperación)

Estado tras aplicar las 4 tareas del prompt `10_wizard_global.md`. Los
25 puntos del `ResourceWizardPage.global.integration.md §12` se evalúan
aquí.

**Sin migración de BD. Sin deploys.** Todo el valor está en
`ResourceWizardPage.tsx` + `@osalnes/shared/data/wizard-navigation` +
3 componentes + 2 hooks.

> ⚙ = verificado estáticamente en el código.
> 👁 = requiere smoke test manual en el CMS.

| # | Punto | Estado |
|---|---|---|
| 1 | Porcentaje coherente. Paso 1 de 7 = 14%, paso 7 de 7 = 100%. | ⚙ (shared/`computeProgressPercent` usa `current/total*100`; Wizard.tsx legacy corrigió `(currentStep+1)/steps.length`) |
| 2 | El stepper muestra 7 botones clickables (no 7 cuadraditos estáticos). | ⚙ (`<WizardStepper>` renderiza 7 `<button>` con rol + estado visual; el legacy de Wizard.tsx queda oculto via `hideDefaultStepper`) |
| 3 | En creación, al abrir el wizard, solo el paso 1 accesible. El resto con 🔒. | ⚙ (`canNavigateToStep`: paso 1 siempre accesible; paso 2 requiere step1Complete; pasos 3-7 requieren step1+step2+resourceId) |
| 4 | Tras completar el paso 1 (tipología+nombre+municipio), el paso 2 se desbloquea. | ⚙ (`step1Complete = !!(mainTypeKey && nameEs.trim() && municipioId)` en navigationContext) |
| 5 | Tras completar el paso 2 y guardar borrador, los pasos 3-7 quedan clickables. | ⚙ (`step2Complete = (descEs ?? '').trim().length >= 20`; el `savedId` lo provee el auto-save de step 0→1 legacy o el handleSaveDraft del paso 5/7) |
| 6 | En edición (recurso con ID), todos los 7 pasos clickables desde el primer momento. | 👁 (depende del loader: hydrata nameEs/municipioId/descEs con >20 chars si el recurso ya los tenía rellenos en BD) |
| 7 | Hover sobre un paso bloqueado: tooltip con la razón. | ⚙ (`lockReason` del `WizardStepState` se renderiza como `title` del botón en `<WizardStepper>`) |
| 8 | Clic en un paso accesible: salta a él. | ⚙ (`handleNavigate` llama `canNavigateToStep` y luego `setCurrentStep(idx)`) |
| 9 | Clic en un paso bloqueado: no hace nada. | ⚙ (`allowed=false` en `canNavigateToStep` hace early return sin setState) |
| 10 | Pasos con datos completos → indicador ✓ verde. | ⚙ (`completeSteps` set deriva del `auditResource(resourceSnapshot).byStep[key].status === 'ok' | 'warn'`) |
| 11 | Pasos con cambios sin guardar → punto naranja pulsante. | ⚙ (`dirtySteps` set + CSS `wizard-step-dirty-dot` con animación pulse) |
| 12 | Al escribir en cualquier campo, se activa el dirty-dot en el paso actual. | ⚙ (efecto que marca `currentStep+1` en `dirtySteps` cuando `autoSave.isDirty=true`) |
| 13 | ~30s sin tocar nada → autoguardado se ejecuta. | 👁 (`useAutoSave` con `intervalMs: 30_000`, debounce tras último cambio) |
| 14 | `AutoSaveIndicator` pasa por estados: saving → saved → idle. | ⚙ (`status` state del hook actualizado por `onSave` callback) |
| 15 | Con wifi apagado, indicador muestra "Sin conexión" y datos van a localStorage. | 👁 (el hook detecta `navigator.onLine === false` y setea status='offline'; escribe en `localStorage[key]` con timestamp `savedAt`) |
| 16 | Al recuperar conexión, autosave sincroniza y indicador vuelve a "saved". | 👁 (listener `window.addEventListener('online', ...)` fuerza forceSave) |
| 17 | Si el autosave falla (error 500), aparece botón "Reintentar" en el indicador. | ⚙ (`AutoSaveIndicator` renderiza botón cuando `status==='error'`; `onRetry` pasa a `forceSave`) |
| 18 | Pulsar "Reintentar" llama a `forceSave()`. | ⚙ (cableado directo en la prop `onRetry`) |
| 19 | Cerrar pestaña con cambios sin guardar → diálogo nativo "¿Seguro?". | ⚙ (`useBeforeUnload(autoSave.isDirty, ...)` añade listener beforeunload que setea `e.returnValue`) |
| 20 | Abrir un recurso con cambios locales previos: aparece `RecoverDraftModal`. | ⚙ (effect al mount con `savedId`: lee `loadLocalAutosave(key)`; si hay y tiene >2s de edad, setea `recoverState='found'`) |
| 21 | "Recuperar cambios": el wizard carga los datos de localStorage. | ⚙ (`handleRecoverDraft` llama `applyWizardSnapshot` + `clearLocalAutosave` + markDirty) |
| 22 | "Descartar": borra localStorage y sigue con lo que hay en BD. | ⚙ (`handleDiscardDraft` solo llama `clearLocalAutosave`) |
| 23 | Saltar de paso con cambios: se fuerza autosave antes del cambio. | ⚙ (`handleNavigate` hace `await autoSave.forceSave()` si `autoSave.isDirty`) |
| 24 | Móvil (<900px): botones solo muestran indicadores numéricos. | ⚙ (media queries en `wizard-global.css`) |
| 25 | Móvil (<560px): stepper compacto de 7 círculos. | ⚙ (media queries en `wizard-global.css`) |

## Tests especiales

### Autosave offline
1. Abre un recurso existente en el wizard, edita un campo.
2. Desactiva wifi (o tira la Network en DevTools).
3. Espera 30+ s.
4. `AutoSaveIndicator` debe mostrar "Sin conexión" (status `offline`).
5. DevTools → Application → Local Storage → debe existir la clave
   `resource-autosave-{uuid}` con `{ savedAt, data }`.
6. Reactiva wifi.
7. El indicador pasa a "Guardando…" → "Guardado hace un momento".
8. La clave de localStorage se borra.

### Recuperación de sesión (error 500)
1. Abre un recurso existente, edita un campo.
2. Con DevTools → Network → bloquea `recurso_turistico` UPDATE (o
   temporalmente cambia el `onSave` para lanzar).
3. Espera 30 s: el autosave falla, localStorage queda con el cambio.
4. Cierra la pestaña.
5. Reabre el recurso.
6. Aparece `<RecoverDraftModal>` con "Encontramos cambios locales sin
   guardar del {fecha}".
7. "Recuperar": el campo editado aparece en el wizard.
8. Volver a cerrar/abrir → el modal YA NO aparece (localStorage limpio).

## Deuda abierta

- **Legacy `autoSavedToast` duplicado**: el toast "Borrador guardado
  automáticamente" del paso 0→1 (C6, del wizard pre-global) sigue
  renderizando. Decisión pragmática: se mantiene porque cubre el caso
  en el que el auto-save global aún no está activo (requiere savedId).
  Unificación pendiente: mover el C6 a `useAutoSave` como evento
  "first-save" y quitar el toast inline.

- **`handleFinish` NO pasa por el autosave**: el botón "Finalizar" del
  Wizard legacy llama `onFinish` directo que hace el upsert completo
  via admin edge function. El autosave global solo maneja UPDATE directo
  por supabase-js. Si se guarda con el botón "Finalizar" y después con
  autosave, la segunda escritura sobreescribe `updated_at` en BD; no
  hay conflicto de datos porque el payload del autosave es un subset
  del admin.updateResource, pero hay una inconsistencia de canales que
  conviene documentar.

- **`log_cambios` no registra cambios del autosave**: cada escritura
  del autosave es un UPDATE silencioso vía supabase-js sin llamar a
  `logAudit`. El panel "Historial" del paso 7b no los ve. Decisión
  post-MVP: trigger Postgres AFTER UPDATE que inserte 'modificar' con
  los `fields` del diff.

- **Recuperación vs `updated_at`**: el prompt template sugería comparar
  `local.savedAt` con `initialResource.updated_at` para decidir si
  ofrecer recuperar. Hoy simplificamos: si hay local y tiene >2s de
  edad, ofrecemos recuperar. Puede haber falsos positivos si el
  servidor es más reciente (el usuario tenía un local de una sesión
  vieja que ya fue superada en BD por otro editor). Mejora futura: leer
  `r.updated_at` en el loader y descartar `local` si es anterior.

- **`useAutoSave.enabled=false` cuando `recoverState.kind !== 'none'`**:
  mientras el modal de recovery está abierto no se autosave. Justo es
  lo que queremos (no escribir nada hasta que el usuario decida), pero
  es sutil: si el usuario deja el modal abierto y edita (imposible
  porque el modal es modal, pero aún así), se perdería. La guard es
  correcta pero frágil.

- **Navegación por teclado global**: las flechas ←/→ para saltar entre
  pasos NO están implementadas (mejora del prompt futuro section). El
  stepper responde a Tab/Enter sobre cada botón, pero un atajo global
  mejoraría la UX del editor experto.
