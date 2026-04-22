# Integración · Wizard global en `ResourceWizardPage.tsx`

Este NO es un paso más del wizard; son mejoras TRANSVERSALES que
afectan al orquestador global (`ResourceWizardPage.tsx`) y a cómo el
funcionario navega entre pasos.

---

## 1) Importar los nuevos módulos

```tsx
import WizardStepper from '../components/WizardStepper';
import AutoSaveIndicator from '../components/AutoSaveIndicator';
import RecoverDraftModal from '../components/RecoverDraftModal';
import { useAutoSave, loadLocalAutosave, clearLocalAutosave } from '../hooks/useAutoSave';
import { useBeforeUnload } from '../hooks/useBeforeUnload';
import {
  buildStepperState,
  canNavigateToStep,
  TOTAL_STEPS,
  type NavigationContext,
} from '@osalnes/shared/data/wizard-navigation';
import '../pages/wizard-global.css';
```

## 2) Estado nuevo

```tsx
// Dirty tracking por paso (qué pasos tienen cambios no guardados)
const [dirtySteps, setDirtySteps] = useState<Set<number>>(new Set());

// Recuperación de sesión previa
const [recoverState, setRecoverState] = useState<
  | { kind: 'checking' }
  | { kind: 'found'; localSavedAt: string; localData: any }
  | { kind: 'none' }
>({ kind: 'checking' });
```

## 3) Definir el `NavigationContext` para el stepper

```tsx
const navigationContext: NavigationContext = useMemo(() => ({
  currentStep,
  resourceId,
  // Paso 1 completo si están los 3 campos obligatorios
  step1Complete: !!(mainTypeKey && nameEs.trim() && selectedMunicipioId),
  // Paso 2 completo si hay descripción ES con mínimo funcional
  step2Complete: descriptionEs.trim().length >= 20,
  dirtySteps,
  // Pasos completos según el quality-engine del 7a (pasa cada check)
  completeSteps: new Set<number>([
    // Derivado del QualityReport: un paso es 'complete' si su agregado
    // está en 'ok' o 'warn' (no 'fail' ni 'empty')
    ...Array.from(
      qualityReport ? computeCompleteStepsFromReport(qualityReport) : []
    ),
  ]),
}), [
  currentStep, resourceId, mainTypeKey, nameEs, selectedMunicipioId,
  descriptionEs, dirtySteps, qualityReport,
]);

// Helper para derivar pasos completos desde el QualityReport
function computeCompleteStepsFromReport(report: QualityReport): number[] {
  const stepKeyToNumber: Record<string, number> = {
    identification: 1, content: 2, location: 3,
    classification: 4, multimedia: 5, seo: 6,
  };
  const complete: number[] = [];
  for (const [key, agg] of Object.entries(report.byStep)) {
    if (agg.status === 'ok' || agg.status === 'warn') {
      complete.push(stepKeyToNumber[key]);
    }
  }
  return complete;
}
```

## 4) Estado de los pasos del stepper

```tsx
const stepperState = useMemo(
  () => buildStepperState(navigationContext),
  [navigationContext],
);
```

## 5) Handler de navegación validado

```tsx
async function handleNavigate(targetStep: number) {
  if (targetStep === currentStep) return;

  const { allowed, reason } = canNavigateToStep(targetStep, navigationContext);
  if (!allowed) {
    // Opcional: mostrar toast con la razón
    // showToast(reason ?? 'No se puede saltar a ese paso todavía');
    return;
  }

  // Guardar ANTES de cambiar de paso si hay cambios pendientes
  if (autoSave.isDirty) {
    await autoSave.forceSave();
  }

  // Marcar el paso actual como no-dirty (ya se guardó)
  setDirtySteps((curr) => {
    const next = new Set(curr);
    next.delete(currentStep);
    return next;
  });

  setCurrentStep(targetStep);
}
```

## 6) Auto-save

