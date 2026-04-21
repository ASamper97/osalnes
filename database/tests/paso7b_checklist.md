# Checklist E2E · Paso 7b del wizard (revisión avanzada)

Estado tras aplicar las 6 tareas del prompt `09_paso7b_advanced.md`. Los
14 puntos del `ResourceWizardPage.step7b.integration.md §8` se evalúan
aquí, más la verificación T6 del audit_log.

> ⚙ = verificado estáticamente en el código.
> 👁 = requiere smoke test manual en el CMS desplegado.

| # | Punto | Estado |
|---|---|---|
| 1 | Migración 025 aplicada. Existen `scheduled_publish_at`/`published_at`/`published_by` + RPC `publish_scheduled_resources()`. | ⚙ (verificado 2026-04-22: 3 columnas, 2 constraints, RPC devuelve 0) |
| 2 | pg_cron programado (opción A elegida; Edge Function `publish-scheduled` no desplegado — queda como fallback). | 👁 (aplicar `database/migrations/025_scheduled_publication.cron.sql` una sola vez tras activar la extensión pg_cron; confirmar con `select * from cron.job where jobname='publish-scheduled-every-15min'`) |
| 3 | Badge de estado actual visible en el header del paso 7 (Borrador / Programado / Publicado / …). | ⚙ (`<StatusBadge>` en `ResourceWizardStep7Review` lee `publicationStatus` con formato Spanish tras t3) |
| 4 | Si el recurso está programado, el badge muestra fecha/hora prevista. | ⚙ (`status === 'programado' && scheduledAt` → `STEP7_COPY.statusBadge.scheduled`) |
| 5 | Panel "Sugerencias de la IA" debajo del dashboard de score. | ⚙ (Step7Review renderiza `<ImprovementSuggestions>` tras `<ScoreDashboard>` y antes de `<StepCard>` grid) |
| 6 | Botón "Pedir sugerencias" desactivado si la descripción <50 chars. | ⚙ (prop `hasEnoughContent={snapshot.descriptionEs.trim().length > 50}`) |
| 7 | Al pulsar, la IA tarda 3-6s y devuelve sugerencias agrupadas por paso. | 👁 (requiere deploy ai-writer · t3 + GEMINI_API_KEY; el edge corto-circuita si descEs < 50 chars) |
| 8 | Cada grupo tiene botón "Ir al paso" que salta al paso correspondiente. | ⚙ (`onGoToStep` se pasa al componente y el Step7Review ya lo tenía cableado desde 7a) |
| 9 | Modal de publicación con 2 tabs: "Publicar ahora" / "Programar publicación". | ⚙ (`PublishModal.tsx` mode-toggle `'now' | 'scheduled'`) |
| 10 | Tab "Programar" revela `<SchedulePublishPicker>`. | ⚙ (renderizado condicional `mode === 'scheduled' && <SchedulePublishPicker>`) |
| 11 | No deja programar fecha en pasado: min = ahora + 5 min. | ⚙ (`minScheduleDateTime()` en `publication-status.ts`, usado como `min` del `<input type="datetime-local">`) |
| 12 | Confirmar "Programar" → recurso pasa a estado_editorial='programado', scheduled_publish_at guardado. | 👁 (handler `handleSchedulePublish(utcIso)` UPDATE directo via supabase-js; requiere RLS authenticated) |
| 13 | Al llegar la hora, el cron publica el recurso → estado_editorial='publicado', published_by=null. | 👁 (depende de que pg_cron esté ejecutando la RPC cada 15 min; test especial: programar 2 min en el futuro y esperar hasta 17 min para ver el cambio) |
| 14 | Panel "Historial de cambios" plegable al final del paso 7; al expandir carga las últimas entradas. | ⚙ (`<AuditLogPanel>` con lazy-load via `onLoadAuditLog`; panel inicia collapsed) |
| 15 | Cada entrada muestra acción/fecha relativa/actor/campos modificados. | ⚙ (los 4 campos del shape `AuditEntry` se renderizan si no son null) |
| 16 | Copy con tildes correctas. | ⚙ (copy en `step7-review.copy.ts`; labels del AuditLogPanel en Spanish tras t3) |
| 17 | Responsive <760px funciona en todos los bloques nuevos. | ⚙ (media queries en `step7-review.css`) |

## Acción requerida ANTES del smoke test — configurar pg_cron (T2)

1. **Activar extensión** en Dashboard → Database → Extensions → buscar
   `pg_cron` → toggle ON. Supabase lo preinstala; solo hay que activarlo.
2. **Aplicar** [025_scheduled_publication.cron.sql](database/migrations/025_scheduled_publication.cron.sql)
   en SQL Editor (una sola vez).
