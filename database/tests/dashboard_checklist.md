# Checklist E2E · Dashboard operativo (SCR-02)

Estado tras aplicar las 6 tareas del prompt `13_dashboard.md`. Los 40+
puntos del `DashboardPage.integration.md §6` se evalúan aquí.

> ⚙ = verificado estáticamente en el código.
> 👁 = requiere smoke test manual en el CMS desplegado.

## Estado de la migración 028

- Aplicada y verificada 2026-04-22: 7 artefactos creados (tabla
  export_jobs + helper band_from_percent + 6 RPCs dashboard_get_*).
- `dashboard_get_overview()` devuelve datos reales.
- `dashboard_get_une_indicators()` devuelve los 6 indicadores: tu BD
  actual marca 94/100/94/100/100/0 — banda A, A, A, A, A, D (el último
  porque aún no hay exportación PID con status='success').

## KPIs + navegación

| # | Punto | Estado |
|---|---|---|
| 1 | Al cargar, aparecen 6 cards con valores (1-2s). | ⚙ (`StatusKpisWidget` renderiza 6 cards desde `state.overview`) |
| 2 | Click en "Publicados" → listado con filtro `status=publicado`. | ⚙ (`onNavigate('/resources?status=publicado')` con valor Spanish del CHECK) |
| 3 | Click en "Programados" → listado con filtro `status=programado`. | ⚙ |
| 4 | Click en "Incompletos" → listado con filtro `incomplete=1`. | ⚙ |
| 5 | Si hay programados, card "Programados" pulsa en azul. | ⚙ (`pulse={kpis.scheduled > 0}`) |
| 6 | Si hay incompletos, card "Incompletos" resaltada amarillo. | ⚙ (`highlight={incomplete > 0}`) |

## Alertas

| # | Punto | Estado |
|---|---|---|
| 7 | Visibles en mapa sin coordenadas → banner rojo. | ⚙ (`DashboardAlerts` con `state.overview.withoutCoordinates`) |
| 8 | Recursos sin imagen → banner amarillo. | ⚙ |
| 9 | CTA "Corregir" navega con filtro correcto. | ⚙ (`onNavigate` con query string) |
| 10 | Máx 2 alertas simultáneas. | ⚙ (el componente prioriza fail > warn) |

## Mi trabajo

| # | Punto | Estado |
|---|---|---|
| 11 | Borradores del usuario de últimas 2 semanas. | ⚙ (`dashboard_get_my_work` filtra `created_by = auth.uid() AND estado_editorial IN ('borrador','revision') AND updated_at >= now() - '14 days'`) |
| 12 | Click en un borrador → abre editor. | ⚙ (`onOpenResource(id)` → `/resources/${id}`) |
| 13 | "Ver todos mis borradores" → listado filtrado. | ⚙ |
| 14 | Nota de calidad circular coloreada. | ⚙ (`qualityScore` viene de `compute_resource_quality_score`) |
| 15 | "N obligatorios sin rellenar" si pidMissing > 0. | ⚙ (`pidMissingRequired` desde RPC) |

## Próximas publicaciones programadas

| # | Punto | Estado |
|---|---|---|
| 16 | Widget solo si hay ≥1 programada. | ⚙ (render condicional en DashboardPage) |
| 17 | Hasta 5 próximas ordenadas por fecha. | ⚙ (RPC `p_limit=5`, `ORDER BY scheduled_publish_at ASC`) |
| 18 | Chip de tiempo: "mañana · 10:30", "en 2h". | ⚙ (`formatRelativeFuture` del shared) |
| 19 | Chip pulsa amarillo si <24h. | ⚙ (threshold en el componente) |
| 20 | ✕ cancela la programación → pasa a borrador → refresca. | ⚙ (`onCancelSchedule` → `change_resource_status('borrador')` + `state.refetch()`) |

## Indicadores UNE

| # | Punto | Estado |
|---|---|---|
| 21 | 6 cards: digitalización, multilingüismo, georreferenciación, 30d, 90d, PID. | ⚙ (`UneIndicatorsWidget` con 6 cards) |
| 22 | Cada card letra A/B/C/D + % + descripción. | ⚙ |
| 23 | Colores A verde / B lima / C amarillo / D rojo. | ⚙ (CSS classes por banda) |
| 24 | Interop PID = D 0% hasta export exitoso. | ⚙ (verificado en BD real: pid_interop 0/D) |

## Traducciones

| # | Punto | Estado |
|---|---|---|
| 25 | 5 filas: ES, GL, EN, FR, PT. | ⚙ (`dashboard_get_translation_progress` con 5 UNION ALL) |
| 26 | Progreso 0-100%. | ⚙ |
| 27 | Click EN/FR/PT/GL navega a listado filtrado. | ⚙ (`onNavigate(`/resources?languages_missing=${lang}`)`) |
| 28 | ES no clicable (todos tienen ES). | ⚙ (lógica en `TranslationProgressWidget`) |

