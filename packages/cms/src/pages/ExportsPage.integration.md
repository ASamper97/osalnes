# Integración · SCR-13 Centro de exportaciones · Fase A

Añade la pantalla SCR-13 al CMS, con tabla de jobs, KPIs, filtros y
lanzador de nuevas exportaciones con pre-validación.

Cumple los requisitos del pliego:
- FR-12, FR-13, FR-14 (exportación, trazabilidad, auditoría)
- INT-02 (PID), INT-03 (Data Lake), INT-04 (APIs seguras)
- WF-04 (flujo de exportación)

## Prerrequisitos

- Migraciones 000-029 aplicadas (incluye `export_jobs` mínima de la 028
  y `generate_jsonld_relations` del paso 8).
- Supabase CLI configurada para el proyecto.
- El repo del CMS ya tiene la sidebar con "Exportaciones" (visible
  para roles `admin` y `platform`).

## 1) Aplicar migración 030

```bash
npx supabase db push
```

Validar:
```sql
-- Nuevas columnas en export_jobs
\d public.export_jobs

-- Nueva tabla export_job_records
select count(*) from public.export_job_records;

-- RPCs nuevas disponibles
select proname from pg_proc where proname like 'exports_%';
-- Esperado:
--   exports_resolve_scope_ids
--   exports_validate_scope
--   exports_launch
--   exports_process_pending
--   exports_list
--   exports_get_kpis
```

Probar la pre-validación sin crear job:
```sql
select * from public.exports_validate_scope('all_published');
```

Probar creación de job + procesamiento sin Edge Function:
```sql
-- Crear job
select public.exports_launch('pid', 'all_published');
-- (copiar el uuid devuelto)

-- Procesar síncronamente (simulación sin edge function)
select public.exports_process_pending('<uuid>');

-- Ver resultado
select * from public.export_jobs order by started_at desc limit 1;
select * from public.export_job_records where job_id = '<uuid>';
```

## 2) Desplegar la Edge Function `export-worker`

```bash
# Desde la raíz del repo
npx supabase functions deploy export-worker
```

Verificar el log:
```bash
npx supabase functions logs export-worker --project-ref <project-ref>
```

### Variables de entorno (cuando tengas credenciales PID reales)

Cuando el PID de SEGITTUR dé credenciales, configurar en el proyecto:
```bash
npx supabase secrets set PID_ENDPOINT_URL=https://api.pid.segittur.es/v1/resources
npx supabase secrets set PID_API_KEY=<api-key>
```

Y descomentar el bloque de fetch real en
`supabase/functions/export-worker/index.ts` (función `sendToEndpoint`).
Ya está preparado, solo hay que activarlo.

## 3) Registrar la ruta en el CMS

En el router del CMS (`AppRoutes.tsx` o similar), añadir:

```tsx
import ExportsPage from './pages/ExportsPage';
import { useExports } from './hooks/useExports';
import './pages/exports.css';

function ExportsRoute() {
  const state = useExports({ supabase });
  const navigate = useNavigate();

  return (
    <ExportsPage
      state={state}
      onOpenJobDetail={(jobId) => {
        // Fase B: abrir drawer. Por ahora redirige al historial con el id
        navigate(`/exports/${jobId}`);
      }}
    />
  );
}

<Route path="/exports" element={<ExportsRoute />} />
```

## 4) Visibilidad por rol

El módulo solo debe aparecer para roles con permiso. Usar el RBAC
ya instalado (`packages/shared/src/data/rbac.ts`):

```tsx
import { canSeeWidget, parseUserRole } from '@osalnes/shared/data/rbac';

const role = parseUserRole(user?.user_metadata);
const canSeeExports = role === 'admin' || role === 'platform';

// En la sidebar:
{canSeeExports && <NavLink to="/exports">📤 Exportaciones</NavLink>}
```

## 5) Checklist E2E (Fase A)

### Tabla y filtros
- [ ] Al entrar a `/exports` se carga la tabla con los jobs existentes
      (inicialmente solo los creados manualmente en SQL para testing).
- [ ] Cambiar filtro "Estado = Éxito" → solo aparecen jobs success.
- [ ] Filtro "Tipo = PID" + "Desde = 2026-04-01" → funciona combinado.
- [ ] Click en "Limpiar filtros" → vuelve a mostrar todo.
- [ ] Paginación: con >25 jobs aparecen botones Anterior/Siguiente.

### KPIs
- [ ] Las 6 cards muestran cifras coherentes con la tabla.
- [ ] Si hay jobs pending/running, los números tienen pulso animado.
- [ ] Duración media se formatea ("3.4 s" / "1 min 20 s").

### Lanzador - flujo completo
- [ ] Click "+ Nueva exportación" → abre modal con 3 pasos.
- [ ] Paso 1: elegir PID (por defecto) o Data Lake / CSV / JSON-LD.
- [ ] Paso 2: "Todos los publicados" por defecto. Las otras 2 opciones
      están deshabilitadas (se habilitan si el launcher se abre desde
      el listado con filtros/selección — Fase B).
- [ ] Paso 3: pre-validación automática.
- [ ] Si todos pasan: banner verde "Todos los recursos pasan".
- [ ] Si algunos fallan: 3 métricas + lista de errores con categoría
      coloreada (decisión 5-A).
- [ ] Si todos fallan: banner rojo + botón "Lanzar" deshabilitado.

### Lanzar y procesar
- [ ] Pulsar "Lanzar exportación" con >0 recursos OK → modal se cierra.
- [ ] El nuevo job aparece en la tabla con estado "En cola" o
      directamente "En proceso" (la edge function lo recoge rápido).
- [ ] Auto-refresh cada 5 s mientras hay jobs activos → ves el
      estado cambiar sin pulsar nada.
- [ ] Al terminar: estado "Éxito" / "Parcial" / "Error" con badge
      de color correcto.
- [ ] "Recursos" muestra "15 OK" si success, o "12 OK · 3 errores" si
      partial.

### Sin edge function desplegada
Si no puedes desplegar la edge function en desarrollo, el job se
queda en `pending`. Para procesarlo manualmente:

```sql
select public.exports_process_pending(
  (select id from public.export_jobs where status = 'pending' order by started_at desc limit 1)
);
```

Y luego refrescar la tabla (botón ↻). Funciona igual pero síncrono.

## 6) Qué viene en la Fase B

- Drawer lateral de detalle del job (click en una fila).
- Pestañas "Payload" y "Errores" con código coloreado.
- Descarga de payload.json y log.txt (decisión 7-A).
- Botón "Reintentar" con dos modos: todo / solo errores (decisión 6-C).
- Integración con el listado: botón "Exportar al PID" desde la
  selección del listado (decisión 8-A).