3. **Verificar**:
   ```sql
   select jobid, schedule, command, active
   from cron.job
   where jobname = 'publish-scheduled-every-15min';
   ```
   Debe devolver 1 fila con `active = true` y schedule `*/15 * * * *`.

Si pg_cron no está disponible en tu plan Supabase, fallback a opción B:
`npx supabase functions deploy publish-scheduled` + configurar un cron
externo (GitHub Actions, Cron Triggers de Cloudflare, etc.) que llame
al Edge Function con el header `Authorization: Bearer ${CRON_SECRET}`.

## Acciones pendientes para smoke test

```bash
npx supabase functions deploy ai-writer   # paso 7b · t3
# admin y api ya están desplegados con los mapper cambios de t4 si lo
# hiciste en sesión anterior; si no:
npx supabase functions deploy admin api
```

## T6 — Verificación de `audit_log` (log_cambios)

El panel `AuditLogPanel` lee la tabla **`log_cambios`** (NO `audit_log`
como decía el prompt template). Esta tabla ya existe desde la migración
001 con este shape:

```sql
log_cambios (
  id            uuid PRIMARY KEY,
  entidad_tipo  varchar(50),     -- 'recurso_turistico'
  entidad_id    uuid,
  accion        varchar(20) CHECK (accion IN (
    'crear', 'modificar', 'eliminar', 'publicar', 'archivar',
    -- migración 013 amplió con: 'enviar_revision', 'devolver', 'reactivar'
  )),
  usuario_id    uuid REFERENCES usuario(id),
  cambios       jsonb,           -- { fields: [...] } para modificar
  created_at    timestamptz
)
```

El handler `handleLoadAuditLog` del paso 7b · t4 query:

```sql
select id, created_at, accion, cambios, usuario:usuario_id(email)
from log_cambios
where entidad_tipo = 'recurso_turistico'
  and entidad_id = $savedId
order by created_at desc
limit 20;
```

Y mapea a `AuditEntry { id, createdAt, action, actor, changedFields }`.

**Estado de población de la tabla:**
- La edge function `admin/createResource` llama `logAudit(sb, 'recurso_turistico', data.id, 'crear', usuarioId, {...})` (línea ~790) → `crear` entries SÍ se registran.
- Las acciones de paso 7b (`handlePublishNow`, `handleSchedulePublish`) escriben directamente en la tabla `recurso_turistico` SIN insertar fila en `log_cambios`. El panel NO mostrará estas acciones hasta que se añadan triggers Postgres o llamadas explícitas a `logAudit`.
- El cron `publish_scheduled_resources()` también publica sin dejar rastro en `log_cambios`.

**Recomendación para iteración futura** (no bloqueante):
1. Trigger `AFTER UPDATE OF estado_editorial ON recurso_turistico` que inserte `log_cambios` con `accion` derivada (`publicar`, `archivar`, `programar`, `publicar_programado`).
2. O añadir llamadas `logAudit` dentro de `handlePublishNow`/`handleSchedulePublish`/RPC.

Hasta entonces el panel muestra solo entradas de `crear` / `modificar` /
`enviar_revision` / `devolver` / `reactivar` (las que hoy sí escriben
via admin edge function).

## Deuda abierta

- **Triggers de audit_log para paso 7b**: ver sección T6 arriba. Las
  acciones de publicación programada no dejan rastro hoy; el panel
  muestra un subset del historial real.

- **`published_by` del cron siempre NULL**: la RPC `publish_scheduled_resources()`
  setea `published_by = null` como convención "publicó el sistema". Si se
  quiere distinguir entre "sistema" y "usuario desconocido", añadir una
  columna `published_source enum('manual','scheduled','import')` o
  similar en iteración futura.

- **ActivityTimeline + AuditLogPanel duplicados**: el paso 7 renderiza
  los dos componentes a la vez (ActivityTimeline fuera + AuditLogPanel
  dentro del Step7Review). Unificar en el siguiente pase moviendo toda
  la vista histórica al AuditLogPanel y borrando ActivityTimeline.

- **`canTransition` ↔ STATE_TRANSITIONS divergen**: hoy tenemos 2
  matrices de transición (publication-status.ts + EditorialStatusBar.tsx)
  que deben mantenerse sincronizadas a mano. Refactor pendiente: una
  sola fuente de verdad en shared.

- **Supabase RLS del UPDATE del paso 7b**: los handlers `handlePublishNow`
  y `handleSchedulePublish` hacen UPDATE directo vía supabase-js. Requiere
  que RLS policy permita al usuario authenticated escribir
  `estado_editorial`/`scheduled_publish_at` en `recurso_turistico`. Si
  en producción la policy restringe escritura a admin edge function,
  mover los 2 handlers a pasar por admin PATCH con whitelist ampliado.
