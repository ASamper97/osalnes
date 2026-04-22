# Integración · Listado de recursos (SCR-03 · fase A)

Esta pantalla reemplaza `/resources` (el listado actual con tabs y tabla
básica) por una versión completa según el pliego: KPIs + filtros
facetados + tabla con 9 columnas + paginación + menú "..." + edición
inline + modal de eliminación.

---

## 1) Aplicar migración 026

```bash
npx supabase db push
```

Verificar:
```sql
-- La RPC debe existir y responder:
select * from public.list_resources(
  p_page := 1,
  p_page_size := 5
);

-- KPIs:
select * from public.list_resources_kpis();

-- Función quality score sobre una fila real:
select public.compute_resource_quality_score(r) from public.resources r limit 1;
```

## 2) Comprobar dependencias en tu schema

La RPC asume que la tabla `resources` tiene las siguientes columnas
(todas creadas en pasos anteriores):

- `id`, `name_es`, `name_gl`, `slug`, `single_type_vocabulary`, `created_by`
- `publication_status`, `published_at`, `scheduled_publish_at`
- `latitude`, `longitude`, `visible_on_map`
- `description_es`, `description_gl`
- `municipality_id`, `seo_by_lang`, `translations`
- `updated_at`

Y las tablas auxiliares:
- `public.municipalities` con `id`, `name`, `slug`
- `public.resource_images` con `resource_id`, `alt_text`
- `public.resource_tags` con `resource_id`, `tag_key`
- `public.audit_log` con `resource_id`, `actor_email`, `created_at` (opcional)

Si alguna no existe, la RPC seguirá funcionando pero los campos
derivados relevantes serán NULL o 0.

## 3) Conectar la página en la ruta

`packages/cms/src/routes/ResourcesRoute.tsx` (o equivalente):

