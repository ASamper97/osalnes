/**
 * DashboardRoute — entry point de la ruta `/` (SCR-02 dashboard operativo).
 *
 * Orquesta el `DashboardPage` "dumb" con:
 *   - `useDashboard` (6 RPCs paralelas + auto-refresh 60s cuando la
 *     pestaña es visible).
 *   - Rol del usuario desde `useAuth().user.user_metadata.role` via
 *     `parseUserRole()`.
 *   - Contadores de catálogo (municipios, categorías) via `api.ts`.
 *
 * Decisiones divergentes del integration.md:
 *   - `useCurrentUser`/`useTypologies`/`useMunicipalities`/`useCategories`
 *     NO existen como hooks: reutilizamos `useAuth()` + `api.get*()`
 *     (mismo patrón de ResourcesRoute del listado A).
 *   - `onCancelSchedule` llama a `change_resource_status` con
 *     `'borrador'` (valor Spanish real, migración 025 + 026).
 *   - `onOpenResource(id)` → `/resources/:id` (ruta real del wizard,
 *     no `/edit` sufijo del prompt template).
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { api, type TypologyItem, type MunicipalityItem, type CategoryItem } from '@/lib/api';
import { useDashboard, type SupabaseLike } from '@/hooks/useDashboard';
import { parseUserRole } from '@osalnes/shared/data/rbac';
import DashboardPage from '@/pages/DashboardPage';
import '@/pages/dashboard.css';

export default function DashboardRoute() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Carga lazy de typologies/municipalities/categories (los 3 están
  // cacheados por `api.ts` con TTL, así que repetir es barato).
  const [typologies, setTypologies] = useState<TypologyItem[]>([]);
  const [municipalities, setMunicipalities] = useState<MunicipalityItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);

  useEffect(() => {
    void api.getTypologies().then(setTypologies).catch(() => setTypologies([]));
    void api.getMunicipalities().then(setMunicipalities).catch(() => setMunicipalities([]));
    void api.getCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  // Rol del usuario (decisión 3-C). `parseUserRole` normaliza variantes
  // en castellano ('administrador', 'operador', ...) y devuelve
  // 'unknown' si no hay metadata.
  const role = useMemo(() => parseUserRole(user?.user_metadata), [user]);

  // Estado del dashboard
  const state = useDashboard({
    supabase: supabase as unknown as SupabaseLike,
    autoRefresh: true,
  });

  // Resolver label humano de tipología (desde TypologyItem.name.es)
  const typologyLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of typologies) m.set(t.typeCode, t.name?.es ?? t.typeCode);
    return m;
  }, [typologies]);

  const resolveTypologyLabel = (key: string | null): string => {
    if (!key) return '—';
    return typologyLabelMap.get(key) ?? key;
  };

  return (
    <DashboardPage
      state={state}
      role={role}
      municipalitiesCount={municipalities.length}
      categoriesCount={categories.length}
      resolveTypologyLabel={resolveTypologyLabel}
      onNavigate={(href) => navigate(href)}
      onOpenResource={(id) => navigate(`/resources/${id}`)}
      onCancelSchedule={async (id) => {
        // Devuelve el recurso a borrador (cancela la programación
        // automática del cron). Valor Spanish del CHECK real.
        const { error } = await supabase.rpc('change_resource_status', {
          p_resource_id: id,
          p_new_status: 'borrador',
        });
        if (error) throw error;
        await state.refetch();
      }}
    />
  );
}
