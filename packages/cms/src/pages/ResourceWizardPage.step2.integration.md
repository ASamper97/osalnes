# Integración · Paso 2 en `ResourceWizardPage.tsx`

Este documento describe los cambios que hay que aplicar al
`ResourceWizardPage.tsx` real del repo para activar el rediseño del
paso 2 en su versión v2 (con 3 decisiones de producto: preview IA,
badge GL como línea de estado, traducción automática en background al
pulsar "Siguiente").

> ℹ️ Este fichero es documentación, **no código compilable**. Los
> componentes auxiliares (`.tsx`) sí compilan y están en sus rutas
> correspondientes.

---

## 1) Imports nuevos

En la cabecera de `packages/cms/src/pages/ResourceWizardPage.tsx`:

```tsx
import ResourceWizardStep2Content from './ResourceWizardStep2Content';
import TranslationReadyToast from '../components/TranslationReadyToast';
import { useBackgroundTranslation } from '../lib/useBackgroundTranslation';
import type { GlStatus } from './step2-content.copy';
import './step2-content.css';
```

Si el proyecto concatena CSS en `styles.css`, en vez del último import
pega el contenido de `step2-content.css` al final de
`packages/cms/src/styles.css`.

## 2) Estado nuevo que el paso 2 consume

En el cuerpo del `ResourceWizardPage`:

```tsx
// Estado del editor GL (vacío / traducido / editado)
const [glStatus, setGlStatus] = useState<GlStatus>('empty');

// Hook que gestiona la traducción en background
const bgTranslation = useBackgroundTranslation({
  descriptionEs,
  descriptionGl,
  setDescriptionGl,
  setGlStatus,
});
```

Al **cargar un recurso existente** (edit mode), hidrata `glStatus`
según si la BD tiene `description_gl` o no:

```tsx
useEffect(() => {
  if (initialResource) {
    setGlStatus(initialResource.description_gl?.trim() ? 'edited' : 'empty');
  }
}, [initialResource]);
```

Asumimos `'edited'` (no `'translated'`) al cargar un recurso guardado
porque no sabemos si la traducción vino de la IA o si el usuario la
tocó después. Es la opción segura.

## 3) Render del paso 2

Donde antes había el bloque monolítico del paso 2 (dos editores
apilados + botones IA + "Opciones de visibilidad"), ahora:

```tsx
<ResourceWizardStep2Content
  descriptionEs={descriptionEs}
  onChangeDescriptionEs={setDescriptionEs}
  descriptionGl={descriptionGl}
  onChangeDescriptionGl={setDescriptionGl}
  glStatus={glStatus}
  onChangeGlStatus={setGlStatus}
  isBackgroundTranslating={bgTranslation.isInFlight}
  context={{
    name: nameEs,
    mainTypeKey,
    municipio: selectedMunicipioName, // NOMBRE, no ID
  }}
/>
```

`selectedMunicipioName` se calcula con un `useMemo` si tu estado
guarda solo el ID:

```tsx
const selectedMunicipioName = useMemo(() => {
  const m = allMunicipios.find((x) => x.id === municipioId);
  return m?.name ?? null;
}, [municipioId, allMunicipios]);
```

## 4) Hook en el botón "Siguiente" del paso 2

El motor del wizard ya tiene un botón "Siguiente" genérico. Hay que
interceptarlo **solo cuando el paso activo es el 2**, para disparar la
traducción en background antes de avanzar.

Opción A — si el `Wizard.tsx` expone `onBeforeNext(stepIndex, ...)`:

```tsx
function handleBeforeNext(stepIndex: number) {
  if (stepIndex === 2) {
    bgTranslation.dispatchIfNeeded();
  }
  return true; // dejar avanzar siempre
}
```

Opción B — si el botón "Siguiente" es local del wizard y no hay hook,
envuelve el handler existente:

```tsx
const originalHandleNext = handleNext;
const handleNextWithBgTranslation = useCallback(() => {
  if (currentStep === 2) {
    bgTranslation.dispatchIfNeeded();
  }
  originalHandleNext();
}, [currentStep, bgTranslation, originalHandleNext]);
```

## 5) Toast en los pasos 3+

Monta el `<TranslationReadyToast>` al nivel raíz del wizard (fuera del
render del paso actual, para que persista entre navegaciones):

```tsx
<TranslationReadyToast
  visible={bgTranslation.hasPendingReview && currentStep !== 2}
  onReview={() => {
    bgTranslation.dismissReview();
    goToStep(2); // la función del motor del wizard
  }}
  onDismiss={bgTranslation.dismissReview}
/>
```

Se oculta automáticamente cuando el usuario ya está en el paso 2
(sería ruido: la traducción está visible delante de sus ojos).

## 6) Mover "Opciones de visibilidad" fuera del paso 2

Las tres casillas que hoy están en el paso 2 se distribuyen:

### 6a. `acceso_gratuito` → paso 4 como tag

Etiqueta `caracteristicas.gratuito` del catálogo UNE. Se marca desde
el `TagSelector` del paso 4 como cualquier otra.

Al cargar un recurso existente con `acceso_gratuito=true` en columna
legacy, auto-marcar el tag. Si el usuario desmarca el tag, se persiste
en `resource_tags` sin `caracteristicas.gratuito`.

