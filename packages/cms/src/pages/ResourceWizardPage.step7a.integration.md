# Integración · Paso 7a en `ResourceWizardPage.tsx`

**Este paso no introduce migración de BD.** Todos los cambios son en
código CMS + `@osalnes/shared`. La migración para publicación programada
irá en el paso 7b.

---

## 1) Imports nuevos en `ResourceWizardPage.tsx`

```tsx
import ResourceWizardStep7Review from './ResourceWizardStep7Review';
import {
  type QualityStep,
  type ResourceSnapshot,
} from '@osalnes/shared/data/quality-engine';
import './step7-review.css';
```

## 2) Construir el `ResourceSnapshot` desde el estado del wizard

El motor `auditResource` necesita un snapshot completo. El wizard ya
tiene todos los valores dispersos en estados distintos; hay que unirlos
con `useMemo`:

```tsx
const resourceSnapshot: ResourceSnapshot = useMemo(() => ({
  // Paso 1
  mainTypeKey,
  nameEs: nameEs ?? '',
  nameGl: nameGl ?? '',
  slug: seo.slug ?? '',
  municipioId: selectedMunicipioId,
  municipioName: selectedMunicipioName,

  // Paso 2
  descriptionEs: descriptionEs ?? '',
  descriptionGl: descriptionGl ?? '',
  accessPublic: accessPublic ?? false,
  accessFree: accessFree ?? false,
  visibleOnMap: visibleOnMap ?? true,

  // Paso 3
  latitude,
  longitude,
  streetAddress: streetAddress ?? '',
  postalCode: postalCode ?? '',
  contactPhone: contactPhone ?? '',
  contactEmail: contactEmail ?? '',
  contactWeb: contactWeb ?? '',
  hoursPlan,

  // Paso 4
  accommodationRating: establishment.rating,
  occupancy: establishment.occupancy,
  servesCuisine: establishment.cuisineCodes,
  tagKeys: selectedTagKeys,

  // Paso 5
  imageCount: mediaImages.length,
  primaryImageId: mediaImages.find((i) => i.isPrimary)?.id ?? null,
  imagesWithoutAltCount: mediaImages.filter(
    (i) => !i.altText || i.altText.trim().length === 0
  ).length,
  videoCount: mediaVideos.length,
  documentCount: mediaDocuments.length,

  // Paso 6
  seo,
}), [
  mainTypeKey, nameEs, nameGl, seo, selectedMunicipioId, selectedMunicipioName,
  descriptionEs, descriptionGl, accessPublic, accessFree, visibleOnMap,
  latitude, longitude, streetAddress, postalCode,
  contactPhone, contactEmail, contactWeb, hoursPlan,
  establishment, selectedTagKeys,
  mediaImages, mediaVideos, mediaDocuments,
]);
```

## 3) Handlers de navegación + persistencia

```tsx
function handleGoToStep(step: QualityStep) {
  const stepNumberMap: Record<QualityStep, number> = {
    identification: 1,
    content: 2,
    location: 3,
    classification: 4,
    multimedia: 5,
    seo: 6,
  };
  setCurrentStep(stepNumberMap[step]);
}

async function handleSaveDraft(): Promise<void> {
  await supabase.from('resources').upsert({
    id: resourceId ?? undefined,
    ...buildPayload(),
    publication_status: 'draft',
  });
}

async function handlePublish(): Promise<void> {
  await supabase.from('resources').upsert({
    id: resourceId ?? undefined,
    ...buildPayload(),
    publication_status: 'published',
    published_at: new Date().toISOString(),
  });
  // Redirigir al listado o mostrar toast de éxito
  navigate(`/resources/${resourceId}`);
}
```

## 4) Render del paso 7

Reemplazar TODO el bloque actual del paso 7 (tarjeta PID + 6 tarjetas +
checkbox visible + botón Evaluar IA + botón Crear recurso) por:

```tsx
<ResourceWizardStep7Review
  snapshot={resourceSnapshot}
  onGoToStep={handleGoToStep}
  onChangeVisibleOnMap={setVisibleOnMap}
  onSaveDraft={handleSaveDraft}
  onPublish={handlePublish}
  onPrevious={() => setCurrentStep(6)}
/>
```

## 5) Borrar código legacy del paso 7

En `ResourceWizardPage.tsx`, eliminar:
- El JSX actual del paso 7 con las tarjetas inline.
- La función que evalúa completitud PID (la reemplaza el motor del paso 7a).
- El botón "Evaluar calidad con IA" (el motor local del paso 7a es
  suficiente para el 7a; el 7b añadirá una función IA separada).
- El checkbox "Visible en mapa" — ahora está dentro del componente
  nuevo; si en el wizard el estado sigue centralizado, mantén el
  estado `visibleOnMap` en el padre.
- El bloque "Estado: Disponible tras guardar" del paso 5 que aparecía
  como bug legacy en la revisión.

## 6) Checklist de aceptación

- [ ] Al entrar al paso 7, arriba se ve el **ScoreDashboard con nota 0-100** coloreada por tramo.
- [ ] Las 6 tarjetas (Identificación, Contenido, Ubicación, Clasificación, Multimedia, SEO) muestran estado **honesto**: verde si todo ok, amarillo si hay avisos, rojo si hay errores.
- [ ] Las tarjetas listan hasta 3 problemas concretos del paso con marca ✗/⚠.
- [ ] Pulsar "Editar" en cualquier tarjeta → salta al paso correspondiente.
- [ ] La **tarjeta PID está plegada por defecto**.
- [ ] Expandir la tarjeta PID → los obligatorios con valor aparecen en verde con "✓ OBLIGATORIO"; los que falten aparecen en rojo.
- [ ] En la tarjeta PID, cada grupo tiene **una frase de explicación** ("Solo aplica a restaurantes y bodegas", "Uso interno del CMS no se exporta al PID").
- [ ] El bug anterior "Multimedia: Disponible tras guardar" **ya no aparece**.
- [ ] El texto muestra **tildes correctas** (Revisión, Descripción, Identificación, Clasificación, Ubicación, Teléfono, Dirección, Inglés, Francés, Portugués).
- [ ] Checkbox "Visible en el mapa público" sigue funcionando y guarda al cambiarlo.
- [ ] Botón **"Publicar recurso"** abre el **modal de confirmación** con los problemas detectados listados.
- [ ] Si hay errores críticos (fail), el botón primario del modal es rojo y pone "Publicar pese a los errores".
- [ ] Si hay solo warnings, el botón primario es naranja "Publicar de todos modos".
- [ ] Si está todo limpio, el botón primario es verde "Publicar ahora".
- [ ] Botón "Volver a corregir" cierra el modal sin publicar.
- [ ] Escape o clic en el backdrop cierran el modal.
- [ ] Botón "Guardar como borrador" persiste sin abrir modal (los borradores no necesitan confirmación).
- [ ] Al arreglar un problema en un paso anterior y volver al 7, **la auditoría recalcula en vivo** (el score sube).
- [ ] **Móvil (<760px)**: el dashboard se apila; las tarjetas se apilan en 1 columna; el modal ocupa toda la pantalla.
