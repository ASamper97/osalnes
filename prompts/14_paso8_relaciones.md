# Prompt maestro · Paso 8 · Relaciones entre recursos

**Pega este contenido en Claude Code.**

Añade el paso 8 del wizard: relaciones semánticas entre recursos
turísticos. Cumple el requisito obligatorio del pliego 5.1.1 último
bullet ("Relación entre recursos, permitiendo la creación de
estructuras jerárquicas o vinculadas") y prepara la exportación al
PID alineada con UNE 178503.

## Decisiones aplicadas (ya tomadas)

- **1-A**: UI como **nuevo paso 8** del wizard (entre el actual paso 6
  SEO y paso 7 Revisión — Revisión se desplaza al 8).
- **2-B**: **6 predicados completos**: is_part_of, contains (inverso
  auto), related_to, includes, near_by, same_category, follows.
- **3-A**: **Bidireccionalidad automática inteligente** vía trigger de
  BD (crea el mirror al insertar una relación).
- **4-C**: **Autocomplete rápido + modal avanzado** con filtros.
- **5-C**: **Guardar en BD + función SQL JSON-LD** para SCR-13.
- **6-C**: **Warning no bloqueante** en combinaciones semánticas raras.
- **7-C**: **Validación de ciclos SOLO en jerárquicas** (is_part_of /
  contains / includes).
- **8-C**: **Lista simple agrupada** por predicado, sin grafo visual.

## Ficheros en el repo

```
osalnes-dti/
├── database/migrations/
│   ├── 029_resource_relations.sql              (NUEVO)
│   └── 029_resource_relations.down.sql         (NUEVO)
│
├── packages/shared/src/data/
│   └── resource-relations.ts                   (NUEVO · predicados + warnings semánticos)
│
├── packages/cms/src/
│   ├── hooks/
│   │   └── useRelations.ts                     (NUEVO)
│   ├── components/
│   │   ├── PredicatePicker.tsx                 (NUEVO · selector tipo relación)
│   │   ├── TargetAutocomplete.tsx              (NUEVO · buscador destino)
│   │   ├── AdvancedRelationSearchModal.tsx     (NUEVO · modal filtros)
│   │   └── RelationsList.tsx                   (NUEVO · lista agrupada)
│   └── pages/
│       ├── ResourceWizardStep8Relations.tsx    (NUEVO · orquestador paso 8)
│       ├── step8-relations.copy.ts             (NUEVO · textos castellano)
│       ├── step8-relations.css                 (NUEVO)
│       └── ResourceWizardStep8Relations.integration.md  (docs)
│
└── prompts/
    └── 14_paso8_relaciones.md                  (este fichero)
```

## Tareas en orden

### Tarea 1 · Aplicar migración 029

```bash
npx supabase db push
```

Validar con SQL:
```sql
-- Enum creado con 7 valores
select unnest(enum_range(null::public.relation_predicate));

-- Tabla creada con RLS
select count(*) from public.resource_relations;

-- Crear relación de prueba
select public.create_relation(
  (select id from public.resources limit 1),
  (select id from public.resources offset 1 limit 1),
  'related_to',
  'Prueba de relación'
);

-- Listar relaciones (debería devolver 1 fila + 1 mirror si hay 2 recursos)
select * from public.list_relations_for_resource(
  (select id from public.resources limit 1)
);

-- JSON-LD preview
select public.generate_jsonld_relations(
  (select id from public.resources limit 1)
);
```

### Tarea 2 · Ampliar `wizard-navigation.ts` de 7 a 8 pasos

Sigue `ResourceWizardStep8Relations.integration.md` sección 2. Tres
subcambios:

**2.1** · Añadir constante `{ number: 8, key: 'relations', label:
'Relaciones', ... }` al array `WIZARD_STEPS`, desplazando Revisión del
7 al 8 si estaba al final.

**2.2** · Actualizar `WizardStepNumber`:
```ts
export type WizardStepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
```

**2.3** · Verificar que `TOTAL_STEPS = WIZARD_STEPS.length` devuelve 8
y que el porcentaje se recalcula (paso 7 → 88%, paso 8 → 100%).

### Tarea 3 · Conectar paso 8 en `ResourceWizardPage.tsx`

Sigue integration.md sección 3. Tres partes:

**3.1** · Imports:
```tsx
import ResourceWizardStep8Relations from './ResourceWizardStep8Relations';
import { useRelations } from '../hooks/useRelations';
import './step8-relations.css';
```

**3.2** · Hook al nivel del componente:
```tsx
const relationsState = useRelations({ supabase, resourceId });
```

**3.3** · Render condicional:
```tsx
{currentStep === 7 && (  // o 8 según donde pongas Relaciones
  <ResourceWizardStep8Relations
    state={relationsState}
    resourceId={resourceId}
    sourceType={mainTypeKey}
    typologies={typologies.map(t => ({ key: t.key, label: t.label }))}
    municipalities={municipalities.map(m => ({ id: m.id, name: m.name }))}
    onOpenResource={(id) => navigate(`/resources/${id}/edit`)}
    onFetchJsonldPreview={async () => {
      if (!resourceId) return null;
      const { data, error } = await supabase.rpc(
        'generate_jsonld_relations',
        { p_resource_id: resourceId },
      );
      if (error) throw error;
      return data;
    }}
  />
)}
```

### Tarea 4 · (Opcional) Resumen de relaciones en el paso Revisión

En el paso de revisión (StepCard), añadir una tarjeta que muestre
resumen de relaciones existentes y permita "Editar" para volver al
paso 7. Sigue integration.md sección 4.

### Tarea 5 · Test E2E

El integration.md sección 6 tiene un checklist completo de ~30
puntos. Los más críticos:

- **Sin resourceId** → banner amarillo, formulario deshabilitado.
- **Bidireccionalidad**: crear A `is_part_of` B → B automáticamente
  muestra "Contiene: A" marcado `(automática)`.
- **Ciclos**: crear A is_part_of B, intentar B is_part_of A → error.
  Probar también ciclo indirecto (A → B → C → A).
- **Warning semántico**: crear "Hotel is_part_of Restaurante" →
  warning "Es poco común...", botón "Continuar de todas formas"
  permite guardar.
- **JSON-LD**: con relaciones creadas, abrir preview → bloque con
  `isPartOf`, `isRelatedTo`, URIs `osalnes.gal/recurso/...`.
- **Autocomplete**: debounce 250ms, nunca se auto-sugiere el recurso
  actual.

### Tarea 6 · Documentación de cierre

Actualizar el README del repo con una línea mencionando el
cumplimiento del pliego 5.1.1 y que las relaciones se exportan en
JSON-LD alineado con UNE 178503 (SEGITTUR).

---

## Lo que NO tocar

- Los pasos 0-6 del wizard. Solo se añade el 7 Relaciones y se
  desplaza Revisión al 8.
- El listado, el dashboard ni ningún otro módulo.
- Las 28 migraciones anteriores.

## Mensajes de commit sugeridos

```
feat(db): migración 029 · resource_relations + bidireccionalidad + ciclos + JSON-LD (paso8 · t1)
feat(shared): modelo de relaciones UNE 178503 con 6 predicados (paso8 · t2a)
feat(cms): useRelations hook (paso8 · t2b)
feat(cms): PredicatePicker + TargetAutocomplete + AdvancedSearchModal (paso8 · t2c)
feat(cms): RelationsList agrupada por predicado (paso8 · t2d)
feat(cms): ResourceWizardStep8Relations orquestador (paso8 · t2e)
feat(wizard): ampliar wizard-navigation de 7 a 8 pasos (paso8 · t3)
feat(cms): conectar paso 8 Relaciones en ResourceWizardPage (paso8 · t4)
docs: checklist E2E paso 8 relaciones (paso8 · t5)
```
