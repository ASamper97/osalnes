# Integración · SCR-10 Gestor de taxonomías

Gestor unificado de catálogos (municipios, zonas, tipologías UNE,
categorías, productos turísticos) con master-detail, editor multi-tab,
soft-delete y vista de uso.

## Prerrequisitos

- Migraciones 000-031 aplicadas (incluye `traduccion`, `municipio`,
  `recurso_turistico.rdf_type`, función `tr_get(text, uuid, text, text)`).
- Rol de usuario resuelto: admin / platform / tourist_manager / operator.

## 1) Aplicar query PREFLIGHT (sin modificar nada)

Antes de aplicar la migración 032, ejecutar la query
`database/migrations/032_taxonomies.PREFLIGHT.sql` en SQL Editor de
Supabase. El output confirma qué tablas existen y qué hay que crear.

### Resultado esperado

- **Resultset 1**: debería devolver al menos `municipio`. Si aparecen
  `zona`, `tipologia_une`, `categoria` o `producto_turistico`, la
  migración las detecta con `create table if not exists` y solo crea
  las que faltan (no rompe las existentes).

- **Resultset 2**: columnas relacionadas de `recurso_turistico`. Debe
  mostrar `rdf_type`, `rdf_types`, `tourist_types`, `municipio_id`.

- **Resultset 3**: las funciones `tr_get` y `tr_upsert`. Si `tr_upsert`
  no existe, la migración 032 la crea. Si existe con firma distinta,
  hay que ajustar.

- **Resultset 4-5**: estructura de `traduccion` con unique
  `(entidad_tipo, entidad_id, campo, idioma)`. Si el constraint tiene
  nombre distinto pero mismas columnas, funciona igual.

**Si algo difiere del esperado, parar y reportar antes de aplicar 032.**

## 2) Aplicar migración 032

Pegar el contenido completo de `032_taxonomies.sql` en SQL Editor
y pulsar Run.

Verificación:
```sql
-- Tablas nuevas creadas
select count(*) from information_schema.tables
where table_schema = 'public'
  and table_name in ('zona', 'tipologia_une', 'categoria', 'producto_turistico');
-- Esperado: 4 (o menos si ya existían algunas)

-- RPCs nuevas
select proname from pg_proc
where proname in (
  'taxonomy_list', 'taxonomy_get', 'taxonomy_upsert',
  'taxonomy_toggle_active', 'taxonomy_get_usage', 'taxonomy_get_tree'
) and pronamespace = 'public'::regnamespace;
-- Esperado: 6
```

Smoke test:
```sql
-- Listar municipios (ya existentes, deberían salir los 9)
select name, slug, usage_count, usage_published
from public.taxonomy_list('municipio');
-- Esperado: 9 filas

-- Listar tipologías (inicialmente vacío)
select * from public.taxonomy_list('tipologia_une');
-- Esperado: 0 filas

-- Crear una tipología de prueba
select public.taxonomy_upsert(
  p_catalog := 'tipologia_une',
  p_slug := 'playa',
  p_semantic_uri := 'https://schema.org/Beach',
  p_schema_code := 'Beach',
  p_name_es := 'Playa',
  p_name_gl := 'Praia',
  p_name_en := 'Beach',
  p_description_es := 'Playas y calas del litoral'
);
-- Devuelve un UUID

-- Verificar que apareció con sus traducciones
select name, slug, semantic_uri, schema_code
from public.taxonomy_list('tipologia_une');
-- Esperado: 1 fila con name='Playa'
```

## 3) Añadir ruta `/taxonomies` en el router

En `App.tsx` o donde esté definido el router:

```tsx
import TaxonomiesRoute from './pages/TaxonomiesRoute';

<Route path="/taxonomies" element={<TaxonomiesRoute />} />
```

**Importante**: TaxonomiesRoute.tsx asume que hay un hook `useAuth()`
y una instancia `supabase` disponibles. Ajusta los imports reales del
proyecto (mismo patrón que `ExportsRoute.tsx`).

## 4) Importar CSS

Donde estén los imports de CSS del CMS, añadir:

```tsx
import './pages/taxonomies.css';
```

## 5) Añadir item en sidebar

Patrón idéntico al de "Exportaciones" (Fase A SCR-13):

```tsx
<NavLink to="/taxonomies">🏷 Taxonomías</NavLink>
```

Con RBAC — visible para roles que puedan editar **al menos un**
catálogo:
- `admin` → todo
- `platform` → todo excepto URIs semánticas (warning)
- `tourist_manager` → solo zona + producto_turistico + categoria
- `operator` → sólo lectura (puede entrar y ver, pero no editar)

## 6) Checklist E2E

### Navegación
- [ ] `/taxonomies` carga con "Municipios" seleccionado por defecto.
- [ ] Click en cada catálogo del panel izquierdo → cambia la lista.
- [ ] Selector responde al click sin recargar.

