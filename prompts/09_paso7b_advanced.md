# Prompt maestro · Paso 7b "Revisión avanzada"

**Pega este contenido en Claude Code.**

Extensión del paso 7a (que debe estar aplicado ya). Añade publicación
programada, historial y sugerencias IA concretas.

---

## Decisiones aplicadas

- **4-A** · Publicación programada con fecha + hora (timezone Europe/Madrid)
- **5-A** · Historial de cambios en panel plegable leyendo `audit_log`
- **1-C** (parte IA) · Acción IA `suggestImprovements` con sugerencias concretas por paso

## Ficheros en el repo

```
osalnes-dti/
├── database/migrations/
│   ├── 025_scheduled_publication.sql
│   └── 025_scheduled_publication.down.sql
│
├── packages/shared/src/data/
│   └── publication-status.ts        ← enum + helpers fecha/hora
│
├── packages/cms/src/
│   ├── components/
│   │   ├── SchedulePublishPicker.tsx  (NUEVO)
│   │   ├── AuditLogPanel.tsx          (NUEVO)
│   │   ├── ImprovementSuggestions.tsx (NUEVO)
│   │   └── PublishModal.tsx           (SOBRESCRIBE 7a)
│   ├── lib/
│   │   └── ai.step7b.patch.ts       ← instrucciones patch
│   └── pages/
│       ├── ResourceWizardStep7Review.tsx  (SOBRESCRIBE 7a)
│       ├── step7-review.copy.ts           (SOBRESCRIBE 7a)
│       ├── step7-review.css               (SOBRESCRIBE 7a)
│       └── ResourceWizardPage.step7b.integration.md
│
├── supabase/functions/
│   ├── ai-writer/
│   │   └── index.suggestImprovements-action.patch.ts
│   └── publish-scheduled/
│       └── index.ts                 (NUEVO · Edge Function cron)
│
└── prompts/
    └── 09_paso7b_advanced.md        ← este fichero
```

---

## Tareas

### Tarea 1 · Migración 025 + RPC

```bash
npx supabase db push
```

**Criterio**: las 3 columnas nuevas existen (`scheduled_publish_at`,
`published_at`, `published_by`), el CHECK de `publication_status`
incluye `'scheduled'`, y `select public.publish_scheduled_resources()`
devuelve un integer.

### Tarea 2 · Configurar cron

**Decidir una de estas 3 opciones** (ver sección 2 del integration.md):

- **A (recomendada)**: `pg_cron` ejecutando el RPC cada 15 min.
- **B**: desplegar Edge Function `publish-scheduled` y programarla.
- **C**: GitHub Actions cron que llame al Edge Function.

La opción A es la más simple. Si hay pg_cron en el proyecto, usarla y
**no desplegar** el Edge Function (dejar el fichero sin usar).

### Tarea 3 · Patch AI cliente + Edge Function

- `packages/cms/src/lib/ai.ts` → añadir `aiSuggestImprovements` del patch.
- `supabase/functions/ai-writer/index.ts` → añadir action
  `suggestImprovements` del patch, con validación estricta de JSON.
- Desplegar: `npx supabase functions deploy ai-writer`

**Criterio**: llamada POST al ai-writer con `action:'suggestImprovements'`
devuelve `{suggestions: [...]}` o array vacío con un recurso pobre.

### Tarea 4 · Integrar en ResourceWizardPage

Seguir la guía del integration.md (secciones 5-6). Los puntos clave:

- Nuevos estados: `publicationStatus`, `scheduledPublishAt`, `publishedAt`.
- Nuevos handlers: `handlePublishNow`, `handleSchedulePublish`,
  `handleRequestAiSuggestions`, `handleLoadAuditLog`.
- El `handleLoadAuditLog` asume una tabla `audit_log` con ciertos
  campos. Verificar que coinciden con la realidad del repo y ajustar
  si no.

### Tarea 5 · Test E2E

Ejecutar los 14 puntos del checklist en integration.md sección 8.

**Test especial del cron**: programar un recurso 2 minutos en el futuro,
esperar, comprobar que pasa a 'published' automáticamente (si el cron
está a 15 min de intervalo, esperar hasta 17 minutos).

### Tarea 6 · Verificación del audit_log

El panel "Historial" asume una tabla `audit_log`. Si no existe:
- Opción rápida: dejar el panel vacío (muestra "Sin cambios registrados").
- Opción completa: crear la tabla + triggers en `resources` para que
  registre inserts/updates/deletes. Va en una migración aparte.

---

## Lo que NO tocar

- Pasos 1-6. El paso 7a tampoco — solo se AMPLÍAN sus ficheros.
- Las otras acciones IA (generateSeo, suggestTags, genAltText, etc.).

## Mensajes de commit sugeridos

```
feat(db): migración 025 · publicación programada + RPC publish_scheduled_resources (paso 7b · t1)
feat(infra): pg_cron para publicar programados cada 15 min (paso 7b · t2)
feat(edge): ai-writer.suggestImprovements · sugerencias concretas por paso (paso 7b · t3)
feat(cms): paso 7b · selector fecha programada + IA sugerencias + historial cambios (paso 7b · t4)
docs: checklist E2E paso 7b (paso 7b · t5)
```