```tsx
import { useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useResourcesList } from '../hooks/useResourcesList';
import ResourcesListPage from '../pages/ResourcesListPage';
import { useTypologies } from '../hooks/useTypologies'; // ya debe existir
import { useMunicipalities } from '../hooks/useMunicipalities'; // ya debe existir
import { useNavigate } from 'react-router-dom';
import '../pages/listado.css';

export default function ResourcesRoute() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { typologies, getLabel: getTypologyLabel } = useTypologies();
  const { municipalities } = useMunicipalities();

  const state = useResourcesList({
    supabase,
    currentUserId: user?.id ?? null,
    syncWithUrl: true,
  });

  // Transformar a las opciones del panel de filtros
  const typologyOptions = useMemo(() =>
    typologies.map(t => ({
      key: t.key,
      label: t.label,
      rootCategory: t.rootCategoryKey,
      rootCategoryLabel: t.rootCategoryLabel,
      count: t.count, // si lo tienes
    })), [typologies]);

  const municipalityOptions = useMemo(() =>
    municipalities.map(m => ({ id: m.id, name: m.name })),
    [municipalities]);

  return (
    <ResourcesListPage
      state={state}
      typologies={typologyOptions}
      municipalities={municipalityOptions}
      resolveTypologyLabel={(key) => getTypologyLabel(key) ?? key ?? '—'}

      onCreateNew={() => navigate('/resources/new')}
      onOpenEdit={(id) => navigate(`/resources/${id}/edit`)}
      onOpenPreview={(_id, slug) => window.open(`https://osalnes.gal/recurso/${slug}`, '_blank')}

      onRenameResource={async (id, nameEs) => {
        const { error } = await supabase
          .from('resources')
          .update({ name_es: nameEs })
          .eq('id', id);
        if (error) throw error;
      }}

      onChangeStatus={async (id, newStatus) => {
        const { error } = await supabase.rpc('change_resource_status', {
          p_resource_id: id,
          p_new_status: newStatus,
        });
        if (error) throw error;
      }}

      onDuplicate={async (id) => {
        // Implementación completa en Listado B. Placeholder por ahora:
        alert('Duplicar: pendiente (Listado B)');
      }}

      onViewHistory={(id) => navigate(`/resources/${id}/edit?scrollTo=audit-log`)}

      onDeleteResource={async (id) => {
        const { error } = await supabase.from('resources').delete().eq('id', id);
        if (error) throw error;
      }}

      onArchiveResource={async (id) => {
        const { error } = await supabase.rpc('change_resource_status', {
          p_resource_id: id,
          p_new_status: 'archived',
        });
        if (error) throw error;
      }}
    />
  );
}
```

## 4) Borrar código legacy

En la ruta anterior del listado, eliminar:
- Tabla antigua con tabs y filtros básicos.
- El bloque "Estado del sistema" con "1 en borrador · 0 en revisión".
- Cualquier fetch previo a `resources` que ya no se use.

El nuevo `useResourcesList` hace todo con una sola RPC + una de KPIs.

## 5) Checklist de aceptación

### Dashboard KPI
- [ ] Al entrar, 6 cards arriba: Total · Publicados · Programados · Borradores · Archivados · Incompletos.
- [ ] Cada card es clickable y filtra el listado.
- [ ] La card "Programados" tiene un punto azul pulsante si hay alguno.
- [ ] La card "Incompletos" aparece resaltada en amarillo si hay alguno.

### Filtros
- [ ] Buscador por nombre con debounce 300ms (no lanza query con cada tecla).
- [ ] Dropdown "Tipología" multi-select, agrupado por categoría raíz.
- [ ] Dropdown "Municipio" multi-select.
- [ ] Botón "Filtros" con contador de activos (ej. "Filtros · 3 activos").
- [ ] Drawer lateral con filtros avanzados: idiomas sin traducir, visible en mapa, coordenadas, incompletos, solo mis recursos.
- [ ] Chips de filtros activos debajo de la barra, quitables individualmente.
- [ ] Botón "Limpiar filtros" si hay alguno activo.
- [ ] Filtros persisten en URL (F5 o atrás restaura).

### Tabla
- [ ] 9 columnas: checkbox · Nombre · Tipología · Municipio · Estado · Idiomas · Mapa · Calidad · Actualizado · Acciones.
- [ ] Columnas ordenables: Nombre, Municipio, Calidad, Actualizado (clic en cabecera alterna asc/desc).
- [ ] Subtítulo debajo del nombre muestra el **nombre del municipio**, no el slug (bug #1 del análisis).
- [ ] Badge de tipología coloreado.
- [ ] Badge de estado clickable que abre menú de transiciones.
- [ ] Chips de idioma: verdes si hay contenido, gris tenue si no.
- [ ] Chip de mapa: verde "Visible" / rojo "Sin coordenadas" / gris "Oculto".
- [ ] Badge de calidad circular 0-100 con color por tramo + badge rojo ! si hay obligatorios sin rellenar.
- [ ] Fecha con formato relativo ("hace 3 h") para <7 días, absoluto para más.
- [ ] Si recurso está programado, fila extra con 📅 fecha + cuenta atrás.

### Acciones
- [ ] Botón "Editar" abre la ficha.
- [ ] Doble clic en el nombre activa edición inline (Enter guarda, Escape cancela).
- [ ] Menú "..." con: Vista previa · Duplicar · (Publicar/Despublicar según estado) · Archivar · Ver historial · Eliminar.
- [ ] Clic en "Eliminar" abre modal con 3 botones: Cancelar / Archivar / Eliminar.
- [ ] Todo cambio de estado recarga la tabla automáticamente.

### Paginación
- [ ] Selector tamaño de página: 10/25/50/100.
- [ ] Info "15 recursos · página 1 de 1".
- [ ] Botones anterior/siguiente deshabilitados en los extremos.

### Estados especiales
- [ ] Empty state "No hay recursos que coincidan" con CTA "Limpiar filtros" si hay filtros.
- [ ] Empty state "Aún no hay recursos" con CTA "Crear primer recurso" si la BD está vacía.
- [ ] Error state con botón "Reintentar".

### Responsive
- [ ] <1000px: tabla scroll horizontal, filtros se adaptan.
- [ ] <700px: barra de filtros se apila, paginación se apila.
