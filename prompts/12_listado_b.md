# Prompt maestro · Listado de recursos fase B (SCR-03)

**Pega este contenido en Claude Code.**

Segunda y última fase del rediseño del listado de recursos turísticos.
Amplía la fase A con: acciones masivas, duplicar real, vistas guardadas,
exportación CSV.

## Decisiones aplicadas (ya tomadas)

- **3-A**: acciones masivas completas (publicar/despublicar/archivar/exportar/eliminar).
- **4-A**: duplicar con copia profunda (images + tags + videos + documentos).
- **6-A**: vistas guardadas funcionales (tabla en BD + RLS + UI).
- **8-A**: exportación CSV completa con column picker.

Esta fase **no tiene preguntas nuevas**. Todo está decidido.

## Ficheros en el repo

```
osalnes-dti/
├── database/migrations/
│   ├── 027_bulk_duplicate_savedviews.sql       (NUEVO)
│   └── 027_bulk_duplicate_savedviews.down.sql  (NUEVO)
│
├── packages/shared/src/data/
│   └── resources-list-b.ts                     (NUEVO · SavedView + CSV helpers)
│
├── packages/cms/src/
│   ├── hooks/
│   │   └── useSavedViews.ts                    (NUEVO)
│   ├── components/listado/
│   │   ├── BulkActionsToolbar.tsx              (NUEVO)
│   │   ├── BulkConfirmModal.tsx                (NUEVO)
│   │   ├── SavedViewsMenu.tsx                  (NUEVO)
│   │   ├── SaveViewDialog.tsx                  (NUEVO)
│   │   └── ExportCsvDialog.tsx                 (NUEVO)
│   └── pages/
│       ├── listado-b.css                       (NUEVO · añadir al import)
│       ├── ResourcesListPage.listadoB.integration.md (docs)
│       └── ResourcesListPage.stepB.patch.ts    (docs · instrucciones patch)
│
└── prompts/
    └── 12_listado_b.md                         (este fichero)
```

**MUY IMPORTANTE**: `ResourcesListPage.stepB.patch.ts` **NO es código
ejecutable** — es un fichero de documentación con las instrucciones
para modificar `ResourcesListPage.tsx` (fichero del listado A). Tras
aplicar el patch, este fichero `.patch.ts` debe **borrarse**.

---

## Tareas en orden

### Tarea 1 · Aplicar migración 027

```bash
npx supabase db push
```

Validar:
```sql
-- Duplicar sobre un recurso existente
select public.duplicate_resource((select id from public.resources limit 1));
-- Debe devolver un UUID nuevo.

-- Saved views con RLS
select count(*) from public.saved_views; -- debe ejecutarse sin error

-- RPCs bulk
select public.bulk_change_status(array[]::uuid[], 'draft'); -- devuelve 0
```

### Tarea 2 · Ampliar `ResourcesListPage.tsx`

Seguir la guía en
`packages/cms/src/pages/ResourcesListPage.listadoB.integration.md`
sección 3. Son 10 subsecciones (3.1 a 3.10) que **amplían** el fichero
existente — no lo reemplazan.

Puntos críticos:
- **3.3**: añadir imports + estado sin romper los existentes.
- **3.4**: la vista por defecto se aplica **solo si la URL no trae
  filtros**. Si alguien comparte un link con filtros, la URL prevalece.
- **3.6**: el handler `onDuplicate` existente (que era un alert
  placeholder) se **reemplaza** por la versión real.
- **3.9**: añadir los 4 bloques de render al final del JSX, antes del
  cierre del `<div>` raíz.

Tras aplicar los cambios, **borrar** `ResourcesListPage.stepB.patch.ts`.

### Tarea 3 · Conectar los handlers nuevos en la ruta

Ver sección 4 del integration.md. La ruta `ResourcesRoute.tsx` del
listado A debe ampliarse con las 4 nuevas props + `supabase`.

El handler `onFetchAllFilteredRows` es crítico para exportar: llama a
`list_resources` con `p_page_size: 5000` (o el valor máximo razonable)
para volcar todas las filas del filtro actual.

### Tarea 4 · Añadir import del CSS

En `ResourcesListPage.tsx`, junto al `import './listado.css'`:
```tsx
import './listado-b.css';
```

### Tarea 5 · Test E2E

Los 30+ puntos del checklist en integration.md sección 5. Los más
importantes:

- **Duplicar**: clic en "..." → Duplicar → aparece fila "(copia)" con
  estado borrador, manteniendo imágenes/tags/documentos del original.
- **Bulk publicar**: seleccionar 3 recursos → toolbar flotante abajo →
  Publicar → los 3 cambian a publicado.
- **Vista por defecto**: crear vista con filtros, marcar default, F5 →
  los filtros se aplican solos al cargar.
- **Exportar CSV**: descargar, abrir en Excel, comprobar que los acentos
  gallegos aparecen bien (BOM UTF-8 funciona).

### Tarea 6 · Documentación de cierre

El listado queda **completo** con las fases A+B. Esto cumple los
requisitos SCR-03 del pliego: FR-01, FR-02, FR-04, ENT-01, ENT-04, WF-01.

---

## Lo que NO tocar

- La migración 026 del listado A. Sigue intacta.
- `useResourcesList.ts`. Sigue igual.
- El wizard (ResourceWizardPage).
- Otros módulos del CMS.

## Mensajes de commit sugeridos

```
feat(db): migración 027 · duplicate_resource + saved_views + bulk RPCs (listado-b · t1)
feat(shared): modelo SavedView + CSV helpers (listado-b · t2a)
feat(cms): useSavedViews hook con CRUD contra RPCs (listado-b · t2b)
feat(cms): BulkActionsToolbar + BulkConfirmModal (listado-b · t2c)
feat(cms): SavedViewsMenu + SaveViewDialog (listado-b · t2d)
feat(cms): ExportCsvDialog con column picker (listado-b · t2e)
feat(cms): ampliar ResourcesListPage con fase B (listado-b · t2f)
feat(cms): duplicar real vía RPC (reemplaza placeholder fase A) (listado-b · t3)
docs: checklist E2E listado fase B (listado-b · t5)
```
