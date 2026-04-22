# Prompt maestro · Dashboard operativo (SCR-02)

**Pega este contenido en Claude Code.**

Reemplazo completo del dashboard actual siguiendo SCR-02 del pliego. 10
widgets con visibilidad por rol, KPIs clicables, alertas accionables,
auto-refresh 60s.

## Decisiones aplicadas

- **1-C**: alcance amplio (mi trabajo + próximas programadas + actividad).
- **2-A**: tabla `export_jobs` mínima creada ahora (desbloquea widget).
- **3-C**: rol leído desde `user_metadata.role` con reglas inline.
- **4-C**: accesos rápidos dinámicos por rol (6 configuraciones distintas).
- **5-A**: widget propio de "Próximas publicaciones programadas".
- **6-A**: desktop-first con responsive básico a 700px.
- **7-A**: auto-refresh 60s solo si pestaña visible.

## Ficheros en el repo

```
osalnes-dti/
├── database/migrations/
│   ├── 028_dashboard_rpcs.sql
│   └── 028_dashboard_rpcs.down.sql
│
├── packages/shared/src/data/
│   ├── dashboard.ts          (tipos + mappers + formateo)
│   └── rbac.ts               (roles + visibilidad widgets + quick actions)
│
├── packages/cms/src/
│   ├── hooks/
│   │   └── useDashboard.ts
│   ├── components/dashboard/
│   │   ├── DashboardAlerts.tsx
│   │   ├── QuickActionsWidget.tsx
│   │   ├── MyWorkWidget.tsx
│   │   ├── StatusKpisWidget.tsx
│   │   ├── UpcomingScheduledWidget.tsx
│   │   ├── UneIndicatorsWidget.tsx
│   │   ├── TranslationProgressWidget.tsx
│   │   ├── DataQualityWidget.tsx
│   │   ├── CatalogContextWidget.tsx
│   │   ├── LastExportWidget.tsx
│   │   └── RecentActivityWidget.tsx
│   └── pages/
│       ├── DashboardPage.tsx
│       ├── dashboard.copy.ts
│       ├── dashboard.css
│       └── DashboardPage.integration.md
│
└── prompts/
    └── 13_dashboard.md
```

---

## Tareas en orden

### Tarea 1 · Migración 028

```bash
npx supabase db push
```

Verificar las 6 RPCs + tabla `export_jobs` según integration.md sección 1.

**Nota crítica**: la RPC `dashboard_get_une_indicators` depende de la
función `band_from_percent` que ahora existe. Si hay otra versión en
migraciones anteriores, la 028 la sobrescribe con `create or replace`.
No rompe nada.

### Tarea 2 · Conectar ruta

Seguir integration.md sección 2. La ruta `/` o `/dashboard` debe
reemplazar el componente actual por `DashboardRoute` con el hook
`useDashboard` y las props correctas.

**Importante**:
- El hook `useCurrentUser` debe devolver el objeto `user` de Supabase
  con `user_metadata.role`. Si no lo devuelve, ajustar antes.
- Si `useCategories` no existe, usar solución B de sección 5 (pasar
  count hardcoded) temporalmente.

### Tarea 3 · Asignar rol a usuarios en Supabase

Mínimo al usuario admin. En Supabase Dashboard → Auth → Users →
metadata JSON:

```json
{ "role": "admin" }
```

Valores aceptados documentados en integration.md sección 3.

### Tarea 4 · Borrar el dashboard legacy

Eliminar los ficheros del dashboard actual completamente. El nuevo es
autónomo.

**Mantener**: la entrada del menú lateral "Dashboard" apuntando a la
misma ruta.

### Tarea 5 · Import del CSS

Al final de los imports globales (o directamente en `DashboardRoute`):

```tsx
import './pages/dashboard.css';
```

### Tarea 6 · Test E2E

40+ puntos del checklist en integration.md sección 6. Priorizar:

1. **Clicabilidad de todo** — ningún KPI/barra/item es estático.
2. **Role matrix funciona** — probar con usuario operador y ver que no ve UNE.
3. **Auto-refresh** — dejar 60s la pestaña y ver que se actualiza.
4. **Upcoming programadas** — programar una publicación y verificar que aparece.

---

## Lo que NO tocar

- El wizard de recursos.
- El listado de recursos (A/B).
- Las migraciones anteriores 000-027.

## Mensajes de commit

```
feat(db): migración 028 · RPCs del dashboard + tabla export_jobs (dashboard · t1)
feat(shared): modelo dashboard + RBAC con visibilidad por widget (dashboard · t2a)
feat(cms): useDashboard con fetch paralelo y auto-refresh 60s (dashboard · t2b)
feat(cms): 11 widgets del dashboard operativo (dashboard · t2c)
feat(cms): DashboardPage orquestador con 7 filas (dashboard · t2d)
chore(cms): eliminar dashboard legacy (dashboard · t4)
docs: checklist E2E dashboard operativo (dashboard · t6)
```
