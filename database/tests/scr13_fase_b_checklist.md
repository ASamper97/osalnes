# Checklist E2E · SCR-13 Fase B · Drawer, retry, descargas, integración

Estado tras aplicar las 7 tareas del prompt `16_scr13_exportaciones_b.md`.
Cumple los bullets del pliego 5.1.7 que quedaban abiertos de Fase A:
relanzamiento idempotente (decisión 6-C), descarga de log (decisión 7-A),
integración con otros módulos (decisión 8-A).

> ⚙ = verificado estáticamente en el código / BD.
> 👁 = requiere smoke test manual en el CMS desplegado.

## Migración 031

Pendiente de aplicar por el usuario en SQL Editor (CLI da 403). No
requiere adaptación al esquema español — solo crea RPCs sobre
`export_jobs` / `export_job_records` (ya creadas en fase A).

| # | Artefacto | Estado |
|---|---|---|
| 1 | `exports_get_detail(uuid)` → table con job + error_summary por categoría. | ⚙ (código revisado) |
| 2 | `exports_get_records(uuid, status?, page, page_size)` → paginado filtrable. | ⚙ |
| 3 | `exports_get_record_payload(uuid)` → jsonb del payload individual. | ⚙ |
| 4 | `exports_get_payload_bundle(uuid)` → `{ job, records[], generated_at }` agregado. | ⚙ |
| 5 | `exports_get_log_text(uuid, sanitized=true)` → text plano, sanitiza emails si p_sanitized=true. | ⚙ |
| 6 | `exports_retry(uuid, mode='all')` → crea nuevo job heredando tipo y alcance del padre. | ⚙ |

**Smoke test post-aplicación** (reemplazar `<job_id>` por un id real):
```sql
-- Las 6 funciones existen
select count(*) from pg_proc
where proname in (
  'exports_get_detail', 'exports_get_records',
  'exports_get_record_payload', 'exports_get_payload_bundle',
  'exports_get_log_text', 'exports_retry'
) and pronamespace = 'public'::regnamespace;
-- Esperado: 6

select * from public.exports_get_detail('<job_id>');
select * from public.exports_get_records('<job_id>', null, 1, 10);
select length(public.exports_get_log_text('<job_id>', true));
```

## Shared · tipos y helper de descarga

| # | Punto | Estado |
|---|---|---|
| 7 | `packages/shared/src/data/exports-detail.ts` exporta `ExportJobDetail`, `ExportJobRecord`, `RetryMode`, `DrawerTab`, `downloadAsFile`, `buildDownloadFilename`. | ⚙ |
| 8 | Export `./data/exports-detail` registrado en `packages/shared/package.json`. | ⚙ |
| 9 | Import relativo a `./exports.js` con extensión explícita (NodeNext). | ⚙ |
| 10 | `downloadAsFile(content, filename, mimeType)` crea blob + link sintético + `URL.revokeObjectURL` tras el click. | ⚙ |
| 11 | `buildDownloadFilename({jobType, jobId, extension, startedAt})` → `osalnes-export-{type}-YYYYMMDD-HHMM-{short}.{ext}`. | ⚙ |

## Hook `useExportJobDetail`

| # | Punto | Estado |
|---|---|---|
| 12 | Carga paralela de detail + records al abrir el drawer. | ⚙ |
| 13 | Auto-refresh cada 3s mientras el job está running/pending (más agresivo que el listado porque los jobs evolucionan rápido). | ⚙ |
| 14 | Filter tabs records: `'all'` \| `'failed'` \| `'success'` con refetch al cambiar. | ⚙ |
| 15 | `downloadPayloadBundle()` llama a `exports_get_payload_bundle`, formatea con `JSON.stringify(bundle, null, 2)` y dispara descarga. | ⚙ |
| 16 | `downloadLog('sanitized'\|'full')` respeta isAdmin — el modo full lanza error UI si no admin (el backend también). | ⚙ |
| 17 | `retry(mode)` crea el nuevo job e invoca la Edge Function `export-worker` automáticamente. Si el worker falla, el job queda pending. | ⚙ |

## ExportsRoute · drawer + routing

