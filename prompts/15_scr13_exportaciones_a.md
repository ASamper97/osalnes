# Prompt maestro · SCR-13 Centro de exportaciones · Fase A

**Pega este contenido en Claude Code.**

Primera fase del Centro de exportaciones (SCR-13). Cubre listado,
KPIs, filtros, lanzamiento con pre-validación y procesamiento
asíncrono vía Edge Function de Supabase.

Cumple los requisitos del pliego:
- FR-12, FR-13, FR-14 (exportación, trazabilidad)
- INT-02 (PID), INT-03 (Data Lake)
- WF-04 (flujo de exportación)

## Decisiones aplicadas (ya tomadas)

- **1-B**: Edge Function asíncrona real (no simulación).
- **2-B**: 4 tipos → PID / Data Lake / CSV / JSON-LD.
- **3-C**: 3 alcances → todos publicados / filtrados / seleccionados.
- **4-A**: Pre-validación obligatoria antes de lanzar.
- **5-A**: Errores separados por categoría (contenido / integración /
  esquema / permisos) con mensaje humano.
- **6-C**: Reintento con dos modos (Fase B).
- **7-A**: Descarga de payload y log (Fase B).
- **8-A**: Integración con listado y dashboard (Fase B).

## Ficheros en el repo

```
osalnes-dti/
├── database/migrations/
│   ├── 030_exports_full.sql                   (NUEVO)
│   └── 030_exports_full.down.sql              (NUEVO)
│
├── supabase/functions/
│   └── export-worker/
│       └── index.ts                           (NUEVO · Edge Function)
│
├── packages/shared/src/data/
│   └── exports.ts                             (NUEVO)
│
├── packages/cms/src/
│   ├── hooks/
│   │   └── useExports.ts                      (NUEVO)
│   ├── components/exports/
│   │   ├── ExportsKpisBar.tsx                 (NUEVO)
│   │   ├── ExportsFiltersPanel.tsx            (NUEVO)
│   │   ├── ExportsTable.tsx                   (NUEVO)
│   │   └── ExportLauncherDialog.tsx           (NUEVO)
│   └── pages/
│       ├── ExportsPage.tsx                    (NUEVO)
│       ├── exports.copy.ts                    (NUEVO)
│       ├── exports.css                        (NUEVO)
│       └── ExportsPage.integration.md         (docs)
│
└── prompts/
    └── 15_scr13_exportaciones_a.md            (este fichero)
```

## Tareas en orden

### Tarea 1 · Aplicar migración 030

```bash
npx supabase db push
```

Validar:
```sql
-- Nuevas columnas
select column_name from information_schema.columns
where table_name = 'export_jobs'
  and column_name in ('payload', 'scope_type', 'retry_of', 'duration_ms');

-- Tabla export_job_records
select count(*) from public.export_job_records;

-- Probar pre-validación
select * from public.exports_validate_scope('all_published');

-- Crear y procesar job manualmente (sin edge function)
select public.exports_launch('pid', 'all_published');
-- copiar el uuid devuelto
select public.exports_process_pending('<uuid>');
select status, records_processed, records_failed
from public.export_jobs where id = '<uuid>';
```

### Tarea 2 · Desplegar la Edge Function

```bash
npx supabase functions deploy export-worker
```

Verifica:
```bash
curl -X POST https://<project>.supabase.co/functions/v1/export-worker \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{}'
# Debe responder { "ok": true, "processed_count": N, "results": [...] }
```

**Importante**: en v1 la función simula éxito (no llama al PID real).
Cuando tengamos credenciales del PID:
1. Descomentar el bloque de fetch real en `index.ts` dentro de
   `sendToEndpoint()`.
2. Configurar secrets:
   ```bash
   npx supabase secrets set PID_ENDPOINT_URL=...
   npx supabase secrets set PID_API_KEY=...
   ```
3. Redesplegar: `npx supabase functions deploy export-worker`

### Tarea 3 · Añadir la ruta `/exports` en el CMS

Seguir `ExportsPage.integration.md` sección 3:

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
      onOpenJobDetail={(jobId) => navigate(`/exports/${jobId}`)}
    />
  );
}

// En AppRoutes:
<Route path="/exports" element={<ExportsRoute />} />
```

### Tarea 4 · Visibilidad por rol

Añadir el item "Exportaciones" en la sidebar solo para roles `admin`
y `platform`. Ver integration.md sección 4.

### Tarea 5 · Test E2E (checklist integration.md sección 5)

Los puntos más importantes:
- Crear job con "Todos los publicados" + tipo PID → debe procesarse
  en <10 segundos y terminar con estado "Éxito".
- Crear job sabiendo que hay recursos incompletos → pre-validación
  detecta los fallos y los agrupa con categoría "content".
- Si un recurso tiene relaciones (del paso 8) → el payload JSON-LD
  incluye `isPartOf`, `isRelatedTo`, etc. automáticamente.

### Tarea 6 · Commit

```
feat(db): migración 030 · export_jobs ampliada + export_job_records + RPCs (scr13-a · t1)
feat(edge): export-worker Edge Function asíncrona (scr13-a · t2)
feat(shared): modelo ExportJob + helpers formato (scr13-a · t3a)
feat(cms): useExports hook con auto-refresh adaptativo (scr13-a · t3b)
feat(cms): ExportsKpisBar + ExportsFiltersPanel + ExportsTable (scr13-a · t3c)
feat(cms): ExportLauncherDialog con 3 pasos y pre-validación (scr13-a · t3d)
feat(cms): ExportsPage orquestador + ruta /exports (scr13-a · t4)
docs: checklist E2E SCR-13 fase A (scr13-a · t5)
```

---

## Lo que NO tocar

- El wizard, el listado, el dashboard ni otras pantallas. Fase A
  funciona de forma independiente. La integración con listado y
  dashboard viene en la Fase B.
- La columna `job_type` del `export_jobs` original (solo se amplía
  el check constraint a 4 valores).

## Avisos importantes

### 1. La simulación no llama al PID de verdad

En v1 la función `sendToEndpoint` en la Edge Function está simulada
(devuelve éxito). Es intencional: permite demostrar toda la UI y
trazabilidad sin depender de credenciales del PID que la
Mancomunidad aún no tiene. Cuando estén, solo hay que descomentar
el bloque real de fetch y desplegar la función.

### 2. Sin edge function desplegada el sistema sigue funcionando

Si no puedes desplegar la Edge Function en entorno local, el RPC
`exports_launch` crea el job en estado `pending` pero nadie lo
procesa. Para probar manualmente:

```sql
select public.exports_process_pending('<job-id>');
```

Esto ejecuta el worker sincronamente (misma lógica, menos realista).

### 3. Un job no puede reintentarse todavía

La tabla ya tiene la columna `retry_of` y el RPC `exports_retry`
está preparado en la Fase B. Por ahora, si un job falla, hay que
crear uno nuevo.

## Próximo módulo

**SCR-13 Fase B**: drawer de detalle + descargas + reintento +
integración con listado/dashboard. Cuando integres la Fase A,
escríbeme "fase B exportaciones".
