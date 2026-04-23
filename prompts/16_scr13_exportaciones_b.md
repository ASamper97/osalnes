# Prompt maestro · SCR-13 Centro de exportaciones · Fase B

**Pega este contenido en Claude Code.**

Cierra el módulo SCR-13 con drawer de detalle, descargas de payload
y log, reintento con 2 modos, e integración con el listado SCR-03
y el dashboard.

Cumple los bullets restantes del pliego 5.1.7:
- **Relanzamiento idempotente** (decisión 6-C).
- **Descarga de log** (decisión 7-A).
- **Integración con otros módulos** (decisión 8-A).

## Prerrequisitos

- **SCR-13 Fase A integrada y funcionando** (migración 030 aplicada,
  Edge Function `export-worker` desplegada, pantalla `/exports`
  accesible, smoke test con 3 payloads JSON-LD verificados).

## Decisiones ya tomadas para Fase B

- **B1-A**: Modal lateral (drawer slide-in desde la derecha).
- **B2-C**: Descarga del payload como **un único fichero JSON agregado**
  con estructura `{ job, records, generated_at }`.
- **B3-C**: Dos botones de log → sanitizado (para todos) + completo
  (solo admin).
- **B4-A**: Reintento hereda tipo y alcance del padre. Solo se elige
  modo (total / solo fallidos).

## Ficheros en el repo

```
osalnes-dti/
├── database/migrations/
│   ├── 031_exports_detail_retry.sql           (NUEVO · 6 RPCs)
│   └── 031_exports_detail_retry.down.sql      (NUEVO)
│
├── packages/shared/src/data/
│   └── exports-detail.ts                       (NUEVO · tipos + downloadAsFile helper)
│
├── packages/cms/src/
│   ├── hooks/
│   │   └── useExportJobDetail.ts               (NUEVO)
│   ├── components/exports/
│   │   ├── ExportJobDetailDrawer.tsx           (NUEVO · componente principal)
│   │   ├── ExportJobDetailSummary.tsx          (NUEVO · tab resumen)
│   │   ├── ExportJobDetailRecords.tsx          (NUEVO · tab records)
│   │   ├── ExportJobDetailErrors.tsx           (NUEVO · tab errores)
│   │   ├── ExportJobDetailPayload.tsx          (NUEVO · tab payload)
│   │   ├── ExportRetryDialog.tsx               (NUEVO · modal reintento)
│   │   └── ListExportButtons.tsx               (NUEVO · integración listado)
│   └── pages/
│       ├── ExportsRoute.tsx                    (REEMPLAZAR · actualizado con drawer)
│       ├── exports-detail.copy.ts              (NUEVO)
│       ├── exports-detail.css                  (NUEVO)
│       └── ExportsDetail.integration.md        (docs)
│
└── prompts/
    └── 16_scr13_exportaciones_b.md             (este fichero)
```

## Tareas en orden

### Tarea 1 · Aplicar migración 031

```bash
# Abrir SQL Editor de Supabase (no CLI, que da 403) y pegar el
# contenido de database/migrations/031_exports_detail_retry.sql
```

Verificar:
```sql
select count(*)
from pg_proc
where proname in (
  'exports_get_detail', 'exports_get_records',
  'exports_get_record_payload', 'exports_get_payload_bundle',
  'exports_get_log_text', 'exports_retry'
) and pronamespace = 'public'::regnamespace;
-- Esperado: 6
```

Smoke test (reemplazar `<uuid>` por el id de un job real del sistema):
```sql
select * from public.exports_get_detail('<uuid>');
select * from public.exports_get_records('<uuid>', null, 1, 10);
select length(public.exports_get_log_text('<uuid>', true));
```

**Adaptación al esquema español**: la migración 031 NO toca
`recurso_turistico` directamente. Solo crea RPCs que leen de
`export_jobs` y `export_job_records` (ampliadas en la 030). No
requiere reescritura de tablas/columnas en español.

### Tarea 2 · Reemplazar `ExportsRoute.tsx`

El fichero anterior (Fase A) solo montaba `<ExportsPage>`. Hay que
reemplazarlo por la versión de este entregable, que añade:

- Manejo de `:id` en URL.
- Instanciación del hook `useExportJobDetail`.
- Render del `<ExportJobDetailDrawer>` junto al `<ExportsPage>`.

El import de `supabase` y `useAuth` puede variar según cómo esté
estructurado el CMS — ajusta las líneas `declare const supabase` y
`declare const useAuth` al patrón real del proyecto.

### Tarea 3 · Añadir ruta `/exports/:id`

En `App.tsx`, duplicar la ruta existente:

```tsx
<Route path="/exports" element={<ExportsRoute />} />
<Route path="/exports/:id" element={<ExportsRoute />} />
```

### Tarea 4 · Importar CSS nuevo

Donde esté el import de `exports.css` (Fase A), añadir después:

```tsx
import './exports-detail.css';
```

### Tarea 5 · Integración con el listado SCR-03

Abrir `ResourcesPage.tsx` o donde esté el listado, y:

1. Importar `ListExportButtons`.
2. Instanciar `useExports({ supabase })` al principio del componente.
3. Calcular `canExport` desde el RBAC.
4. Montar `<ListExportButtons>` en la barra de acciones.

Ver `ExportsDetail.integration.md` sección 5 para código completo.

### Tarea 6 · Dashboard widget (si existe)

Si existe el widget "Última exportación PID" en el dashboard, hacer
que al hacerle click navegue al drawer del último job:

```tsx
onClick={() => navigate(`/exports/${lastExportId}`)}
```

Si el widget no existe aún, esta tarea se pospone para cuando se
cree.

### Tarea 7 · Test E2E

El integration.md sección 7 tiene un checklist con ~30 puntos. Los
más críticos:

- Click en fila → drawer abre y URL cambia.
- Tab Errores agrupa por categoría con colores y mensajes humanos.
- Descarga payload → JSON formateado `{ job, records, generated_at }`.
- Descarga log sanitizado → emails truncados (`a***@dominio.com`).
- Log completo solo visible para admin.
- Reintento "Solo fallidos" deshabilitado si no hay fallidos.
- Reintento crea nuevo job con `retry_of` + badge "↻ Reintento" +
  procesamiento automático.
- Botón "Exportar al PID (3)" aparece al seleccionar 3 recursos en
  el listado.

### Tarea 8 · Commits

Uno por tarea:

```
feat(db): migración 031 · drawer, retry, descargas (scr13-b · t1)
feat(shared): tipos exports-detail + downloadAsFile helper (scr13-b · t2a)
feat(cms): useExportJobDetail hook (scr13-b · t2b)
feat(cms): ExportJobDetailDrawer + 4 subcomponentes tabs (scr13-b · t2c)
feat(cms): ExportRetryDialog + ListExportButtons (scr13-b · t2d)
feat(cms): ExportsRoute con drawer + ruta /exports/:id (scr13-b · t3)
feat(cms): ListExportButtons en listado SCR-03 (scr13-b · t5)
docs: checklist E2E SCR-13 fase B (scr13-b · t7)
```

## Lo que NO tocar

- La migración 030 ni las RPCs de Fase A.
- La Edge Function `export-worker` (sigue igual).
- Los módulos anteriores (wizard, paso 8, dashboard operativo).
- La tabla `export_job` singular legacy (no la toca Fase A ni B).

## Tres avisos importantes

### 1. `ExportsRoute.tsx` se reemplaza, no se añade

El de Fase A es un placeholder que hay que sobrescribir. Guarda el
anterior como `.bak` si quieres trazabilidad.

### 2. La ruta `/exports/:id` debe estar DESPUÉS de `/exports`

En React Router v6 las rutas más específicas deben ir después. Si
pones `/exports/:id` antes que `/exports`, el matcher funciona igual
pero visualmente es más limpio respetar el orden.

### 3. El reintento es el único sitio que invoca la Edge Function desde el backend + frontend

Mismo patrón que `launch` de Fase A. Si la Edge Function está caída,
el job queda en `pending` y el usuario puede procesar con
`exports_process_pending('<id>')` desde SQL.