| # | Punto | Estado |
|---|---|---|
| 18 | Ruta `/exports` y `/exports/:id` montan el mismo `ExportsRoute`. | ⚙ |
| 19 | El componente lee `useParams()` y abre el drawer si hay `:id`. | ⚙ |
| 20 | `useEffect` sincroniza `selectedJobId` con `params.id` — back/forward del navegador funciona. | ⚙ |
| 21 | `handleOpenJobDetail(id)` hace `navigate('/exports/:id')` en vez de mutar estado local — URL siempre refleja estado. | ⚙ |
| 22 | `handleCloseDrawer` hace `navigate('/exports')` (URL limpia al cerrar). | ⚙ |
| 23 | `handleRetryCreated(newJobId)` hace refetch del listado + navegación al drawer del nuevo job (el reintento se ve en el acto). | ⚙ |
| 24 | `handleOpenResource(id)` navega a `/resources/:id` (ruta del wizard, coherente con DashboardRoute y ResourcesRoute). | ⚙ |
| 25 | `isAdmin` computado por OR de `profile.role === 'admin'` (legacy) y `parseUserRole(user_metadata) === 'admin'` (shared/rbac). | ⚙ |

## Integración con listado SCR-03

| # | Punto | Estado |
|---|---|---|
| 26 | `ResourcesRoute` instancia `useExports({ supabase })` al nivel del wrapper y lo pasa a `ResourcesListPage`. | ⚙ |
| 27 | `canExport` calculado por OR de los dos RBAC: `legacy ∈ {admin, tecnico}` o `shared ∈ {admin, platform}`. Misma regla que el sidebar A5. | ⚙ |
| 28 | `ResourcesListPage` recibe props opcionales `exportsState` y `canExport`. Renderiza `<ListExportButtons>` en la barra secundaria junto a "Vistas guardadas" y "Exportar CSV". | ⚙ |
| 29 | Serialización de filtros activos a `{status, typeKeys, municipalityIds}` filtrando defaults — si el resultado es objeto vacío se pasa `null` para que ListExportButtons no renderice "Exportar filtrados". | ⚙ |
| 30 | `selectedIds` pasa de `Set<string>` (interno del page) a `Array.from(selectedIds)` (API de ListExportButtons). | ⚙ |

## Integración con dashboard

| # | Punto | Estado |
|---|---|---|
| 31 | `LastExportWidget` usa `overview.lastExportId` para navegar a `/exports/:id` cuando está disponible; fallback a `/exports`. | ⚙ |
| 32 | `DashboardOverview.lastExportId` añadido al tipo shared con valor null hasta que una migración posterior amplíe `dashboard_get_overview`. | ⚙ |

## Flujo E2E (smoke test manual)

### Drawer

| # | Punto | Estado |
|---|---|---|
| 33 | Click en fila de la tabla `/exports` → drawer abre, URL cambia a `/exports/:id`. | 👁 |
| 34 | Back del navegador → drawer cierra, URL vuelve a `/exports`. | 👁 |
| 35 | Cabecera del drawer muestra: tipo (PID/Data Lake/CSV/JSON-LD), estado con color, fecha, duración, lanzado por (email), notas, badge "↻ Reintento" si retry_of != null. | 👁 |
| 36 | Tab **Resumen**: cards con records total/ok/fallidos/skipped + breakdown de errores por categoría (content/integration/schema/permissions). | 👁 |
| 37 | Tab **Payload**: dropdown de recursos (solo los que tienen payload, i.e. success), al seleccionar carga JSON formateado vía `exports_get_record_payload`. | 👁 |
| 38 | Tab **Errores**: lista agrupada por categoría con icono, mensaje humano (`ERROR_CATEGORY_HINTS`), detalles colapsables. Click en nombre del recurso → navega a `/resources/:id`. | 👁 |
| 39 | Tab **Records**: tabla completa con filtro all/failed/success, orden failed→skipped→success. Click en fila → navega al recurso. | 👁 |

### Descargas (decisión B2-C y B3-C)

| # | Punto | Estado |
|---|---|---|
| 40 | Botón "Descargar payload (JSON)" → archivo `osalnes-export-pid-20260423-1435-b651d544.json` con estructura `{ job, records, generated_at }`. | 👁 |
| 41 | Botón "Descargar log" → texto plano con cabecera, datos del job, lista de recursos por estado. | 👁 |
| 42 | Log sanitizado: email del triggered_by truncado (`a***@dominio.com`), sin detalles de error completos, payloads resumidos a `type` + `@id`. | 👁 |
| 43 | Log completo: email sin truncar, error_details completos, payload entero truncado a 500 chars. Solo visible a admin. | 👁 |
| 44 | El nombre del archivo usa `started_at` para el stamp (no `now()`) → archivos de jobs antiguos mantienen su fecha. | ⚙ |

### Reintento (decisión 6-C / B4-A)

