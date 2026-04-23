# Integración · SCR-13 Centro de exportaciones · Fase B

Completa el módulo SCR-13 con drawer de detalle, descargas, reintento
y botones de integración con el listado.

## Prerrequisitos

- **Fase A aplicada y funcionando** (migración 030 + Edge Function
  `export-worker` desplegada + pantalla `/exports` accesible).
- Migraciones 000-030 aplicadas.
- React Router v6 con `useParams` / `useNavigate` disponible.

## 1) Aplicar migración 031

Abrir SQL Editor de Supabase y pegar el contenido completo de
`database/migrations/031_exports_detail_retry.sql`. Pulsar **Run**.

Verificación:
```sql
-- 6 nuevas funciones
select proname
from pg_proc
where proname like 'exports_%'
  and pronamespace = 'public'::regnamespace
  and proname in (
    'exports_get_detail',
    'exports_get_records',
    'exports_get_record_payload',
    'exports_get_payload_bundle',
    'exports_get_log_text',
    'exports_retry'
  );
-- Esperado: 6 filas
```

Smoke test con un job que ya exista (reemplazar `<uuid>` por el id de
un job real del sistema):

```sql
-- Detalle
select * from public.exports_get_detail('<uuid>');

-- Records
select * from public.exports_get_records('<uuid>', null, 1, 10);

-- Bundle JSON (cuidado, pesa)
select jsonb_pretty(public.exports_get_payload_bundle('<uuid>'));

-- Log texto sanitizado
select public.exports_get_log_text('<uuid>', true);

-- Log texto completo (solo admin en UI)
select public.exports_get_log_text('<uuid>', false);
```

Test del reintento (creará un nuevo job):

```sql
-- Reintento modo "all" (recrea el job completo)
select public.exports_retry('<uuid>', 'all');

-- Reintento modo "failed" (solo los que fallaron)
-- Necesita que el job padre tenga al menos 1 record failed
select public.exports_retry('<uuid>', 'failed');
```

## 2) Actualizar `ExportsRoute.tsx`

El `ExportsRoute.tsx` de Fase A solo mostraba el listado. Ahora
soporta ruta con id y drawer. Reemplaza el fichero por el de este
entregable. Cambios:

- Acepta ruta `/exports/:id` además de `/exports`.
- Instancia `useExportJobDetail` cuando hay `:id` en URL.
- Renderiza `<ExportJobDetailDrawer>` junto a `<ExportsPage>`.
- `onOpenJobDetail` ahora hace `navigate('/exports/:id')` en lugar
  del placeholder que tenía.
- Detecta si el usuario es admin (para permitir log completo).

## 3) Añadir ruta `/exports/:id` en el router

En `App.tsx` (o donde esté el router), además de la ruta actual
`/exports`, añadir:

```tsx
<Route path="/exports" element={<ExportsRoute />} />
<Route path="/exports/:id" element={<ExportsRoute />} />
```

Ambas rutas montan el mismo `ExportsRoute`, que lee `useParams()`
internamente para decidir si abre el drawer o no.

## 4) Importar el CSS nuevo

Añade al punto donde importas `exports.css` (Fase A):

```tsx
import './exports.css';
import './exports-detail.css';  // NUEVO
```

## 5) Integración con el listado SCR-03 (decisión 8-A)

En `ResourcesPage.tsx` / `ResourcesRoute.tsx` (pantalla del listado),
añadir el componente `ListExportButtons`:

```tsx
import ListExportButtons from '../components/exports/ListExportButtons';
import { useExports } from '../hooks/useExports';

function ResourcesPage() {
  const exportsState = useExports({ supabase });
  const role = parseUserRole(auth.user?.user_metadata);
  const canExport = role === 'admin' || role === 'platform';

  const currentFilters = { /* serializar los filtros activos */ };
  const selectedIds = [ /* ids seleccionados en la tabla bulk */ ];

  return (
    <>
      {/* ... */}
      <div className="resources-actions-bar">
        <ListExportButtons
          state={exportsState}
          selectedIds={selectedIds}
          currentFilters={currentFilters}
          canExport={canExport}
        />
      </div>
      {/* ... */}
    </>
  );
}
```

- Si hay **selección**: aparece "🏛 Exportar al PID (N)".
- Si hay **filtros activos pero no selección**: aparece "🏛 Exportar filtrados".
- Si no hay nada: no aparece ningún botón.
- El modal se abre con el alcance pre-rellenado y bloqueado.

## 6) Widget dashboard "Última exportación PID"

Si el widget del dashboard ya existe (creado en sesiones previas),
solo hay que añadirle la navegación:

```tsx
<div
  className="dashboard-widget dashboard-widget-clickable"
  onClick={() => navigate(`/exports/${lastExportId}`)}
  title="Ver detalle de la última exportación"
>
  Última exportación PID...
</div>
```

El drawer se abrirá automáticamente gracias al patrón `/exports/:id`.

## 7) Checklist E2E (Fase B)

### Drawer
- [ ] Click en una fila de la tabla → drawer slide-in desde derecha.
- [ ] URL cambia a `/exports/:id`.
- [ ] Recargar la página con URL `/exports/:id` → drawer se abre
      automáticamente con el job correcto.
- [ ] Escape o click en backdrop → drawer se cierra y URL vuelve a
      `/exports`.

### Tab Resumen
- [ ] Se ven las 10-11 métricas del job (tipo, estado, alcance,
      inicio, fin, duración, totales, OK, fallidos...).
- [ ] Si hay errores → breakdown por categoría con chips de color.
- [ ] Si el job tiene notas → aparecen en panel con fondo gris.

### Tab Records
- [ ] Muestra todos los recursos procesados del job.
- [ ] Filtro por "Todos / Solo OK / Solo fallidos" funciona.
- [ ] Click en fila → abre el wizard del recurso (si tiene
      `resource_id`).
- [ ] Status chip con color correcto (verde OK, rojo error, amarillo
      saltado).

### Tab Errores
- [ ] Si no hay errores → empty state verde.
- [ ] Si hay errores → agrupados por categoría con color.
- [ ] Cabecera de grupo muestra contador + hint humano de la categoría
      (ej: "Faltan campos obligatorios en el recurso. Edita el recurso
      para completarlos.").
- [ ] Cada error tiene botón "Ver detalles técnicos" que muestra el
      `error_details` JSON colapsable.
- [ ] Botón "Abrir recurso →" navega al wizard.

### Tab Payload
- [ ] Dropdown con todos los records success.
- [ ] Al seleccionar → carga el payload via RPC
      `exports_get_record_payload`.
- [ ] El JSON se muestra formateado con syntax highlight (fondo oscuro).
- [ ] Botón "Copiar" funciona → mensaje "✓ Copiado" durante 1.5s.

### Descargas (decisión B2-C + B3-C)
- [ ] Botón "Descargar payload (.json)" → descarga fichero
      `osalnes-export-pid-YYYYMMDD-HHMM-abc12345.json` con estructura
      `{ job, records, generated_at }`.
- [ ] Botón "Descargar log (.txt)" sanitizado → descarga log legible
      con emails/teléfonos truncados (`a***@dominio.com`).
- [ ] Botón "Descargar log completo" → **solo visible para admin**.
      Incluye payloads completos + datos personales sin truncar.

### Reintento (decisión 6-C + B4-A)
- [ ] Botón "↻ Reintentar job" disponible solo si el job está en
      `success`, `partial` o `failed` (no en `pending` ni `running`).
- [ ] Click → modal con 2 opciones radio.
- [ ] Si el job no tiene fallidos → opción "Solo fallidos"
      deshabilitada con mensaje "No hay recursos fallidos que
      reintentar".
- [ ] Si el job sí tiene fallidos → opción "Solo fallidos"
      preseleccionada por defecto.
- [ ] Pulsar "Crear reintento" → crea nuevo job, cierra modal,
      navega a `/exports/:new-id`.
- [ ] El nuevo job tiene badge `↻ Reintento` en la tabla (Fase A ya
      lo soportaba, ahora se activa).
- [ ] El nuevo job se procesa automáticamente por la Edge Function.

### Integración listado (decisión 8-A)
- [ ] En el listado SCR-03 sin selección ni filtros → NO hay botón
      de exportar.
- [ ] Con filtros activos (ej. municipio = Cambados + estado = publicado) →
      aparece "🏛 Exportar filtrados".
- [ ] Seleccionar 3 recursos → aparece "🏛 Exportar al PID (3)".
- [ ] Click → modal con paso 2 (alcance) pre-rellenado y bloqueado
      a la opción correspondiente (filtered o selected).
- [ ] Las otras opciones de alcance aparecen deshabilitadas en el modal.

### Integración dashboard (si el widget existe)
- [ ] Widget "Última exportación PID" muestra fecha + estado real.
- [ ] Click en el widget → navega a `/exports/:last-id` con drawer
      abierto.

## Lo que NO cubre Fase B (ideas para el futuro)

- Paginación de records dentro del drawer (si un job tiene >100
  recursos, solo carga los primeros 100 por defecto).
- Edición en caliente del payload antes del reintento.
- Reintento con modo "cambio de tipo" (decidimos B4-A, mantener).
- Exportación programada (cron) — decidimos 3-C sin la opción D.

Estas son deudas documentadas, no bugs.
