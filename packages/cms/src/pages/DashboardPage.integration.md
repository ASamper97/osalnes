# Integración · Dashboard operativo (SCR-02)

Reemplaza el dashboard actual por la versión nueva con:
- 6 KPIs clicables del listado A
- Widget "Mi trabajo" con borradores del usuario
- "Próximas publicaciones programadas" (del paso 7b)
- Indicadores UNE 178502 calculados en vivo
- Progreso de traducción por idioma (clicable → listado filtrado)
- Calidad del dato con 3 barras accionables
- Última exportación PID
- Actividad reciente con iconografía legible
- Alertas inline accionables
- Visibilidad por rol (5 roles del pliego)
- Auto-refresh cada 60s cuando la pestaña está visible

---

## 1) Aplicar migración 028

```bash
npx supabase db push
```

Verificar:
```sql
-- Overview devuelve 1 fila:
select * from public.dashboard_get_overview();

-- My work devuelve borradores del usuario logueado:
select * from public.dashboard_get_my_work(6);

-- Próximas programadas:
select * from public.dashboard_get_upcoming_scheduled(5);

-- Traducciones:
select * from public.dashboard_get_translation_progress();

-- Indicadores UNE:
select * from public.dashboard_get_une_indicators();

-- Actividad (si audit_log existe, la usa; si no, fallback):
select * from public.dashboard_get_recent_activity(10, false);

-- Tabla export_jobs (para widget "Última exportación"):
select count(*) from public.export_jobs;
```

## 2) Reemplazar la ruta `/` o `/dashboard`

`packages/cms/src/routes/DashboardRoute.tsx` (o como se llame):

```tsx
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useTypologies } from '../hooks/useTypologies';
import { useMunicipalities } from '../hooks/useMunicipalities';
import { useCategories } from '../hooks/useCategories'; // si existe
import { useDashboard } from '../hooks/useDashboard';
import { parseUserRole } from '@osalnes/shared/data/rbac';
import DashboardPage from '../pages/DashboardPage';
import '../pages/dashboard.css';

export default function DashboardRoute() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { getLabel: getTypologyLabel } = useTypologies();
  const { municipalities } = useMunicipalities();
  const { categories } = useCategories();

  // Resolver el rol del usuario actual (decisión 3-C)
  const role = useMemo(
    () => parseUserRole(user?.user_metadata),
    [user],
  );

  // Estado del dashboard (hook hace 6 RPCs en paralelo + auto-refresh 60s)
  const state = useDashboard({
    supabase,
    autoRefresh: true,
  });

  return (
    <DashboardPage
      state={state}
      role={role}
      municipalitiesCount={municipalities.length}
      categoriesCount={categories.length}
      resolveTypologyLabel={(key) => getTypologyLabel(key) ?? key ?? '—'}

      onNavigate={(href) => navigate(href)}
      onOpenResource={(id) => navigate(`/resources/${id}/edit`)}

      onCancelSchedule={async (id) => {
        const { error } = await supabase.rpc('change_resource_status', {
          p_resource_id: id,
          p_new_status: 'draft',
        });
        if (error) throw error;
        // Refrescar dashboard tras cancelar
        await state.refetch();
      }}
    />
  );
}
```

## 3) Configurar el rol del usuario en Supabase

El hook `parseUserRole` lee `user.user_metadata.role`. Para que funcione
hay que asignar rol al crear usuarios. En Supabase Dashboard → Authentication
→ Users → cualquier usuario → Metadata:

```json
{
  "role": "admin"
}
```

Valores aceptados (se normalizan):
- `"admin"` o `"administrator"` o `"administrador"` → RBAC-01
- `"platform"` o `"gestor_plataforma"` → RBAC-02
- `"operator"` o `"operador"` → RBAC-03
- `"agency"` o `"agencia"` → RBAC-04
- `"tourism_manager"` o `"gestor_turistico"` → RBAC-05

Si no hay metadata, el usuario ve el dashboard mínimo (solo
quickActions + statusKpis).

Cuando venga SCR-14 (Gestión de usuarios), esta asignación se hará
desde la UI del CMS, no manualmente en Supabase Dashboard.

## 4) Borrar el dashboard legacy

