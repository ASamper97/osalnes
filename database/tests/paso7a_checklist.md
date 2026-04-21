# Checklist E2E · Paso 7a del wizard (rediseño revisión)

Estado tras aplicar las 4 tareas del prompt `08_paso7a_review.md` sobre
el código del repo. Los 18 puntos del
`ResourceWizardPage.step7a.integration.md §6` se evalúan aquí.

> ⚙ = verificado estáticamente en el código (no requiere browser).
> 👁 = requiere smoke test manual en el CMS.

**Sin migración de BD** en 7a. Tampoco hay deploys de edge functions (el
motor es offline).

| # | Punto | Estado |
|---|---|---|
| 1 | Al entrar al paso 7, arriba se ve el **ScoreDashboard con nota 0-100** coloreada por tramo. | 👁 (el componente se monta condicionalmente a `currentStep === 6`; `ScoreDashboard` recibe `report` del `useMemo(auditResource)`) |
| 2 | Las 6 tarjetas (Identificación, Contenido, Ubicación, Clasificación, Multimedia, SEO) muestran estado **honesto** (verde/amarillo/rojo) según checks reales. | ⚙ (`StepCard` lee `report.byStep[step].status` de `aggregateByStep` en quality-engine; `StepStatus` se computa a partir de `failCount/warnCount/passCount`) |
| 3 | Las tarjetas listan hasta 3 problemas concretos con marca ✗/⚠. | ⚙ (el componente filtra `report.checks` por `stepRef` y corta al top 3 por weight) |
| 4 | "Editar" en cualquier tarjeta → salta al paso correspondiente. | ⚙ (`handleGoToStep` mapea QualityStep → currentStep 0-indexed: identification=0, …, seo=5) |
| 5 | Tarjeta PID **plegada por defecto**. | ⚙ (`PidCompletenessCard` inicia con `expanded=false`; decisión 3-B) |
| 6 | Expandir PID → obligatorios con valor en verde "✓ OBLIGATORIO"; faltantes en rojo. | ⚙ (el componente usa `isMandatory + isFilled` de cada `PidGroup`) |
| 7 | Cada grupo PID con **una frase de explicación**. | ⚙ (copy en `step7-review.copy.ts` → `pidGroups[key].explanation`) |
| 8 | Bug "Multimedia: Disponible tras guardar" **ya no aparece**. | ⚙ (JSX del paso 7 legacy con `savedId ? 'Disponible' : 'Disponible tras guardar'` borrado en t2; el nuevo motor audita el paso 5 por contenido real — imageCount, primaryImageId, alt missing) |
| 9 | Tildes correctas en todo el paso. | ⚙ (copy del paso 7 centralizado en `step7-review.copy.ts`, con acentos correctos) |
| 10 | Checkbox "Visible en el mapa público" sigue funcionando y guarda al cambiarlo. | ⚙ (`onChangeVisibleOnMap` → `setVisibleOnMap + markDirty`) |
| 11 | Botón **"Publicar recurso"** abre el **modal de confirmación** con problemas listados. | ⚙ (`handlePublishClick` fuerza `setModalOpen(true)` incluso si todo está limpio — decisión 6-A) |
| 12 | Errores críticos → botón primario rojo "Publicar pese a los errores". | ⚙ (`PublishModal` elige variante según `report.criticalCount > 0`) |
| 13 | Solo warnings → botón naranja "Publicar de todos modos". | ⚙ (variante según `report.warnCount > 0 && criticalCount === 0`) |
| 14 | Todo limpio → botón verde "Publicar ahora". | ⚙ (variante `clean` cuando ambos counts son 0) |
| 15 | "Volver a corregir" cierra el modal sin publicar. | ⚙ (`onCancel` limpia estado) |
| 16 | Escape o clic en backdrop cierran el modal. | ⚙ (handlers ESC + backdrop click en `PublishModal`) |
| 17 | "Guardar como borrador" persiste sin abrir modal. | ⚙ (`handleSaveDraft` → `onSaveDraft()` directo sin `setModalOpen`) |
| 18 | Al arreglar un problema en un paso anterior y volver al 7, la **auditoría recalcula en vivo** (score sube). | ⚙ (el `useMemo(auditResource, [snapshot])` del componente depende del snapshot del padre, que a su vez depende de los 22+ estados del wizard — cualquier cambio re-renderiza) |

> **Extra no numerado**: Móvil (<760px): dashboard apilado, tarjetas en 1
> columna, modal fullscreen. → ⚙ (media queries en `step7-review.css`)

## Acciones pendientes para smoke test

Sin deploys ni migración. Para validar los 👁:

1. Crear o editar un recurso hasta el paso 7.
2. Verificar ScoreDashboard arriba, 6 StepCards, PID plegada abajo.
3. Ir al paso 2 y borrar la descripción ES → volver al paso 7:
   - Score debe bajar.
   - Tarjeta Contenido debe pasar a rojo/amarillo.
4. Rellenar de nuevo → score sube.
5. Pulsar "Publicar recurso" → modal aparece siempre.
6. Si hay errores críticos, confirmar que el botón es rojo y el copy
   "Publicar pese a los errores".
7. ESC cierra el modal; clic en backdrop también.
8. "Guardar como borrador" no abre modal y persiste.

## Deuda abierta

- **Prefijos de tags UNE**: el componente cuenta grupos PID con prefijos
  `tipo-turismo.`, `caracteristicas.`, `servicios.`, `gastronomia.`,
  `curaduria-editorial.`, `caracteristicas.accesible-*`. En el catálogo
  actual del repo existen `caracteristicas.*` (incluyendo los 5 tags
  accesibilidad del paso 4 · t3); `tipo-turismo`, `servicios`,
  `gastronomia` y `curaduria-editorial` son **no-op** si no hay datos.
  El componente los contará como `0` sin romperse, pero si producto añade
  esos grupos al catálogo, el PID card los recogerá automáticamente.

- **Distinción borrador vs. publicado**: los dos botones del paso 7a
  (Guardar borrador / Publicar) delegan hoy en el mismo `handleFinish`
  legacy. El paso 7b añade migración 025 con `publication_status` +
  `published_at` + `scheduled_publish_at` y separa los handlers.

- **ActivityTimeline fuera del componente**: se mantiene renderizado
  después del Step7Review pero fuera de él (historial editorial, no
  auditoría). El paso 7b lo integrará en un panel plegable propio con
  lectura de `audit_log`.

- **Motor no cubre tag editorial 'curaduria-editorial.*'**: el catálogo
  UNE de este repo no tiene el grupo (sería no-op; ver paso 4 · t3).
  Cuando producto añada tags editoriales, el motor los tratará como
  `editorial` (no PID-exportable, igual que en paso 4 · t6).

- **Motor no lee cache entre renders**: cada cambio de cualquier state
  del wizard recomputa la auditoría completa. Los 20+ checks son O(1)
  cada uno, así que el coste es despreciable (≤1ms); si en el futuro
  se añaden checks costosos (regex complejos, diffs con BD), conviene
  memoizar por sub-slice del snapshot.