Dejar la columna legacy `acceso_gratuito` con comentario
`// TODO legacy — eliminar cuando todos los recursos tengan tag` para
no romper código existente.

### 6b. `acceso_publico` → paso 4 como tag

Mismo patrón. Verifica que `caracteristicas.publico` exista en
`tag-catalog.ts`. Si no existe, decide con el equipo de la
Mancomunidad si mantenerlo (a menudo es redundante con "gratuito").

### 6c. `visible_en_mapa` → paso 7 como flag de publicación

NO es un tag. Es una decisión editorial ("¿aparece en el mapa
público?"). Se renderiza junto al botón "Publicar" del paso 7:

```tsx
<label className="publish-option">
  <input
    type="checkbox"
    checked={visibleEnMapa}
    onChange={(e) => setVisibleEnMapa(e.target.checked)}
  />
  <span>
    <strong>Visible en el mapa público</strong>
    <small>
      Si lo dejas marcado, este recurso aparecerá como pin en el mapa
      de recursos turísticos de la web.
    </small>
  </span>
</label>
```

Persiste en `resources.visible_en_mapa` (columna existente, sin
cambios de schema).

## 7) `aiDraft` en el cliente

El componente importa `aiDraft` de `@/lib/ai`. Verifica que existe.
Si no, añádela siguiendo el patrón de `aiImprove` y `aiTranslate`:

```ts
export async function aiDraft(input: {
  name: string;
  typeKey: string | null;
  municipio: string | null;
  targetLang: 'es' | 'gl';
}): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-writer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ action: 'draft', ...input }),
  });
  if (!res.ok) throw new Error(`ai-writer draft failed: ${res.status}`);
  const data = await res.json();
  return data.text as string;
}
```

## 8) Edge Function

La acción `draft` del Edge Function `ai-writer` está descrita en:

    supabase/functions/ai-writer/index.draft-action.patch.ts

Pégalo sobre el `index.ts` real siguiendo las marcas `═══════════`.

---

## Checklist de aceptación

- [ ] Crear recurso nuevo tipo "Playa": al abrir el paso 2 con editor
      ES vacío, aparece el botón púrpura "Escribir un primer borrador
      con IA".
- [ ] Pulsar ese botón → aparece preview `AiPreview` con dos acciones
      "Usar este texto" / "Descartar". Si pulsas "Usar este texto", el
      editor ES se rellena.
- [ ] Escribir 3 palabras a mano en ES → el botón cambia a "Mejorar
      el texto actual con IA".
- [ ] Badge de palabras en ES:
      * 0 palabras → gris "Pendiente"
      * 30 palabras → ámbar "Breve"
      * 150 palabras → verde "Recomendada"
      * 400 palabras → ámbar "Extensa"
- [ ] **No hay badge en el editor GL**. Debajo del editor GL aparece
      una línea en color que dice "Aún sin traducción." si está vacío,
      o "Traducción de la descripción en castellano (N palabras).
      Revísala cuando quieras." si viene de la IA, o "Traducción
      editada por ti (N palabras)." si el usuario la ha tocado.
- [ ] Pulsar "Traducir al gallego" con ES vacío → botón desactivado,
      tooltip explica por qué.
- [ ] Pulsar "Traducir al gallego" con ES relleno → preview IA.
      Aceptar → aparece en el editor GL y la línea de estado cambia a
      "Traducción de la descripción en castellano".
- [ ] **Traducción automática en background**:
      1. Escribir ES, NO pulsar traducir, pulsar "Siguiente".
      2. Avanzar al paso 3. Esperar ~3-6 segundos.
      3. Aparece toast abajo a la derecha: "Traducción al gallego
         lista — Vuelve al paso 2 cuando quieras para revisarla."
      4. Pulsar "Revisar ahora" → vuelve al paso 2, el editor GL ya
         tiene el texto y la línea de estado dice "Traducción de la
         descripción en castellano".
- [ ] Mientras la traducción corre en background, en el bloque de
      traducción del paso 2 aparece el badge con spinner "Traduciendo
      al gallego…".
- [ ] Si vuelves al paso 2 mientras el background aún corre, el botón
      "Traducir al gallego" está desactivado (evitar carrera).
- [ ] Ocultar el bloque de ayuda azul → se queda oculto también tras
      recargar la página (localStorage).
- [ ] Abrir un recurso existente (edit mode): si tenía
      `description_gl` se muestra con línea de estado "Traducción
      editada por ti" (asumimos edited por seguridad).
- [ ] Las 3 opciones de visibilidad (acceso gratuito, acceso público,
      visible en mapa) NO aparecen en el paso 2. Están en los pasos
      4 (las dos primeras como tags) y 7 (la tercera como flag).
- [ ] Las traducciones EN/FR/PT NO aparecen en el paso 2. Van al
      paso 6.
- [ ] Acentos correctos en todo el paso 2 (Descripción, Castellano,
      Gallego, Inglés, Francés, Portugués, etc.).
- [ ] Un mismo recurso tiene **un único** tag `tipo-de-recurso.*`
      en `resource_tags` — no duplicados entre paso 1 y paso 4.
- [ ] Al guardar y recargar, `description_es` y `description_gl`
      persisten correctamente en la BD.