```tsx
// Payload a guardar en BD (todos los campos del recurso)
const autoSavePayload = useMemo(() => ({
  id: resourceId,
  main_type_key: mainTypeKey,
  name: nameEs,
  name_gl: nameGl,
  municipio_id: selectedMunicipioId,
  description_es: descriptionEs,
  description_gl: descriptionGl,
  // ... resto de campos dispersos del wizard ...
  seo_by_lang: seo.byLang,
  translations: seo.translations,
  keywords: seo.keywords,
  indexable: seo.indexable,
  publication_status: publicationStatus, // NO cambiar el status en autosave
}), [
  resourceId, mainTypeKey, nameEs, nameGl, selectedMunicipioId,
  descriptionEs, descriptionGl, /* ... */
  seo, publicationStatus,
]);

const autoSave = useAutoSave({
  data: autoSavePayload,
  enabled: resourceId != null,           // solo autosave tras primer guardado
  intervalMs: 30_000,                    // 30 segundos
  localStorageKey: resourceId ? `resource-autosave-${resourceId}` : undefined,
  onSave: async (data) => {
    const { error } = await supabase
      .from('resources')
      .update({
        ...data,
        // NO tocar publication_status, published_at, scheduled_publish_at
        // (autosave solo para borrador; la publicación usa handlers propios)
      })
      .eq('id', resourceId!);
    if (error) throw error;
  },
});

// Marcar el paso actual como dirty cuando hay cambios
useEffect(() => {
  if (autoSave.isDirty) {
    setDirtySteps((curr) => {
      if (curr.has(currentStep)) return curr;
      const next = new Set(curr);
      next.add(currentStep);
      return next;
    });
  }
}, [autoSave.isDirty, currentStep]);
```

## 7) Aviso al salir con cambios sin guardar

```tsx
useBeforeUnload(
  autoSave.isDirty,
  'Tienes cambios sin guardar. Espera unos segundos antes de cerrar.',
);
```

## 8) Recuperación de sesión previa

Al montar el wizard (solo en edición, cuando hay `resourceId`):

```tsx
useEffect(() => {
  if (!resourceId) {
    setRecoverState({ kind: 'none' });
    return;
  }
  const key = `resource-autosave-${resourceId}`;
  const local = loadLocalAutosave<typeof autoSavePayload>(key);

  if (!local) {
    setRecoverState({ kind: 'none' });
    return;
  }

  // Comparar con el remoto: si local es más reciente, ofrecer recuperar
  const remoteUpdatedAt = initialResource?.updated_at ?? null;
  if (remoteUpdatedAt && new Date(remoteUpdatedAt) >= new Date(local.savedAt)) {
    // BD más reciente o igual: descartar local
    clearLocalAutosave(key);
    setRecoverState({ kind: 'none' });
    return;
  }

  setRecoverState({
    kind: 'found',
    localSavedAt: local.savedAt,
    localData: local.data,
  });
}, [resourceId, initialResource]);

function handleRecover() {
  if (recoverState.kind !== 'found') return;
  // Aplicar `recoverState.localData` al estado del wizard
  applyWizardSnapshot(recoverState.localData);
  clearLocalAutosave(`resource-autosave-${resourceId}`);
  setRecoverState({ kind: 'none' });
}

function handleDiscard() {
  clearLocalAutosave(`resource-autosave-${resourceId}`);
  setRecoverState({ kind: 'none' });
}
```

## 9) Render del wizard con stepper nuevo

**Reemplazar el stepper visual actual** (los 7 cuadraditos con ✓) por:

