# Prompt maestro · Wizard global (stepper + autosave + recuperación)

**Pega este contenido en Claude Code.**

Mejoras transversales del wizard de recursos. NO es un paso más; afecta
al orquestador `ResourceWizardPage.tsx` que coordina los 7 pasos.

Debe aplicarse DESPUÉS de pasos 0, 2, 3, 4, 5, 6, 7a, 7b.

---

## Cambios

1. **Stepper clickable** — los 7 cuadrados del stepper pasan a ser
   botones. Cada uno con estado visual: bloqueado 🔒, accesible,
   actual, completo ✓, dirty (con punto naranja pulsante).

2. **Política de navegación opción A** — pasos 1 y 2 obligatorios y
   secuenciales; tras ellos, todos los pasos navegables libremente en
   cualquier orden.

3. **Porcentaje coherente** — fix del bug "paso 7 de 7 = 86%". Ahora
   calcula bien `current / total * 100`.

4. **Auto-save cada 30 segundos** — hook `useAutoSave` con debounce,
   detecta offline, guarda en localStorage como fallback, indicador
   visual arriba.

5. **Recuperación de sesión previa** — si el funcionario cerró el
   navegador con cambios locales sin sincronizar, al volver a abrir el
   recurso aparece un modal "¿Recuperar cambios no guardados?".

6. **Aviso al salir** — `beforeunload` nativo si hay cambios pendientes.

## Decisiones aplicadas

- **A** · Política de navegación: pasos 1 y 2 obligatorios primero,
  después libre (confirmada por el usuario).

## Ficheros en el repo

```
osalnes-dti/
├── packages/shared/src/data/
│   └── wizard-navigation.ts           ← reglas + computeProgressPercent
│
├── packages/cms/src/
│   ├── components/
│   │   ├── WizardStepper.tsx          ← stepper clickable
│   │   ├── AutoSaveIndicator.tsx      ← pill "Guardado / Guardando..."
│   │   └── RecoverDraftModal.tsx      ← modal recuperación sesión previa
│   ├── hooks/
│   │   ├── useAutoSave.ts             ← hook con debounce y offline
│   │   └── useBeforeUnload.ts         ← aviso al cerrar pestaña
│   └── pages/
│       ├── wizard-global.css
│       └── ResourceWizardPage.global.integration.md
│
└── prompts/
    └── 10_wizard_global.md            ← este fichero
```

**Sin migración de BD.** Todo el valor está en el orquestador del
wizard.

---

## Tareas en orden

### Tarea 1 · Verificar que shared compila

```bash
pnpm --filter @osalnes/shared typecheck
```

**Criterio**: el fichero `wizard-navigation.ts` compila sin errores.

### Tarea 2 · Integrar en ResourceWizardPage.tsx

Seguir la guía en
`packages/cms/src/pages/ResourceWizardPage.global.integration.md`
(secciones 1-10).

**Puntos críticos**:

- Sección 3: construir `NavigationContext` con `step1Complete` y
  `step2Complete` bien calculados. Si un paso obligatorio no está
  completo, bloquea el resto.

- Sección 6: el payload del autosave NO debe tocar
  `publication_status`, `published_at`, ni `scheduled_publish_at`.
  Estos campos solo se modifican por los handlers explícitos de
  publicación del paso 7b.

- Sección 7: `useBeforeUnload(autoSave.isDirty, ...)`. Solo bloquear
  salida cuando hay cambios reales.

- Sección 8: al montar el wizard en edición, comprobar localStorage
  ANTES de hidratar el estado desde BD. Si hay local más reciente,
  preguntar al usuario.

### Tarea 3 · Borrar el stepper legacy

Eliminar de `ResourceWizardPage.tsx`:
- El JSX con los 7 cuadrados estáticos del stepper superior.
- La barra de progreso legacy (que calcula mal el %).
- Cualquier `<p>Paso X de 7 — NN%</p>` hardcoded.

Lo sustituye `<WizardStepper>` + el progreso está dentro de él.

### Tarea 4 · Test E2E

Ejecutar los 25 puntos del checklist en el integration.md sección 12.

**Test especial del autosave offline**:
1. Abrir el wizard y editar un campo.
2. Desactivar wifi.
3. Esperar 30+ segundos.
4. Verificar que el `AutoSaveIndicator` muestra "Sin conexión" y que
   `localStorage` tiene la clave `resource-autosave-{id}`.
5. Reactivar wifi.
6. Verificar que se sincroniza automáticamente y el indicador pasa a
   "Guardado".

**Test especial de recuperación de sesión**:
1. Abrir un recurso existente, editar un campo.
2. Cortar manualmente Supabase (o forzar un error 500 en el onSave).
3. Cerrar la pestaña (el autosave local tiene el cambio).
4. Reabrir el recurso.
5. Aparece `RecoverDraftModal`.
6. "Recuperar": el campo editado vuelve a estar.
7. "Descartar": el campo vuelve a su valor de BD.

---

## Lo que NO tocar

- Los 7 pasos del wizard (cada uno ya integrado).
- El backend: no hay columnas nuevas ni cambios de esquema.
- Los handlers de publicación del paso 7b (autosave los ignora).

## Mensajes de commit sugeridos

```
feat(shared): wizard-navigation · reglas + computeProgressPercent (wizard-global · t1)
feat(cms): stepper clickable + autosave 30s + recuperación sesión previa (wizard-global · t2)
chore(cms): eliminar stepper legacy con porcentaje incorrecto (wizard-global · t3)
docs: checklist E2E wizard global (wizard-global · t4)
```

---

## Mejoras derivadas (no incluidas aquí, iteración futura)

- Navegación con teclado global (flechas izq/der entre pasos).
- Tooltip del % con detalle: "2 errores, 3 avisos" al pasar por encima.
- Exportar/importar borrador entre dispositivos (QR con datos
  serializados).