### Municipios (readonly)
- [ ] Banner azul informa que son readonly.
- [ ] Los 9 concellos aparecen con nombre en español.
- [ ] Usage chips muestran N publicados + N borrador por municipio.
- [ ] NO aparece botón "+ Nuevo término".

### Tipologías UNE (crear nuevo)
- [ ] Click "+ Nuevo término" abre el editor.
- [ ] El editor pide slug + URI semántica + schema_code.
- [ ] Datalist de schema codes sugiere Beach, Hotel, Restaurant, etc.
- [ ] Tab ES rellenado → guardar crea el término.
- [ ] Término aparece en la lista con chip verde publicado=0.
- [ ] Tab GL / EN vacíos → muestra dot solo si tienen contenido.

### Warning URI semántica (decisión 4-C)
- [ ] Crear tipología sin `semantic_uri` → aviso amarillo en
      el editor.
- [ ] Tras guardar, aparece chip amarillo "⚠ Sin URI semántica"
      en la lista.
- [ ] Si añades la URI y guardas, el chip desaparece.

### Categorías jerárquicas (decisión 2-B)
- [ ] Al crear categoría, aparece selector "Término padre".
- [ ] Seleccionar otra categoría como padre → se guarda.
- [ ] La lista muestra chip "Con subcategorías" en el padre.
- [ ] Zonas y productos también admiten parent.
- [ ] Municipios y tipologías NO muestran selector de parent.

### Traducciones multi-tab (decisión 3-C)
- [ ] Las 3 pestañas (ES / GL / EN) son clickables en el editor.
- [ ] Rellenar ES y EN (dejar GL vacío) → guardar.
- [ ] Reabrir el término → ES y EN rellenos, GL vacío.
- [ ] Las pestañas con contenido muestran un puntito verde.

### Ver uso (decisión 5-B)
- [ ] Click "Ver uso" en una tipología que se use → drawer derecho
      con lista de recursos.
- [ ] Cada fila muestra nombre + slug + chip de estado.
- [ ] Click en fila → navega a `/resources/:id/edit`.
- [ ] Zonas/categorías/productos muestran banner "uso indirecto"
      (sin recursos listados, decisión de modelo).

### Soft delete (decisión 6-C)
- [ ] Click "🚫" en un término activo → modal de confirmación.
- [ ] Confirmar → el término queda inactivo.
- [ ] Por defecto deja de aparecer en la lista.
- [ ] Activar "Mostrar inactivos" → vuelve a aparecer con
      chip "Inactivo".
- [ ] Click "✓" en un inactivo → modal de reactivación.
- [ ] Confirmar → vuelve activo.

### RBAC (decisión 7-C)
- [ ] Usuario con rol `admin` → puede editar todo.
- [ ] Usuario con rol `platform` → puede editar todo.
- [ ] Usuario con rol `tourist_manager` → al entrar en Tipologías UNE
      ve banner amarillo "No tienes permisos". NO aparece
      "+ Nuevo término". NO aparecen botones editar / desactivar.
- [ ] Mismo rol en Zonas → sí puede editar.

## Deuda abierta

### 1. Uso de zona / categoria / producto_turistico
Actualmente `taxonomy_get_usage` devuelve vacío para estos 3 catálogos
porque no hay tabla many-to-many `recurso_zona`, `recurso_categoria`,
etc. en la BD. Hay dos opciones:

- **A** Crear tablas intermedias (`recurso_zona`, `recurso_categoria`,
  `recurso_producto`). Cambio de modelo mayor.
- **B** Almacenar los IDs en `recurso_turistico.extras` JSONB
  (campo `category_ids`, `zone_ids`, `product_ids`). Menos normalizado
  pero no requiere migración de tablas.

Decidir antes de SCR-11 (mapa) o SCR-03 actualizado, porque ambos
van a querer filtrar por zona/categoría.

### 2. Detección de ciclos en jerarquías
El editor actualmente impide seleccionar el propio término como padre,
pero NO detecta ciclos de más de un nivel (A padre de B, B padre de A).
Si se vuelve problema en producción, hay que añadir validación BFS en
`taxonomy_upsert` (similar a `fn_resource_relations_cycle_check` de
la migración 029).

### 3. Migración de tipologías existentes
Si los recursos productivos ya tienen valores en `rdf_type`, hay que
poblar `tipologia_une` con una entrada por cada valor distinto usado.
Script sugerido:

```sql
insert into public.tipologia_une (slug, schema_code, semantic_uri, is_active)
select distinct
  lower(regexp_replace(rdf_type, '([A-Z])', '-\1', 'g')),
  rdf_type,
  'https://schema.org/' || rdf_type,
  true
from public.recurso_turistico
where rdf_type is not null
on conflict (slug) do nothing;

-- Añadir traducciones por defecto
insert into public.traduccion (entidad_tipo, entidad_id, campo, idioma, valor)
select 'tipologia_une', t.id, 'name', 'es', t.schema_code
from public.tipologia_une t
on conflict do nothing;
```
