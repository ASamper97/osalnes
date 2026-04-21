# Prompt maestro · Rediseño Paso 6 "SEO e idiomas"

**Pega este contenido en Claude Code.**

Ejecuta el rediseño del paso 6 del wizard de recursos. Se ejecuta
después de los pasos 0, 2, 3, 4 y 5.

---

## Contexto del cambio

El paso 6 actual tiene carencias concretas contra el pliego y contra
buenas prácticas SEO modernas:

1. **Sin preview de Google** — el funcionario escribe a ciegas.
2. **Sin preview de tarjeta social** (Open Graph) — cuando un visitante
   comparte en WhatsApp/Facebook, no sabe cómo quedará.
3. **Sin control de indexación** (pliego §5.1.7).
4. **Sin slug editable** desde este paso.
5. **Sin imagen Open Graph** específica.
6. **Sin keywords** ni sugeridor IA.
7. **Sin auditoría SEO** automática.
8. **Traducciones a EN/FR/PT** requieren 6 clics individuales.
9. **Copy con tildes faltantes** en todo el paso (decisión: revisar ortografía).

## Solución — decisiones del usuario

1. **1-C (amplio)**: preview Google + preview Open Graph + slug editable
   + indexación + keywords IA + auditoría + traducción masiva.
2. **2-B**: botón maestro "Traducir todo a EN/FR/PT" + botones por campo.
3. **3-B**: slug editable solo en borrador; bloqueado si publicado.
4. **4-A**: toggle "Visible en buscadores" (default ON) con explicación.
5. **5-A**: imagen Open Graph usa la principal del paso 5 por defecto;
   se puede subir una específica distinta.
6. **6-A**: keywords con chips + IA que lee la descripción del paso 2.

## Ficheros ya escritos en el repo

```
osalnes-dti/
├── database/migrations/
│   ├── 024_seo_fields.sql
│   └── 024_seo_fields.down.sql
│
├── packages/shared/src/data/
│   ├── seo.ts                       ← ResourceSeo + límites + slugify
│   └── seo-audit.ts                 ← motor auditoría 10 checks
│
├── packages/cms/src/
│   ├── components/
│   │   ├── GoogleSearchPreview.tsx
│   │   ├── SocialCardPreview.tsx
│   │   ├── SlugEditor.tsx
│   │   ├── IndexationToggle.tsx
│   │   ├── OgImageBlock.tsx
│   │   ├── KeywordsEditor.tsx
│   │   ├── TranslationsBlock.tsx
│   │   └── SeoAuditPanel.tsx
│   ├── lib/
│   │   └── ai.step6.patch.ts        ← instrucciones patch
│   └── pages/
│       ├── ResourceWizardStep6Seo.tsx
│       ├── step6-seo.copy.ts
│       ├── step6-seo.css
│       └── ResourceWizardPage.step6.integration.md
│
├── supabase/functions/ai-writer/
│   └── index.step6-actions.patch.ts ← instrucciones patch
│
└── prompts/
    └── 07_paso6_seo.md              ← este fichero
```

---

## Tareas en orden

### Tarea 1 · Aplicar migración 024

```bash
npx supabase db push
```

**Criterio**: `\d public.resources` muestra las columnas nuevas
(`seo_by_lang`, `translations`, `keywords`, `indexable`,
`og_image_override_path`, `canonical_url`), existe el índice
`idx_resources_slug_unique`, y `select public.slug_is_available('foo')`
devuelve `t`.

### Tarea 2 · Aplicar patch al cliente AI

Abrir `packages/cms/src/lib/ai.ts` y añadir las 3 funciones descritas
en `ai.step6.patch.ts`: `aiGenerateSeo`, `aiSuggestKeywords`,
`aiTranslateResource`.

**Criterio**: `pnpm --filter @osalnes/cms typecheck` pasa.

### Tarea 3 · Aplicar patch al Edge Function

Abrir `supabase/functions/ai-writer/index.ts` y añadir los 3 actions +
3 builders de prompt + 3 cases del switch según
`index.step6-actions.patch.ts`.

Desplegar:
```bash
npx supabase functions deploy ai-writer
```

Test manual con curl (ver ejemplos en el patch).

**Criterio**: `curl` con `action: "generateSeo"` devuelve JSON
`{title, description}` válidos, o mock si no hay `GEMINI_API_KEY`.

### Tarea 4 · Integrar componente en ResourceWizardPage

Seguir la guía paso a paso en
`packages/cms/src/pages/ResourceWizardPage.step6.integration.md`
(secciones 3-11).

Puntos clave:
- Nuevo estado `seo: ResourceSeo` con hidratación desde BD.
- 4 handlers IA (generateSeo, suggestKeywords, translateOne, translateAll).
- Handler `handleCheckSlugDuplicate` llamando a la RPC.
- Handlers para imagen OG override (upload + remove desde Storage).
- Reemplazar los 10 campos legacy del paso 6 actual por el componente
  nuevo.
- Guardado en BD con los nuevos campos.

### Tarea 5 · Meta tags en la web pública

En `packages/web/` (Next.js), localizar la página de detalle de recurso
(`/recurso/[slug]`) y añadir los meta tags según sección 12 del
integration.md:
- `<title>` y `<meta name="description">` desde `seo_by_lang`.
- `<meta name="robots">` si `indexable=false`.
- `<meta property="og:*">` para Open Graph.
- `<meta name="twitter:card">`.

**No bloqueante** — el CMS funciona igual; esto es para que los previews
del paso 6 se correspondan con la realidad de la web pública.

### Tarea 6 · Test E2E

Ejecutar los 26 puntos del checklist en integration.md sección 13.

---

## Lo que NO tocar

- Pasos 1, 2, 3, 4, 5, 7.
- La función de traducción `aiTranslate` antigua si existe — este paso
  añade `aiTranslateResource` que es distinta (traduce nombre +
  descripción corta, no textos largos).

## Mensajes de commit sugeridos

```
feat(db): migración 024 · SEO + indexación + Open Graph (paso 6 · t1)
feat(cms): aiGenerateSeo + aiSuggestKeywords + aiTranslateResource en cliente (paso 6 · t2)
feat(edge): ai-writer · 3 actions SEO (paso 6 · t3)
feat(cms): paso 6 rediseño completo con preview Google/OG + auditoría + slug + keywords IA (paso 6 · t4)
feat(web): meta tags SEO/OG/Twitter en fichas de recurso (paso 6 · t5)
docs: checklist E2E paso 6 (paso 6 · t6)
```
