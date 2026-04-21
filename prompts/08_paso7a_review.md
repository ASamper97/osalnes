# Prompt maestro · Rediseño Paso 7a "Revisión"

**Pega este contenido en Claude Code.**

Rediseño del paso 7 (Revisión) en **dos entregables**:

- **7a (este)**: motor de calidad global + QualityReport + checkmarks
  honestos + modal confirmación + PID card plegada + copy + orden nuevo.
- **7b (siguiente)**: publicación programada + historial + IA sugerencias.

Se ejecuta después de pasos 0, 2, 3, 4, 5 y 6.

---

## Contexto del cambio

El paso 7 actual tiene 10 problemas concretos detectados en la captura:

1. Tildes faltantes en todo el paso.
2. Tarjeta "Completitud semántica PID" confusa mezclando obligatorios
   rojos con contadores grises opcionales sin contexto.
3. Bug de cableado: `Tipo schema.org` y `Municipio` salen como
   "INCOMPLETO" cuando el recurso SÍ los tiene rellenados en el paso 1.
4. Checkmarks verdes falsos: las 6 tarjetas (Identificación, Contenido...)
   muestran ✓ solo por "has pasado por el paso", no por calidad real.
5. Tarjeta Multimedia muestra "Estado: Disponible tras guardar" (bug
   legacy del paso 5 antiguo que debería haber desaparecido al
   completarse el paso 5).
6. Falta un resumen global ("Tu recurso está al 72%, corrige N errores").
7. La acción de publicar no es explícita, el botón pone solo "Crear
   recurso" sin distinguir borrador/publicado.
8. No hay confirmación modal si hay errores críticos al publicar.
9. Orden de info no óptimo: opciones de publicación arriba, resumen
   técnico mezclado en medio.
10. "Evaluar calidad con IA" es redundante con el motor local que
    hicimos en el paso 6.

## Solución (decisiones del usuario)

- **1-C** alcance amplio: QualityReport global + publicación programada
  (va en 7b) + historial (va en 7b) + IA sugerencias (va en 7b)
- **2-A** reordenar: resumen arriba, publicación abajo.
- **3-B** mantener PID card con contadores, pero plegada por defecto y
  con una frase explicativa por grupo.
- **4-A** publicación programada (va en **7b**).
- **5-A** historial de cambios (va en **7b**).
- **6-A** confirmación modal siempre si hay problemas, con botón
  "Publicar de todos modos".
- **7-B** motor global `ResourceQualityEngine` que reutiliza y amplía
  `seo-audit.ts` del paso 6.

## Ficheros ya escritos en el repo

```
osalnes-dti/
├── packages/shared/src/data/
│   └── quality-engine.ts                  ← motor global (amplía seo-audit)
│
├── packages/cms/src/
│   ├── components/
│   │   ├── ScoreDashboard.tsx
│   │   ├── StepCard.tsx
│   │   ├── PidCompletenessCard.tsx
│   │   └── PublishModal.tsx
│   └── pages/
│       ├── ResourceWizardStep7Review.tsx
│       ├── step7-review.copy.ts
│       ├── step7-review.css
│       └── ResourceWizardPage.step7a.integration.md
│
└── prompts/
    └── 08_paso7a_review.md                ← este fichero
```

**Sin migración de BD** en 7a. La tabla `resources` ya tiene todos los
campos que el motor lee.

---

## Tareas en orden

### Tarea 1 · Verificar que todos los shared imports existen

El `quality-engine.ts` importa de:
- `./seo-audit` (paso 6, ya aplicado)
- `./seo` (paso 6, ya aplicado)
- `./opening-hours` (paso 3, ya aplicado)
- `./establishment-fields` (paso 4, ya aplicado)

```bash
pnpm --filter @osalnes/shared typecheck
```

**Criterio**: pasa sin errores.

### Tarea 2 · Integrar `ResourceWizardStep7Review` en `ResourceWizardPage`

Seguir la guía en
`packages/cms/src/pages/ResourceWizardPage.step7a.integration.md`,
secciones 1-5.

Lo más importante es el **`useMemo` que construye el `ResourceSnapshot`**
combinando todos los estados dispersos del wizard padre (sección 2 del
integration.md). Sin esto, el motor no puede auditar.

### Tarea 3 · Borrar código legacy del paso 7

En `ResourceWizardPage.tsx` quitar:
- El JSX antiguo del paso 7 (6 tarjetas inline + tarjeta PID inline).
- El bloque "Estado: Disponible tras guardar" de la tarjeta Multimedia.
- El botón "Evaluar calidad con IA" (el motor local es suficiente).
- Código de cálculo de "completitud PID" antiguo que sobreescribía el
  estado de los obligatorios incorrectamente (bug 3 del análisis).

### Tarea 4 · Test E2E

Ejecutar el checklist de 18 puntos del integration.md sección 6.

Tres puntos críticos:
1. Score recalcula en vivo al corregir problemas en pasos anteriores.
2. Modal de publicación aparece siempre y cambia color según el estado.
3. Tarjeta PID plegada por defecto con explicaciones por grupo.

---

## Lo que NO tocar

- Pasos 1-6.
- Campos de la tabla `resources` (nada nuevo en 7a).
- El botón "Evaluar con IA" no lo borramos físicamente si tiene otra
  utilidad — simplemente deja de estar visible en el paso 7.

## Mensajes de commit sugeridos

```
feat(shared): motor global de calidad ResourceQualityEngine (paso 7a · t1)
feat(cms): paso 7 rediseño · ScoreDashboard + checkmarks honestos + modal publicación (paso 7a · t2)
chore(cms): eliminar JSX legacy paso 7 y bug 'Disponible tras guardar' (paso 7a · t3)
docs: checklist E2E paso 7a (paso 7a · t4)
```

---

## Próxima sesión: Paso 7b

Cuando este paso 7a esté integrado y funcionando, el paso 7b añadirá:

- **Migración 025**: columnas `publish_at` + `published_by` +
  `published_at` + `scheduled_publish_at`.
- **Edge Function cron** que publica automáticamente los recursos
  programados (corre cada 15 min).
- **Selector fecha+hora** en el componente con timezone Europe/Madrid.
- **Panel "Últimos cambios"** plegable leyendo `audit_log`.
- **Nueva action IA** `suggestImprovements` que lee el recurso entero y
  devuelve sugerencias concretas por paso.
