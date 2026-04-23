# Integración · SCR-10 Gestor de taxonomías (v2)

Gestor unificado de catálogos. **Versión v2 adaptada al esquema real**
del proyecto tras PREFLIGHT.

## Cambios clave respecto a la v1 (descartada)

- Catálogo `tipologia_une` → `tipologia` (nombre real de tabla).
- Slug → `type_code` (vía alias en RPC, frontend no cambia).
- `is_active` → `activo` (vía alias en RPC).
- Campo `grupo` (alojamiento/restauracion/recurso/evento/transporte) expuesto
  en listado y editor.
- La tabla `tipologia` ya tiene **69 valores productivos** con `schema_org_type`.
- `ALTER TABLE ADD COLUMN IF NOT EXISTS` para ampliar sin destruir datos.

## 1) Aplicar migración 032 v2

PREFLIGHT ya realizado y validado (catálogo existente confirmado). Aplicar
directamente.

1. Abrir SQL Editor de Supabase.
2. Pegar contenido completo de `database/migrations/032_taxonomies.sql` v2.
3. Pulsar Run.

### Qué hace la migración

1. **Añade columnas faltantes** a `tipologia`: `semantic_uri`, `sort_order`,
   `updated_at`. Crea trigger `set_updated_at_tipologia`.
2. **Añade columnas faltantes** a `producto_turistico`: `parent_id`,
   `semantic_uri`, `sort_order`, `updated_at`. Crea trigger.
3. **Añade columnas faltantes** a `categoria`: `parent_id`, `semantic_uri`,
   `sort_order`, `is_active`, `updated_at`. Crea trigger.
4. **Añade columnas faltantes** a `zona`: `parent_id`, `semantic_uri`,
   `sort_order` (zona ya tiene su propio `updated_at` y trigger).
5. **Pobla `semantic_uri`** automáticamente en los 69 valores de
   `tipologia` → `https://schema.org/{schema_org_type}`.
6. **Crea `tr_upsert`** (no existía).
7. **Crea 6 RPCs** unificadas (`taxonomy_list`, `taxonomy_get`,
   `taxonomy_upsert`, `taxonomy_toggle_active`, `taxonomy_get_usage`,
   `taxonomy_get_tree`).

### Verificación

```sql
-- 6 RPCs creadas
select count(*) from pg_proc
where proname in ('taxonomy_list','taxonomy_get','taxonomy_upsert',
  'taxonomy_toggle_active','taxonomy_get_usage','taxonomy_get_tree')
  and pronamespace='public'::regnamespace;
-- Esperado: 6

-- tr_upsert creada
select proname from pg_proc
where proname = 'tr_upsert' and pronamespace='public'::regnamespace;
-- Esperado: 1 fila

-- Las 69 tipologías ahora tienen semantic_uri
select count(*) from public.tipologia where semantic_uri is not null;
-- Esperado: 69

-- Columnas nuevas en tipologia
select column_name from information_schema.columns
where table_schema='public' and table_name='tipologia'
  and column_name in ('semantic_uri','sort_order','updated_at')
order by column_name;
-- Esperado: 3 filas

-- Smoke test: listado de tipologías con grupo
select name, slug, schema_code, grupo, usage_count
from public.taxonomy_list('tipologia')
order by grupo, slug
limit 10;
-- Esperado: 10 filas con nombres como Beach/ArtGallery/BarOrPub + grupo poblado
```

## 2) Añadir ruta `/taxonomies`

En `App.tsx`:

```tsx
import TaxonomiesRoute from './pages/TaxonomiesRoute';

<Route path="/taxonomies" element={<TaxonomiesRoute />} />
```

Adaptar los `declare const supabase` / `declare const useAuth` de
`TaxonomiesRoute.tsx` al patrón real del proyecto (igual que
`ExportsRoute.tsx`).

## 3) Importar CSS

```tsx
import './pages/taxonomies.css';
```

## 4) Añadir item sidebar

