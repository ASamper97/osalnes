/**
 * ResourcesRoute — entry point for SCR-03 listado (fase A)
 *
 * Orquesta `ResourcesListPage` con las opciones de tipologías/municipios
 * fetched al montar y los handlers contra supabase-js + RPC
 * `change_resource_status` (migración 026).
 *
 * Decisiones divergentes del integration.md:
 *   - `useTypologies` / `useMunicipalities` / `useCurrentUser` NO existen
 *     en este repo (se documentaban como "ya existen"). Inline los fetches
 *     con `api.getTypologies()` / `api.getMunicipalities()` + `useAuth()`.
 *   - `onRenameResource` NO escribe a `recurso_turistico.name_es` (no
 *     existe como columna); upsertea a `traduccion` con UNIQUE
 *     `(entidad_tipo, entidad_id, campo, idioma)`.
 *   - `onDuplicate` es placeholder `alert(...)` hasta la fase B.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { api, type TypologyItem, type MunicipalityItem } from '@/lib/api';
import { useResourcesList, type SupabaseLike } from '@/hooks/useResourcesList';
import ResourcesListPage from '@/pages/ResourcesListPage';
import type { TypologyOption, MunicipalityOption } from '@/components/listado/ListFiltersPanel';
import type { ListResourceRow } from '@osalnes/shared/data/resources-list';
import '@/pages/listado.css';

// Mapeo rdf_type → grupo raíz (misma tabla que el legacy ResourcesPage).
// Si el rdf_type no está en el mapa, cae a 'general' como fallback
// (decisión documentada en el prompt).
const TYPE_TO_GROUP: Record<string, string> = {
  Hotel: 'alojamiento', RuralHouse: 'alojamiento', BedAndBreakfast: 'alojamiento',
  Campground: 'alojamiento', Hostel: 'alojamiento', Apartment: 'alojamiento',
  Restaurant: 'restauracion', BarOrPub: 'restauracion', CafeOrCoffeeShop: 'restauracion',
  Winery: 'restauracion', Brewery: 'restauracion', IceCreamShop: 'restauracion',
  Beach: 'recurso', Museum: 'recurso', Park: 'recurso', TouristAttraction: 'recurso',
  ViewPoint: 'recurso', LandmarksOrHistoricalBuildings: 'recurso', Monument: 'recurso',
  Trail: 'recurso', Cave: 'recurso', NaturePark: 'recurso',
  Event: 'evento', Festival: 'evento', MusicEvent: 'evento', SportsEvent: 'evento',
  BusStation: 'transporte', Port: 'transporte', TrainStation: 'transporte',
  TouristInformationCenter: 'servicio', Hospital: 'servicio', Pharmacy: 'servicio',
};

const GROUP_LABELS: Record<string, string> = {
  alojamiento:  'Alojamiento',
  restauracion: 'Restauración',
  recurso:      'Recursos turísticos',
  evento:       'Eventos',
  transporte:   'Transporte',
  servicio:     'Servicios',
  general:      'General',
};

export default function ResourcesRoute() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const currentUserId = profile?.id ?? null;

  // ─── Cargar typologies/municipalities una vez al montar ────────────
  const [typologies, setTypologies] = useState<TypologyItem[]>([]);
  const [municipalities, setMunicipalities] = useState<MunicipalityItem[]>([]);

  useEffect(() => {
    void api.getTypologies().then(setTypologies).catch(() => setTypologies([]));
    void api.getMunicipalities().then(setMunicipalities).catch(() => setMunicipalities([]));
  }, []);

  // ─── Hook del listado (RPC list_resources + KPIs + URL sync) ──────
  //
  // El tipo `SupabaseLike` del hook es estructuralmente más estricto que
  // el tipo real de `@supabase/supabase-js` (la librería devuelve
  // PostgrestFilterBuilder/Promise con shape más rico). Cast para
  // evitar el error TS2322 sin relajar el tipo del hook.
  const state = useResourcesList({
    supabase: supabase as unknown as SupabaseLike,
    currentUserId,
    syncWithUrl: true,
  });

  // ─── Transformar a opciones del panel de filtros ──────────────────
  const typologyOptions: TypologyOption[] = useMemo(
    () => typologies.map((t) => {
      const group = TYPE_TO_GROUP[t.typeCode] ?? t.grupo ?? 'general';
      return {
        key: t.typeCode,
        label: t.name?.es ?? t.typeCode,
        rootCategory: group,
        rootCategoryLabel: GROUP_LABELS[group] ?? group,
      };
    }),
    [typologies],
  );

  const municipalityOptions: MunicipalityOption[] = useMemo(
    () => municipalities.map((m) => ({
      id: m.id,
      name: m.name?.es ?? m.slug,
    })),
    [municipalities],
  );

  const typologyLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of typologies) m.set(t.typeCode, t.name?.es ?? t.typeCode);
    return m;
  }, [typologies]);

  const resolveTypologyLabel = (key: string | null) => {
    if (!key) return '—';
    return typologyLabelMap.get(key) ?? key;
  };

  return (
    <ResourcesListPage
      state={state}
      typologies={typologyOptions}
      municipalities={municipalityOptions}
      resolveTypologyLabel={resolveTypologyLabel}
      onCreateNew={() => navigate('/resources/new')}
      onOpenEdit={(id) => navigate(`/resources/${id}`)}
      onOpenPreview={(_id, slug) => {
        // La web pública usa turismo.osalnes.gal/es/recurso/{slug} (paso 6 · t5)
        window.open(`https://turismo.osalnes.gal/es/recurso/${slug}`, '_blank');
      }}
      onRenameResource={async (id, newNameEs) => {
        // El nombre vive en la tabla `traduccion` (no como columna de
        // recurso_turistico). UPSERT con la UNIQUE (entidad_tipo,
        // entidad_id, campo, idioma) evita crear duplicados.
        const { error } = await supabase
          .from('traduccion')
          .upsert({
            entidad_tipo: 'recurso_turistico',
            entidad_id: id,
            campo: 'name',
            idioma: 'es',
            valor: newNameEs,
          }, { onConflict: 'entidad_tipo,entidad_id,campo,idioma' });
        if (error) throw error;
      }}
      onChangeStatus={async (id, newStatus: ListResourceRow['publicationStatus']) => {
        const { error } = await supabase.rpc('change_resource_status', {
          p_resource_id: id,
          p_new_status: newStatus,
        });
        if (error) throw error;
      }}
      onDuplicate={async (_id) => {
        // Placeholder hasta la fase B del listado (prompt 11 explícito).
        // La implementación real (RPC `duplicate_resource`) copiará el
        // recurso + imágenes + tags + videos + documentos + SEO +
        // translations con nuevo UUID y slug con sufijo "-copia".
        alert(
          'Duplicar está pendiente de implementar (Listado fase B).\n\n' +
          'Mientras tanto puedes abrir el recurso, copiar manualmente los campos y crear uno nuevo.',
        );
      }}
      onViewHistory={(id) => navigate(`/resources/${id}?scrollTo=audit-log`)}
      onDeleteResource={async (id) => {
        const { error } = await supabase
          .from('recurso_turistico')
          .delete()
          .eq('id', id);
        if (error) throw error;
      }}
      onArchiveResource={async (id) => {
        const { error } = await supabase.rpc('change_resource_status', {
          p_resource_id: id,
          p_new_status: 'archivado',
        });
        if (error) throw error;
      }}
    />
  );
}
