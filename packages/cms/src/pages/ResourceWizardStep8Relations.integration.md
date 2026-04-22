# Integración · Paso 8 del wizard · Relaciones entre recursos

Añade un **paso 8 nuevo** al wizard (entre el 6 SEO y el 7 Revisión)
que gestiona relaciones semánticas entre recursos.

Cumple el requisito del pliego 5.1.1 último bullet:
> "Relación entre recursos, permitiendo la creación de estructuras
> jerárquicas o vinculadas."

## 1) Aplicar migración 029

```bash
npx supabase db push
```

Verificar:
```sql
-- Tabla y enum existentes:
select count(*) from public.resource_relations;

-- Crear una relación de prueba:
select public.create_relation(
  (select id from public.resources limit 1),
  (select id from public.resources offset 1 limit 1),
  'related_to',
  'Prueba'
);

-- Listar relaciones:
select * from public.list_relations_for_resource(
  (select id from public.resources limit 1)
);

-- Vista previa JSON-LD:
select public.generate_jsonld_relations(
  (select id from public.resources limit 1)
);
```

## 2) Ampliar `wizard-navigation.ts` (del wizard-global)

El wizard original tenía 7 pasos. Ahora son 8. Hay que:

### 2.1 · Añadir la constante del paso

En `packages/shared/src/data/wizard-navigation.ts`, añadir al array
`WIZARD_STEPS`:

```tsx
{
  number: 8,
  key: 'relations',
  label: 'Relaciones',
  shortLabel: 'Relac.',
  isOptional: true,
  isRequiredForDraft: false,
},
```

Y **reordenar** para que el paso 7 Revisión pase al 8 y el nuevo
Relaciones sea el 7:

```
1. Identificación
2. Contenido
3. Ubicación
4. Clasificación
5. Multimedia
6. SEO
7. Relaciones   ← NUEVO
8. Revisión
```

Si prefieres mantener Revisión al final y poner Relaciones en el 7,
ajusta el `TOTAL_STEPS` = 8 y el cálculo del porcentaje sigue funcionando.

### 2.2 · Actualizar el tipo `WizardStepNumber`

```tsx
export type WizardStepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
```

### 2.3 · Actualizar `TOTAL_STEPS`

`TOTAL_STEPS` se deriva de `WIZARD_STEPS.length` — no hay que tocar nada,
pero verifica que el porcentaje se recalcula (paso 7 → 88%, paso 8 → 100%).

## 3) Conectar el nuevo paso en `ResourceWizardPage.tsx`

### 3.1 · Imports nuevos

```tsx
import ResourceWizardStep8Relations from './ResourceWizardStep8Relations';
import { useRelations } from '../hooks/useRelations';
import './step8-relations.css';
```

### 3.2 · Llamar al hook

```tsx
const relationsState = useRelations({
  supabase,
  resourceId,
});
```

### 3.3 · Renderizar cuando currentStep === 7 (el nuevo paso Relaciones)

```tsx
{currentStep === 7 && (
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

### 3.4 · Añadir a la navegación del stepper

Si usas `WizardStepper` del wizard-global, asegúrate de que el array
`stepsState` incluye el paso 7 Relaciones. La lógica `buildStepsState`
lo hará automáticamente al leer de `WIZARD_STEPS`.

## 4) Opcional · Mostrar relaciones en el paso 7 Revisión

En el componente de revisión, añadir una sección tipo StepCard que
muestre un resumen de relaciones existentes:

```tsx
<StepCard
  title="Relaciones"
  stepNumber={7}
  status={relations.length > 0 ? 'ok' : 'empty'}
  valueLabel={
    relations.length > 0
      ? `${relations.length} relación(es) con otros recursos`
      : 'Sin relaciones definidas (opcional)'
  }
  onEdit={() => setCurrentStep(7)}
/>
```

## 5) Integración con exportación al PID (SCR-13)

Cuando hagamos el Centro de exportaciones, la función SQL
`generate_jsonld_relations(resource_id)` devuelve un fragmento JSON-LD
listo para incluir en el payload completo del recurso. Ejemplo:

```json
{
  "@context": "https://schema.org",
  "@type": "TouristAttraction",
  "@id": "https://osalnes.gal/recurso/playa-de-o-vao",
  "name": "Playa de O Vao",
  "geo": {...},
  "isPartOf": [
    {"@type": "Thing", "@id": "https://osalnes.gal/recurso/conjunto-historico", "name": "Conjunto histórico"}
  ],
  "isRelatedTo": [
    {"@type": "Thing", "@id": "https://osalnes.gal/recurso/paseo-maritimo", "name": "Paseo marítimo"}
  ]
}
```

## 6) Checklist E2E

### Crear relación
- [ ] Sin `resourceId` (recurso nuevo no guardado) → banner amarillo "Guarda el recurso antes de crear relaciones".
- [ ] Tras guardar borrador → predicado + autocomplete + nota habilitados.
- [ ] Elegir predicado "Forma parte de" → el dropdown muestra icono 📂 + descripción.
- [ ] Autocomplete: escribir "playa" → aparecen 3-5 sugerencias con nombre + tipología + municipio.
- [ ] Pulsar sugerencia → aparece en caja verde con × para quitar.
- [ ] "Buscar más…" → abre modal avanzado con filtros tipología/municipio/estado.
- [ ] Seleccionar desde modal → cierra modal y rellena el campo.
- [ ] Añadir nota "edificio dentro del conjunto" → se guarda al crear.
- [ ] Pulsar "Añadir relación" → aparece en la lista agrupada por predicado.

### Bidireccionalidad automática (3-A)
- [ ] Crear "A is_part_of B" → entrar al recurso B y ver automáticamente un bloque "Contiene: A" marcado como `(automática)`.
- [ ] Los elementos `(automática)` no se pueden eliminar directamente — el × no aparece.
- [ ] Borrar la relación desde el origen → desaparece también del destino.

### Warnings semánticos (6-C)
- [ ] Crear "Hotel is_part_of Restaurante" → warning amarillo antes de guardar: "Es poco común que un alojamiento forme parte de un restaurante…".
- [ ] Botón "Cambiar" → cierra warning y permite elegir otro predicado.
- [ ] Botón "Continuar de todas formas" → guarda la relación igual.

### Validación de ciclos (7-C)
- [ ] Crear A is_part_of B, después intentar B is_part_of A → error "No se puede crear una relación jerárquica circular".
- [ ] Crear A is_part_of B, B is_part_of C, después intentar C is_part_of A → también error (ciclo indirecto).
- [ ] Crear A related_to B, después B related_to A → OK (no es jerárquico).

### JSON-LD preview (5-C)
- [ ] Con al menos 1 relación → botón "Ver JSON-LD" disponible.
- [ ] Al abrirlo → se muestra bloque con `isPartOf`, `isRelatedTo`, etc. con URIs `https://osalnes.gal/recurso/...`.
- [ ] El JSON es válido (parseable).

### Autocompletar + modal
- [ ] El autocomplete debounce 250ms (no satura BD al escribir).
- [ ] El recurso actual NUNCA aparece en resultados (auto-exclusión).
- [ ] El modal avanzado respeta los 3 filtros.

### Stepper global (wizard-global)
- [ ] El stepper superior muestra 8 pasos, con Relaciones como paso 7.
- [ ] En el paso 8 Revisión el porcentaje es 100%.
- [ ] En el paso 7 Relaciones el porcentaje es 88%.