```tsx
<NavLink to="/taxonomies">🏷 Taxonomías</NavLink>
```

Visible para admin, platform, tourist_manager. Operator también puede
verlo (solo lectura).

## 5) Checklist E2E

### Navegación
- [ ] `/taxonomies` carga con **Tipologías seleccionado por defecto** (entramos directos a lo útil con los 69 valores).
- [ ] Click en cada catálogo del panel izquierdo → cambia la lista.

### Tipologías (69 filas productivas)
- [ ] Aparecen ordenadas por `grupo` y luego por `type_code`.
- [ ] Cada fila muestra:
  - Nombre (placeholder = `type_code` si no hay traducción).
  - Chip de color según grupo (azul=alojamiento, naranja=restauracion, verde=recurso, morado=evento, celeste=transporte).
  - URI semántica linkeable (auto-poblada tras la migración).
  - Contador de uso basado en `recurso_turistico.rdf_type = type_code`.
- [ ] Click en "Editar" abre modal con selector de grupo rellenado.
- [ ] Tabs ES/GL/EN inicialmente vacíos (no hay traducciones todavía).

### Crear nueva tipología
- [ ] Botón "+ Nuevo término" visible para admin/platform.
- [ ] Datalist de schema.org sugiere Beach, Hotel, etc.
- [ ] Selector de grupo con las 5 opciones.
- [ ] Guardar crea el término y aparece en la lista con el chip correcto.

### Zonas (46 filas)
- [ ] Aparecen con su parent si tienen.
- [ ] Uso count > 0 si los recursos tienen `zona_id` asignado.

### Categorías (17 filas)
- [ ] Aparecen con parent_id / hasChildren si aplica.
- [ ] Uso count = 0 (no hay relación directa con recurso todavía).

### Productos turísticos (0 filas inicialmente)
- [ ] Lista vacía, empty state correcto.
- [ ] Crear uno → aparece correctamente.

### Municipios (9 filas, readonly)
- [ ] Banner azul informa readonly.
- [ ] Los 9 concellos aparecen con `usage_count` basado en `municipio_id`.
- [ ] No aparece "+ Nuevo término".
- [ ] Botones editar NO aparecen.

### Soft delete
- [ ] Desactivar una tipología → modal con "Los N recursos mantendrán la referencia".
- [ ] Confirmar → desactiva.
- [ ] Por defecto no aparece en lista; activar "Mostrar inactivos" la trae de vuelta.

### RBAC
- [ ] Usuario `tourist_manager` NO ve botones editar en Tipologías.
- [ ] Sí los ve en Zonas, Categorías y Productos.

## Deuda abierta

### 1. Uso de categoría y producto_turistico
La RPC `taxonomy_get_usage` devuelve vacío para estos 2 catálogos. Falta
decidir si se crean tablas many-to-many `recurso_categoria` y
`recurso_producto`, o se guardan IDs en `recurso_turistico.extras`.

### 2. Columna `is_active` en zona
La tabla `zona` no tenía columna `activo` o `is_active` al hacer PREFLIGHT.
La migración la añade on-the-fly desde `taxonomy_toggle_active` la primera
vez que alguien intenta desactivar una zona.

### 3. Traducciones automáticas
Los 69 valores de `tipologia` actualmente no tienen filas en `traduccion`.
La UI muestra `type_code` como fallback. Para rellenarlos en bulk sin
hacerlo uno por uno desde la UI:

```sql
-- Ejemplo: nombre en español igual al type_code
insert into public.traduccion (entidad_tipo, entidad_id, campo, idioma, valor)
select 'tipologia', id, 'name', 'es', type_code
from public.tipologia
where not exists (
  select 1 from public.traduccion t
  where t.entidad_tipo = 'tipologia' and t.entidad_id = public.tipologia.id
    and t.campo = 'name' and t.idioma = 'es'
)
on conflict do nothing;
```

Esto se puede ejecutar luego con los nombres reales curados en español,
gallego e inglés.