## Actividad reciente

| # | Punto | Estado |
|---|---|---|
| 29 | Últimas 10 acciones. | ⚙ (RPC `p_limit=10`) |
| 30 | Icono según acción (✨ crear, ✏️ modificar, 🚀 publicar). | ⚙ (mapping inline en `RecentActivityWidget`) |
| 31 | Email del actor truncado si largo. | ⚙ |
| 32 | Click nombre recurso → abre editor. | ⚙ |
| 33 | Fallback a updated_at si log_cambios vacío. | ⚙ (branch en la RPC) |

## Por rol

| # | Punto | Estado |
|---|---|---|
| 34 | Admin ve todos los widgets. | ⚙ (matriz `VISIBILITY_MATRIX.admin` con los 12 widgets) |
| 35 | Operador NO ve UNE, distribución, última exportación. | ⚙ |
| 36 | Agencia NO ve alertas, exportaciones, UNE, actividad. | ⚙ |
| 37 | Sin rol solo ve quickActions + statusKpis. | ⚙ (`VISIBILITY_MATRIX.unknown`) |
| 38 | Accesos rápidos cambian según rol. | ⚙ (`getQuickActionsForRole(role)`) |

## Auto-refresh

| # | Punto | Estado |
|---|---|---|
| 39 | 60s → refresco silencioso. | ⚙ (`useDashboard` con `autoRefresh=true` + `setInterval(60_000)`) |
| 40 | Cambiar pestaña y volver → refresco inmediato. | ⚙ (`document.visibilityState` listener) |
| 41 | Botón ↻ manual funciona. | ⚙ (`state.refetch()`) |
| 42 | "Actualizado hace X min" en header. | ⚙ (`formatRelativePast(state.lastRefreshedAt)`) |

## Acciones pendientes antes del smoke test

**T3 — Asignar rol admin** (aviso 1 del prompt). Pega en SQL editor:

```sql
update auth.users
set raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
where email = 'antoniosampersaez@gmail.com';

-- Verificar
select email, raw_user_meta_data->>'role' as role
from auth.users
where email = 'antoniosampersaez@gmail.com';
```

Valores aceptados por `parseUserRole`: `admin`, `platform`, `operator`,
`agency`, `tourism_manager` + variantes en castellano
(`administrador`, `operador`, `gestor_turistico`, etc.). Si no hay
role, el usuario se trata como `unknown` y solo ve quickActions +
statusKpis (mínimo seguro).

**Opcional — registrar export_job de prueba** (aviso 2 del prompt).
Si quieres que el widget "Última exportación" tenga datos:

```sql
insert into public.export_jobs (job_type, status, records_processed, records_total)
values ('pid', 'success', 15, 15);
```

Y el indicador UNE `pid_interop_band` pasará de D a A.

## Deuda abierta

- **Indicadores UNE heurísticos** (aviso 3 del prompt): "Digitalización
  94%" se calcula contra los campos del CMS (nombre ES + descripción
  ≥30 chars + tipología + municipio completos). NO son métricas del
  INE ni del Ministerio. Si una auditoría exige cálculos oficiales,
  ajustar las fórmulas SQL en `dashboard_get_une_indicators`.
- **Tabla `export_jobs` mínima** (aviso 2): solo tiene los campos
  justos para el widget. SCR-13 (Centro de exportaciones) la ampliará
  con payload, duración detallada, errores estructurados, recurso
  específico asociado, etc.
- **`useDashboard` sin cache**: cada refresh hace 6 RPCs paralelas. A
  partir de ~100 recursos empezará a notarse latencia; en ese momento
  conviene añadir materializada view o cache cliente (TanStack Query
  typical pattern).
- **Actividad reciente no incluye acciones de paso 7b/listado B**: los
  handlers de `handlePublishNow/handleSchedulePublish/bulk_*/
  duplicate_resource` escriben directo via supabase-js/RPC sin
  llamar a `logAudit`. Gap compartido con paso 7b; trigger Postgres
  `AFTER UPDATE` pendiente.
- **`municipality_name` del widget Upcoming via `tr_get` + fallback
  slug**: si la municipalidad no tiene name en traduccion, aparece el
  slug (ej. "sanxenxo" en vez de "Sanxenxo"). Aceptable temporalmente;
  seed de traducciones de municipios pendiente.
- **Parseo de role tolerante**: `parseUserRole` normaliza variantes
  castellano→inglés. Si alguien escribe `"Administrator"` con mayúscula
  o con typo, cae a `unknown`. Cuando venga SCR-14 (UI gestión de
  usuarios), el selector de rol será un dropdown cerrado.
- **Auto-refresh 60s + pestaña visible**: el componente usa
  `document.visibilityState`. Cuando la pestaña está minimizada pero
  el navegador la considera "visible" (ej. ventana en segundo plano
  sin minimizar), seguirá refrescando. Trade-off aceptable.