```tsx
<header className="wizard-header">
  <div className="wizard-header-top">
    <h1>
      {resourceId ? 'Editar recurso' : 'Nuevo recurso turístico'}
    </h1>
    <div className="wizard-header-actions">
      <AutoSaveIndicator
        status={autoSave.status}
        lastSavedAt={autoSave.lastSavedAt}
        errorMessage={autoSave.errorMessage}
        onRetry={autoSave.forceSave}
      />
      <button type="button" className="btn btn-ghost" onClick={handleCancel}>
        Cancelar
      </button>
    </div>
  </div>
  <p className="wizard-header-subtitle">
    Te guiamos paso a paso para crear un recurso completo y bien documentado
  </p>
</header>

<WizardStepper
  stepsState={stepperState}
  currentStep={currentStep}
  onNavigate={handleNavigate}
/>

{/* Contenido del paso actual (sin cambios) */}
{currentStep === 1 && <ResourceWizardStep1 ... />}
{currentStep === 2 && <ResourceWizardStep2 ... />}
{/* ... */}

{/* Modal de recuperación si aplica */}
{recoverState.kind === 'found' && (
  <RecoverDraftModal
    localSavedAt={recoverState.localSavedAt}
    remoteSavedAt={initialResource?.updated_at ?? null}
    onRecover={handleRecover}
    onDiscard={handleDiscard}
  />
)}
```

## 10) Borrar el stepper legacy

El layout actual con los 7 cuadraditos verdes y la barra de progreso
superior (que marca 86% en el paso 7 de 7) queda obsoleto. Borrarlo
del JSX del wizard padre.

## 11) Consideraciones sobre `handleSaveDraft` manual (paso 7)

El paso 7 tiene un botón "Guardar como borrador" explícito. Debe
coordinarse con el auto-save:

- El botón manual fuerza guardado inmediato (`autoSave.forceSave()`).
- El autosave sigue corriendo en segundo plano.
- No hay riesgo de doble-save porque `useAutoSave` tiene un guard
  interno `savingRef`.

## 12) Checklist de aceptación

- [ ] El porcentaje de progreso es coherente. Paso 1 de 7 = 14%, paso 2 de 7 = 29%, ..., paso 7 de 7 = 100%.
- [ ] El stepper muestra 7 botones clickables (no 7 cuadraditos estáticos).
- [ ] En creación, al abrir el wizard, solo el paso 1 está accesible. El resto aparecen con candado 🔒.
- [ ] Tras completar el paso 1 (tipología + nombre + municipio), el paso 2 se desbloquea.
- [ ] Tras completar el paso 2 y guardar borrador, los pasos 3-7 quedan clickables.
- [ ] En edición (recurso con ID), todos los 7 pasos clickables desde el primer momento.
- [ ] Hover sobre un paso bloqueado: tooltip explicando qué falta.
- [ ] Clic en un paso accesible: salta a él inmediatamente.
- [ ] Clic en un paso bloqueado: no hace nada (ni error visual duro).
- [ ] Los pasos con datos completos muestran el indicador ✓ verde.
- [ ] Los pasos con cambios sin guardar muestran el **punto naranja pulsante** en la esquina.
- [ ] Al escribir en cualquier campo, se activa el dirty-dot en el paso actual.
- [ ] Después de ~30 segundos sin tocar nada, el autoguardado se ejecuta.
- [ ] El `AutoSaveIndicator` pasa por los estados: saving → saved → idle.
- [ ] Con wifi apagado, el `AutoSaveIndicator` muestra "Sin conexión" y los datos se guardan en localStorage.
- [ ] Al recuperar conexión, el autosave se sincroniza y el indicador vuelve a "saved".
- [ ] Si el autosave falla (error de servidor), aparece botón "Reintentar" en el indicador.
- [ ] Pulsar "Reintentar" llama a `forceSave()` y resincroniza.
- [ ] Cerrar pestaña con cambios sin guardar: aparece el diálogo nativo "¿Seguro que quieres salir?".
- [ ] Abrir un recurso en cuya sesión previa quedaron cambios locales: aparece `RecoverDraftModal`.
- [ ] "Recuperar cambios": el wizard carga los datos de localStorage en lugar de BD.
- [ ] "Descartar": borra el localStorage y sigue con lo que hay en BD.
- [ ] Saltar de paso con el stepper mientras hay cambios: se fuerza autosave antes del cambio.
- [ ] Móvil (<900px): los botones de paso solo muestran los indicadores numéricos (sin etiqueta).
- [ ] Móvil (<560px): el stepper se reduce a una fila compacta de 7 círculos.