Eliminar los ficheros del dashboard actual:
- Componente monolítico de dashboard actual.
- Sus helpers si los había.
- Los estilos propios del dashboard viejo.

No tocar la entrada del menú lateral "Dashboard" — sigue apuntando a la
misma ruta.

## 5) Configurar `useCategories` si no existe

Si el hook `useCategories` no está aún en el repo, hay 2 opciones:
- **A)** Crearlo con un fetch simple:
  ```tsx
  const { data } = await supabase.from('categories').select('id, name');
  ```
- **B)** Pasar hardcoded `categoriesCount={17}` como dato estático
  temporal y crear el hook en iteración futura.

El widget "Catálogo del destino" solo usa el count, no las categorías
completas.

## 6) Checklist E2E

### KPIs + navegación
- [ ] Al cargar, aparecen 6 cards con valores (puede tardar 1-2s).
- [ ] Click en "Publicados" → listado con filtro `status=published`.
- [ ] Click en "Programados" → listado con filtro `status=scheduled`.
- [ ] Click en "Incompletos" → listado con filtro `incomplete=1`.
- [ ] Si hay programados, card "Programados" pulsa en azul.
- [ ] Si hay incompletos, card "Incompletos" está resaltada en amarillo.

### Alertas
- [ ] Si hay recursos visibles en mapa sin coordenadas → banner rojo.
- [ ] Si hay recursos sin imagen → banner amarillo.
- [ ] CTA "Corregir" navega al listado con filtro correcto.
- [ ] Máximo 2 alertas simultáneas (prioriza las críticas).

### Mi trabajo
- [ ] Muestra borradores del usuario logueado de últimas 2 semanas.
- [ ] Click en un borrador → abre editor.
- [ ] Click en "Ver todos mis borradores" → listado filtrado.
- [ ] Muestra nota de calidad circular coloreada.
- [ ] Indica "N obligatorios sin rellenar" si pidMissing > 0.

### Próximas publicaciones
- [ ] Solo aparece el widget si hay ≥1 programada.
- [ ] Lista hasta 5 próximas ordenadas por fecha más cercana.
- [ ] Chip de tiempo: "mañana · 10:30", "en 3 días", "en 2 h".
- [ ] Chip pulsa en amarillo si falta <24h.
- [ ] Botón ✕ cancela la programación → pasa a draft → dashboard refresca.

### Indicadores UNE
- [ ] 6 cards: Digitalización, Multilingüismo, Georreferenciación,
      Actualización 30d, Actualización 90d, Interoperabilidad PID.
- [ ] Cada card muestra letra A/B/C/D + porcentaje + descripción.
- [ ] Colores: A verde / B lima / C amarillo / D rojo.
- [ ] Interoperabilidad PID = D 0% hasta que haya export exitoso.

### Traducciones
- [ ] 5 filas: Español, Galego, English, Français, Português.
- [ ] Cada una muestra progreso 0-100%.
- [ ] Si hay pendientes en EN/FR/PT/GL, click navega a listado filtrado.
- [ ] ES no es clicable (todos tienen ES).

### Actividad reciente
- [ ] Muestra últimas 10 acciones.
- [ ] Icono según acción (✨ crear, ✏️ modificar, 🚀 publicar...).
- [ ] Email del actor truncado si es largo.
- [ ] Click en nombre del recurso → abre editor.
- [ ] Fallback a `updated_at` de resources si audit_log no existe.

### Por rol
- [ ] Admin ve todos los widgets.
- [ ] Operador NO ve: Indicadores UNE, Distribución catálogo, Última exportación.
- [ ] Agencia NO ve: Alertas globales, Exportaciones, Indicadores UNE, Actividad del equipo.
- [ ] Sin rol asignado solo ve: Accesos rápidos + KPIs.
- [ ] Accesos rápidos cambian según rol (ver `rbac.ts`).

### Auto-refresh
- [ ] Tras 60s en la pestaña, los datos se refrescan silenciosamente.
- [ ] Cambiar a otra pestaña y volver → refresco inmediato al retornar (por el check de `visibilityState`).
- [ ] Botón ↻ manual funciona en cualquier momento.
- [ ] Indicador "Actualizado hace X min" visible en el header.
