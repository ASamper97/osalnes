# Prompt maestro · Rediseño Paso 2 "Contenido" (v2)

**Pega este contenido en Claude Code.**

Ejecuta el rediseño del paso 2 del wizard de recursos. Este prompt se
ejecuta **después** del paso 0 de limpieza conceptual y **antes** de
los pasos 3–7.

---

## Contexto del cambio

El paso 2 ("Contenido") del ResourceWizardPage tenía 8 problemas de
UX (auditoría 2026-04). Este prompt los arregla con:

- Un componente `ResourceWizardStep2Content` completo.
- Cuatro auxiliares reutilizables: `HelpBlock`, `WordCountBadge`,
  `AiPreview`, `TranslationReadyToast`.
- Un hook `useBackgroundTranslation` para la traducción automática.
- Copy centralizado en `step2-content.copy.ts` con acentos correctos.
- Una nueva acción `draft` en el Edge Function `ai-writer`.

**Tres decisiones de producto aplicadas (v2):**

1. **Preview IA siempre.** Cualquier propuesta IA (redactar, mejorar,
   traducir) se muestra en un `AiPreview` con dos botones "Usar este
   texto" / "Descartar" antes de tocar el editor. El usuario siempre
   decide.
2. **Badge de palabras solo en ES.** El editor GL muestra una línea
   descriptiva debajo ("Traducción de la descripción en castellano
   (N palabras)" / "Traducción editada por ti (N palabras)" / "Aún
   sin traducción.") sin semáforo.
3. **Traducción automática al avanzar.** Al pulsar "Siguiente" en el
   paso 2, si hay ES y GL está vacío, se lanza la traducción en
   background. El usuario avanza al paso 3 sin bloqueo. Cuando
   termina, aparece un toast pequeño abajo a la derecha: "Traducción
   al gallego lista — Vuelve al paso 2 cuando quieras para
   revisarla."

## Ficheros ya escritos y colocados en el repo

```
osalnes-dti/
├── packages/cms/src/
│   ├── components/
│   │   ├── HelpBlock.tsx
│   │   ├── WordCountBadge.tsx
│   │   ├── AiPreview.tsx
│   │   └── TranslationReadyToast.tsx
│   ├── lib/
│   │   └── useBackgroundTranslation.ts
│   └── pages/
│       ├── ResourceWizardStep2Content.tsx
│       ├── step2-content.copy.ts
│       ├── step2-content.css
│       └── ResourceWizardPage.step2.integration.md   (documentación)
│
└── supabase/functions/ai-writer/
    └── index.draft-action.patch.ts
```

---

## Tareas en orden

### Tarea 1 · Verificar componentes reutilizables

Los cuatro componentes (`HelpBlock`, `WordCountBadge`, `AiPreview`,
`TranslationReadyToast`) y el hook (`useBackgroundTranslation`) ya
están copiados a sus rutas. Verifica:

1. `pnpm --filter @osalnes/cms typecheck` no da errores en esos
   ficheros.
2. No colisionan con componentes existentes del mismo nombre. Si ya
   existía un `WordCountBadge` en el repo, compara ambos y decide si
   reemplazar o fusionar (el nuevo tiene más estados).

### Tarea 2 · Añadir acción `draft` al Edge Function

Abre `supabase/functions/ai-writer/index.ts` y aplica el patch descrito
en `supabase/functions/ai-writer/index.draft-action.patch.ts`:

1. Añadir `'draft'` al tipo `Action`.
2. Añadir `buildDraftPrompt` y el helper `humanizeTypeKey` tal cual.
3. Añadir el case `'draft'` en el switch del handler.
4. Temperatura: `0.7`.
5. Mantener fallback mock si no hay API key (patrón existente).

Redeploy: `npx supabase functions deploy ai-writer`

Test manual:
```bash
curl -X POST "$SUPABASE_URL/functions/v1/ai-writer" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"draft","name":"Mirador de A Lanzada","typeKey":"tipo-de-recurso.mirador","municipio":"Sanxenxo","targetLang":"es"}'
```
Debe devolver `{ "text": "..." }` con un borrador de ~150 palabras en
castellano, sin inventar horarios/precios.

### Tarea 3 · Añadir `aiDraft` al cliente TS

En `packages/cms/src/lib/ai.ts`, añadir `aiDraft` siguiendo el patrón
de `aiImprove`. Firma:

```ts
export async function aiDraft(input: {
  name: string;
  typeKey: string | null;
  municipio: string | null;
  targetLang: 'es' | 'gl';
}): Promise<string>;
```

Criterio: `import { aiDraft } from '../lib/ai'` compila.

### Tarea 4 · Integrar paso 2 en `ResourceWizardPage.tsx`

Sigue la guía paso a paso en:
`packages/cms/src/pages/ResourceWizardPage.step2.integration.md`

En resumen:

1. **Imports**: añadir `ResourceWizardStep2Content`,
   `TranslationReadyToast`, `useBackgroundTranslation`, el tipo
   `GlStatus`, y el CSS.
2. **Estado nuevo**: `glStatus` (con hidratación desde BD) y el hook
   `bgTranslation`.
3. **Render del paso 2**: `<ResourceWizardStep2Content>` con todas sus
   props (incluyendo `glStatus`, `onChangeGlStatus`, flag
   `isBackgroundTranslating`).
4. **Disparador de la traducción en background**: interceptar el
   "Siguiente" del paso 2 para llamar `bgTranslation.dispatchIfNeeded()`
   antes de avanzar.
5. **Toast al nivel raíz del wizard**: `<TranslationReadyToast>` visible
   solo cuando NO estás en el paso 2.

### Tarea 5 · Mover "Opciones de visibilidad"

Ver sección 6 del `integration.md`:

- `acceso_gratuito` → tag `caracteristicas.gratuito` (paso 4)
- `acceso_publico` → tag `caracteristicas.publico` (paso 4) — verificar
  que la clave exista en el catálogo; si no, decidir con Mancomunidad
  si mantenerlo
- `visible_en_mapa` → flag de publicación (paso 7)

Hidratación de recursos existentes: si la columna legacy tenía valor,
auto-marcar el tag equivalente al cargar el recurso en el wizard.

### Tarea 6 · Acentos y lenguaje funcionario

Todo el copy del paso 2 está en `step2-content.copy.ts`. Si alguna
cadena del paso 2 queda fuera de ese módulo, muévela al módulo antes
de cerrar la tarea. Palabras que deben llevar acentos: Descripción,
Castellano, Gallego, Inglés, Francés, Portugués, Información, práctica,
público, específica, atención, etc.

### Tarea 7 · Test E2E del flujo completo

Ejecutar el checklist de aceptación del final del `integration.md`
(16 puntos). Documentar en el commit cualquier punto que no pase para
abordarlo en una iteración posterior.

---

## Lo que NO tocar

- Paso 1 (Identificación) — ya lo hicimos en el paso 0.
- Pasos 3, 4, 5, 6, 7 — cada uno tendrá su propio prompt.
- Schema de BD: `description_es` y `description_gl` siguen igual.
- Motor del wizard (`Wizard.tsx`) — no cambia.
- Progreso/stepper general ("Paso 2 de 7 — 14%") — irá en un prompt
  aparte de "wizard global".

## Mensajes de commit sugeridos

```
feat(cms): componentes HelpBlock, WordCountBadge, AiPreview, TranslationReadyToast (paso 2 · t1)
feat(edge): ai-writer.draft — nueva acción para borrador sin texto previo (paso 2 · t2)
feat(cms): aiDraft en cliente ai.ts (paso 2 · t3)
feat(cms): rediseño paso 2 con traducción automática al avanzar (paso 2 · t4)
refactor(cms): opciones de visibilidad fuera del paso 2 (paso 2 · t5)
chore(copy): acentos y lenguaje funcionario paso 2 (paso 2 · t6)
```
