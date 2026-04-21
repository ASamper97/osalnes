# Integración · Paso 4 en `ResourceWizardPage.tsx`

Cambios concretos para cablear el rediseño del paso 4. Este documento es
documentación, **no código compilable**.

---

## 1) Aplicar migración 022

```bash
npx supabase db push
```

Verificar:
```sql
\d public.resources
-- Deben aparecer: accommodation_rating, occupancy, serves_cuisine

-- Verificar rename de tags (si había datos)
select distinct substring(tag_key from 1 for position('.' in tag_key) - 1) as grupo
from public.resource_tags
order by grupo;
-- No debe aparecer "destacados"; sí "curaduria-editorial"
```

## 2) Aplicar patches en ficheros existentes

### 2a. Catálogo de tags
Abrir `packages/shared/src/data/tag-catalog.ts` y aplicar lo descrito
en `tag-catalog.patch.ts`:

- Añadir 5 tags nuevos al grupo `caracteristicas` (accesibilidad).
- Renombrar grupo `destacados` → `curaduria-editorial`.
- Actualizar el `groupKey` de los tags que usan el grupo renombrado.

### 2b. Cliente AI
Abrir `packages/cms/src/lib/ai.ts` y aplicar lo de `ai.suggestTags.patch.ts`:

- Añadir los tipos `AiTagSuggestion` y `AiSuggestTagsInput`.
- Añadir la función `aiSuggestTags`.

### 2c. Edge Function
Abrir `supabase/functions/ai-writer/index.ts` y aplicar
`index.suggestTags-action.patch.ts`:

- Añadir `'suggestTags'` al tipo `Action`.
- Añadir `buildSuggestTagsPrompt` y el case en el switch.
- Desplegar: `npx supabase functions deploy ai-writer`.

## 3) Imports nuevos en `ResourceWizardPage.tsx`

```tsx
import ResourceWizardStep4Classification from './ResourceWizardStep4Classification';
import type { EstablishmentData } from '../components/EstablishmentDetails';
import './step4-classification.css';
```

## 4) Estado nuevo

```tsx
const [establishment, setEstablishment] = useState<EstablishmentData>({
  rating: null,
  occupancy: null,
  cuisineCodes: [],
});

// selectedTagKeys ya existe desde paso 0 — no cambia
```

Hidratación desde BD al cargar:
```tsx
useEffect(() => {
  if (!initialResource) return;
  setEstablishment({
    rating:       initialResource.accommodation_rating ?? null,
    occupancy:    initialResource.occupancy ?? null,
    cuisineCodes: (initialResource.serves_cuisine as string[]) ?? [],
  });
}, [initialResource]);
```

## 5) Render del paso 4

Donde antes estaba el bloque monolítico del paso 4 en
`ResourceWizardPage.tsx`:

```tsx
<ResourceWizardStep4Classification
  mainTypeKey={mainTypeKey}
  establishment={establishment}
  onChangeEstablishment={setEstablishment}
  selectedTagKeys={selectedTagKeys}
  onChangeSelectedTagKeys={setSelectedTagKeys}
  descriptionEs={descriptionEs}
  municipio={selectedMunicipioName}
/>
```

## 6) Guardado en BD

Al hacer upsert, añadir al payload:

```tsx
const payload = {
  ...existingFields,
  accommodation_rating: establishment.rating,
  occupancy:            establishment.occupancy,
  serves_cuisine:       establishment.cuisineCodes,
};
```

Los tags se siguen guardando en la tabla `resource_tags` como hasta ahora;
el componente no cambia esa lógica.

## 7) Borrar el código legacy del paso 4

En `ResourceWizardPage.tsx`, localizar y borrar:

- Bloque "Clasificación del establecimiento" con los inputs legacy de
  estrellas (dropdown), aforo y tipo de cocina (textarea).
- El estado legacy correspondiente: `[categoriaStars, setCategoriaStars]`,
  `[aforo, setAforo]`, `[tipoCocinaTexto, setTipoCocinaTexto]` o similar.
- El render inline del paso 4 que hoy está dentro del switch.

NO borrar las columnas legacy de BD si existen (ej. `tipo_cocina_texto`).
La limpieza física va en una migración posterior tras verificar backfill.

## 8) TagSelector — adaptaciones mínimas

El componente `TagSelector` existente (del paso 0) tiene que soportar:

1. Un nuevo className `tag-group-editorial` en el grupo
   `curaduria-editorial` para aplicar el separador visual (el CSS ya está
   en `step4-classification.css`).

2. Propagar `selectedKeys` externos — si ya lo hace, no cambia nada.

Si el TagSelector no soporta aún el className `tag-group-editorial`,
añadir en su render:

```tsx
<div className={`tag-group ${group.key === 'curaduria-editorial' ? 'tag-group-editorial' : ''}`}>
  ...
</div>
```

## 9) Exportación a PID — mapeo

| Campo interno | Campo schema.org / PID |
|---|---|
| `accommodation_rating` | `accommodationRating` (solo tipo Hotel) o `starRating` |
| `occupancy` | `occupancy` |
| `serves_cuisine` (array) | `servesCuisine` |
| `selectedTagKeys` con prefijo `caracteristicas.` | `amenityFeature[]` |
| `selectedTagKeys` con prefijo `gastronomia.` | `amenityFeature[]` con categoría gastro |
| `selectedTagKeys` con prefijo `familiar.idiomas.*` | `availableLanguage[]` |
| `selectedTagKeys` con prefijo `caracteristicas.accesible-*` | `amenityFeature[]` con `@type: "LocationFeatureSpecification"` |
| `selectedTagKeys` con prefijo `curaduria-editorial.` | **NO exportar** (solo uso interno CMS) |

## 10) Checklist de aceptación

- [ ] Migración 022 aplicada. `\d public.resources` muestra
      `accommodation_rating`, `occupancy`, `serves_cuisine`.
- [ ] `select distinct substring(tag_key from 1 for position('.' in tag_key) - 1)`
      en `resource_tags` no muestra "destacados" (renombrado a
      "curaduria-editorial").
- [ ] Crear recurso tipo "Playa" → al llegar al paso 4, NO aparece el bloque
      "Datos del establecimiento". Solo aparece "Características y servicios".
- [ ] Crear recurso tipo "Restaurante" → aparecen los 3 campos:
      tenedores (dropdown 1-5), aforo (número), Tipos de cocina (multi-select
      con "Más comunes en O Salnés" arriba).
- [ ] Crear recurso tipo "Hotel" → aparecen estrellas (1-5) + aforo.
      NO aparece Tipos de cocina.
- [ ] Crear recurso tipo "Museo" → aparece solo aforo.
- [ ] Multi-select de cocina: buscar "galleg" no da resultados (no hay
      "Galician" en el catálogo UNE); buscar "gall" tampoco; escribir
      "españo" muestra "Española". Ajustar copy del hint si confunde.
- [ ] Multi-select de cocina: marcar "Española" y "Pescados y mariscos" →
      al guardar, `serves_cuisine` en BD es `['SPANISH', 'FISH AND SEAFOOD']`.
- [ ] TagSelector muestra las 5 nuevas etiquetas de accesibilidad en el
      grupo "Características": "Accesible silla de ruedas", "Aseo adaptado",
      "Plaza aparcamiento reservada", "Perros guía permitidos", "Bucle
      magnético". Con badges `accessibility` + `PID`.
- [ ] Grupo "Curaduría editorial" (antes "Destacados") aparece al final
      del TagSelector con un separador visual "Uso interno del equipo del
      CMS".
- [ ] Los badges `PID` y `SOLO CMS` siguen visibles (decisión del usuario
      1-C: mantenerlos).
- [ ] Sugeridor IA:
  * Con descripción vacía → botón desactivado, hint explicativo.
  * Con descripción > 20 caracteres → botón activo.
  * Pulsar → spinner, ~3-5 segundos, panel con sugerencias.
  * Cada sugerencia muestra una **explicación** de por qué la IA la
    propone (decisión 4-A del usuario).
  * "Marcar" una sugerencia → se añade a `selectedTagKeys`; la sugerencia
    desaparece del panel.
  * "Marcar todas" → añade todas las que no estén descartadas.
  * "Descartar" / "Descartar todas" → las quita del panel pero NO modifica
    `selectedTagKeys`.
- [ ] Accesibilidad con teclado: navegar por Tab entre todos los campos;
      los checkboxes del multi-select de cocina marcan con Espacio.
- [ ] Móvil (<760px): el grid de establecimiento pasa a una columna; el
      panel de sugerencias se apila verticalmente.
- [ ] Copy: todos los textos con acentos correctos (Clasificación,
      Aforo, Categoría oficial, Accesibilidad, etc.).
