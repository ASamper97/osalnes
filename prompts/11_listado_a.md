# Prompt maestro · Listado de recursos fase A (SCR-03)

**Pega este contenido en Claude Code.**

Primera fase de la nueva pantalla SCR-03 · Listado de recursos turísticos.

## Alcance (fase A)

- Dashboard KPI con 6 cards clicables.
- Filtros facetados: tipología multi-select agrupada, municipio
  multi-select, idiomas sin traducir, visible en mapa, coordenadas,
  incompletos, solo mis recursos.
- Tabla con 9 columnas según pliego.
- Paginación + orden por columna.
- Edición inline del nombre + cambio de estado inline.
- Menú "..." con 7 acciones (preview, duplicar stub, cambiar estado,
  historial, eliminar).
- Modal de eliminación con "archivar en vez de eliminar".
- URL sync (F5 preserva filtros).

## Decisiones aplicadas

- **1-C**: alcance amplio con todas las features.
- **2-B**: columna "Calidad" con nota 0-100.
- **3-A**, **4-A**, **5-A**, **6-A**, **7-A**, **8-A**: todas las demás en máximo.

La **fase B** (sesión siguiente) añade: acciones masivas con toolbar
flotante, implementación real de duplicar, vistas guardadas (tabla en
BD + UI), exportación CSV/Excel.

## Ficheros en el repo

```
osalnes-dti/
├── database/migrations/
│   ├── 026_list_resources_rpc.sql
│   └── 026_list_resources_rpc.down.sql
│
├── packages/shared/src/data/
│   └── resources-list.ts
│
├── packages/cms/src/
│   ├── hooks/
│   │   └── useResourcesList.ts
│   ├── components/listado/
│   │   ├── ListKpiDashboard.tsx
│   │   ├── ListFiltersPanel.tsx
│   │   ├── ResourcesTable.tsx
│   │   ├── QualityBadge.tsx
│   │   ├── LanguageChips.tsx
│   │   ├── MapChip.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── InlineNameEditor.tsx
│   │   ├── RowActionsMenu.tsx
│   │   ├── ListPaginationBar.tsx
│   │   └── DeleteConfirmModal.tsx
│   └── pages/
│       ├── ResourcesListPage.tsx
│       ├── listado.copy.ts
│       ├── listado.css
│       └── ResourcesListPage.integration.md
│
└── prompts/
    └── 11_listado_a.md  ← este fichero
```

---

## Tareas

### Tarea 1 · Migración 026

```bash
npx supabase db push
```

Verificar que existen: `list_resources`, `list_resources_kpis`,
`change_resource_status`, `compute_resource_quality_score`,
`count_pid_missing_required`, vista `resources_list_view`.

**Test rápido**:
```sql
select count(*) from public.list_resources(p_page := 1, p_page_size := 100);
```

### Tarea 2 · Conectar ruta

Seguir integration.md sección 3. La ruta nueva:

```tsx
<Route path="/resources" element={<ResourcesRoute />} />
```

Reemplaza el componente antiguo del listado. Mantener la misma URL `/resources`.

**Importante**: el handler `onDuplicate` queda como placeholder
(`alert(...)` o similar) porque la implementación completa va en la
fase B. No romper el flujo, solo dejar feedback al usuario.

### Tarea 3 · Borrar legacy

Eliminar el componente antiguo del listado en su totalidad: tabs,
tabla básica, bloque "Estado del sistema" simple, filtros básicos, etc.
El nuevo orquestador es autónomo.

### Tarea 4 · Verificar `useTypologies` y `useMunicipalities`

Los hooks `useTypologies` y `useMunicipalities` deben existir desde
pasos anteriores. Si no devuelven las opciones en el formato esperado
por `ListFiltersPanel`, adaptar en la ruta (sección 3 de integration.md).

Si las opciones de tipología no tienen `rootCategory` (grupo raíz para
agrupar en el dropdown), temporalmente pasar `'general'` a todos y
crear un fix en iteración posterior.

### Tarea 5 · Test E2E

Los 30+ puntos del checklist en integration.md sección 5. Los más
críticos:

- URL sync: aplicar filtros → F5 → filtros intactos.
- Edición inline: doble clic en nombre → escribe → Enter → se guarda.
- Cambio de estado inline: clic badge → elegir estado → tabla refresca.
- KPIs clicables: clic "Incompletos" → filtro se aplica.
- Responsive: abrir en móvil → todo se adapta.

---

## Lo que NO tocar

- El wizard de recursos (ResourceWizardPage). Esta pantalla solo
  NAVEGA al wizard vía `onOpenEdit`.
- Otras rutas del CMS.
- El motor de calidad del paso 7a. Aquí se usa una versión
  simplificada en SQL para listados; el motor completo sigue corriendo
  en cliente al abrir ficha.

## Mensajes de commit

```
feat(db): migración 026 · RPC list_resources + quality score en SQL (listado-a · t1)
feat(shared): modelo de datos del listado (listado-a · t2a)
feat(cms): hook useResourcesList con URL sync y debounce (listado-a · t2b)
feat(cms): componentes del listado (KpiDashboard, FiltersPanel, ResourcesTable, badges) (listado-a · t2c)
feat(cms): ResourcesListPage orquestador con 9 columnas según pliego (listado-a · t2d)
chore(cms): eliminar listado legacy (listado-a · t3)
docs: checklist E2E listado fase A (listado-a · t5)
```