| # | Punto | Estado |
|---|---|---|
| 45 | Botón "Reintentar" abre `ExportRetryDialog` con dos opciones: "Reintentar todo" y "Solo reintentar fallidos". | 👁 |
| 46 | "Solo reintentar fallidos" deshabilitado si `records_failed === 0`. | 👁 |
| 47 | El hint usa interpolación `{total}` / `{failed}` con los valores reales del job. | 👁 |
| 48 | Confirmar reintento → crea nuevo job con `retry_of = <padre>`, scope_type `selected` si modo failed, hereda el scope_type del padre si modo all. | ⚙ (migración 031) + 👁 |
| 49 | La `notes` del nuevo job incluye `"Reintento de <uuid> (modo: all\|failed)"` + las notas del padre si existían. | ⚙ |
| 50 | Tras crear el reintento, la Edge Function `export-worker` se invoca automáticamente. Si la edge está caída, el job queda pending y se procesa manualmente con `exports_process_pending('<id>')`. | ⚙ + 👁 |
| 51 | El drawer navega al nuevo job, refetch del listado, y la tabla muestra el badge "↻ Reintento" en la fila. | ⚙ + 👁 |

### Integración con listado SCR-03

| # | Punto | Estado |
|---|---|---|
| 52 | Sin selección ni filtros → no aparece `ListExportButtons`. | ⚙ (render condicional) |
| 53 | Seleccionar 3 recursos con checkbox → aparece botón "🏛 Exportar al PID (3)". | 👁 |
| 54 | Click → abre `ExportLauncherDialog` con `prefilledSelection=[ids]`. El alcance queda bloqueado a "selected". | ⚙ + 👁 |
| 55 | Aplicar filtro por tipología o municipio (sin selección) → aparece "🏛 Exportar filtrados". Click → launcher con `prefilledFilters={...}`. | 👁 |
| 56 | Status = 'all' NO se pasa como filtro (se filtra como default en el serializador del page). | ⚙ |
| 57 | Usuario sin permiso (`canExport === false`) → el componente renderiza null, ningún botón visible. | ⚙ |

### Integración con dashboard

| # | Punto | Estado |
|---|---|---|
| 58 | Widget "Última exportación" con último job success → click navega a `/exports/:id` y abre drawer directamente. | 👁 (requiere migración que exponga last_export_id) |
| 59 | Fallback: si `overview.lastExportId` es null → navega a `/exports` listado. | ⚙ |

## Acciones pendientes antes del smoke test

1. **Aplicar migración 031** en el SQL Editor web (CLI da 403).
2. **Verificar con el SQL del bloque "Smoke test post-aplicación"** — esperado: 6 funciones creadas.
3. **Navegar a `/exports`** y pulsar en cualquier job existente → debe abrir el drawer.

## Deuda abierta

- **Migración del `dashboard_get_overview` para exponer `last_export_id`**:
  el widget LastExportWidget está listo para recibir el id (forward-
  compatible), pero requiere ALTER de la RPC `dashboard_get_overview`
  añadiendo al return table un campo `last_export_id uuid` y al SELECT
  final un `(select id from public.export_jobs where status = 'success'
  order by started_at desc limit 1) as last_export_id`. Sin esa
  migración, el widget navega al listado genérico `/exports`. Scope
  no bloqueante de Fase B — candidato a una migración 032 posterior.
- **Reintento de un job con `resource_id` NULL** (recurso borrado entre
  launch y retry): `exports_retry` en modo `'failed'` hace
  `array_agg(distinct resource_id) where resource_id is not null`, así
  que los records con recurso fantasma quedan fuera del reintento. Si
  todos los fallidos tenían recurso fantasma, el RAISE EXCEPTION "No
  hay recursos que reintentar" alerta al usuario.
- **Descarga de log completa sin gate en UI cuando user_metadata no
  tiene rol**: `isAdmin` cae a `false`; el botón "Log completo" no se
  muestra (o muestra disabled según el drawer). Si el usuario es admin
  solo por `profile.role` legacy, el botón aparece y funciona.
- **Rendimiento del worker con alcances grandes**: la hidratación N+1
  (1 SELECT base + 4 tr_get + 1 count por recurso) era aceptable para
  ~15 recursos del test E2E Fase A (duration_ms ~500ms). Con el tope
  actual de 5 jobs por tick de la edge function y sin límite por job,
  un retry 'all' sobre ~500 recursos tardará ~20-30 segundos. No
  bloqueante, pero candidato a RPC `exports_load_scope_rows(uuid[])`
  que devuelva todas las filas hidratadas en una sola roundtrip.
- **Errores TS preexistentes** en `DocumentUploader.tsx` y
  `RelationsManager.tsx` (legacy del multimedia/relations antiguo)
  siguen sin afectar rutas vivas. Deuda independiente.
- **Dos sistemas de RBAC coexistiendo** (`profile.role` legacy vs
  `user_metadata.role` shared) — unificación prevista en SCR-14.
