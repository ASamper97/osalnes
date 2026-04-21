# Checklist E2E · Paso 6 del wizard (rediseño SEO e idiomas)

Estado tras aplicar las 6 tareas del prompt `07_paso6_seo.md` sobre el
código del repo. Los 26 puntos del `ResourceWizardPage.step6.integration.md
§13` se evalúan aquí.

> ⚙ = verificado estáticamente en el código (no requiere browser).
> 👁 = requiere smoke test manual en el CMS desplegado tras los deploys
>       de `ai-writer`, `admin`, `api` y `web`.

| # | Punto | Estado |
|---|---|---|
| 1 | Migración 024 aplicada. 6 columnas + índice único parcial slug + 2 índices GIN + RPC `slug_is_available`. | ⚙ (verificado 2026-04-21: 7 columnas, 3 índices, RPC devuelve true para slug libre) |
| 2 | RPC `slug_is_available` devuelve TRUE para slugs libres. | ⚙ (comprobado con `cualquier-slug-imposible-de-existir`) |
| 3 | Paso 6: preview de Google a la izquierda, card social a la derecha. | 👁 (layout en `step6-seo.css` con grid 2 columnas ≥900px) |
| 4 | Preview Google actualiza en vivo al tipear; si vacío, nombre del recurso en cursiva. | ⚙ (`GoogleSearchPreview` reacciona a `seo.byLang[activeLang]` con fallback a `resourceName`) |
| 5 | Preview Google trunca con "…" si excede 70 caracteres. | ⚙ (helper del preview recorta a 70 chars) |
| 6 | Cambiar tab ES → GL: campos cambian; preview refleja el idioma activo. | ⚙ (tabs locales en `ResourceWizardStep6Seo`; el preview lee `activeLang`) |
| 7 | Contador título: verde/naranja/rojo según longitud. | ⚙ (`getLengthStatus` en `seo.ts` con bandas pass/warn/fail) |
| 8 | "✨ Generar SEO con IA" genera título + descripción razonables. | 👁 (requiere deploy ai-writer; el `handleGenerateSeoAi` llama action `generateSeo` con typeLabel+municipio+descEs) |
| 9 | Sin descripción en paso 2 → botón IA desactivado con tooltip. | ⚙ (el componente interno de `ResourceWizardStep6Seo` comprueba `descriptionEs.trim().length > 20`) |
| 10 | SlugEditor: cambiar valor → "Comprobando…" → "Disponible" / "Ya existe". | 👁 (`handleCheckSlugDuplicate` invoca RPC con `p_exclude_resource_id=savedId`; el componente debounce 400ms) |
| 11 | Recurso publicado → SlugEditor read-only con aviso 🔒. | ⚙ (`isPublished = editorialStatus === 'publicado'` se pasa al componente; decisión 3-B aplicada) |
| 12 | "Regenerar desde el nombre" → slug = slugify(nombre). | ⚙ (el botón del componente aplica `slugify(resourceName)` — helper en `seo.ts`) |
| 13 | Toggle indexación ON por defecto; al desactivar aviso amarillo. | ⚙ (default `true` en BD y en `emptyResourceSeo()`; `IndexationToggle` renderiza el warning cuando está OFF) |
| 14 | OgImageBlock: sin imagen principal ni override → mensaje "Aún no hay foto principal". | ⚙ (cae al estado vacío cuando `hasPrimaryImage=false && !ogOverrideUrl`) |
| 15 | Subir override → aparece en preview; botón "Volver a usar principal". | 👁 (`handleUploadOgOverride` sube al bucket y actualiza `seo.ogImageOverridePath`) |
| 16 | KeywordsEditor: añadir con Enter, quitar con Backspace la última. | ⚙ (handlers keyboard en el componente) |
| 17 | "✨ Sugerir con IA" → panel de chips clickables. | 👁 (requiere deploy ai-writer; `handleSuggestKeywordsAi` invoca action `suggestKeywords`) |
| 18 | "Añadir todas" → añade todas respetando límite. | ⚙ (componente valida contra `SEO_LIMITS.keywords.max`) |
| 19 | "Traducir todo a EN/FR/PT" → rellena los 3 idiomas. | 👁 (`handleTranslateAll` ejecuta 3 `aiTranslateResource` en paralelo y combina resultados) |
| 20 | Traducción individual por idioma funciona. | 👁 (`handleTranslateOne` por idioma desde `TranslationsBlock`) |
| 21 | Auditoría: nota 0-100, color rojo/amarillo/verde según rango. | ⚙ (motor `auditSeo()` + `SeoAuditPanel` con scoreBand helper) |
| 22 | "Ver auditoría detallada" → lista checks con ✓/⚠/✗ + explicación. | ⚙ (toggle `expanded` del panel) |
| 23 | Checks dinámicos: al arreglar un error la auditoría recalcula en vivo. | ⚙ (`useMemo(() => auditSeo(...))` en `ResourceWizardStep6Seo` con deps SEO/keywords/descripción) |
| 24 | Móvil (<900px): los 2 previews se apilan; OG image vertical. | ⚙ (media queries en `step6-seo.css`) |
| 25 | Copy: tildes correctas en todas las labels. | ⚙ (todo el copy vive en `step6-seo.copy.ts`; no hay literales en los componentes) |
| 26 | Web pública: `<title>`/`<meta description>`/`robots`/`canonical`/`og:*`/`twitter:card` se renderizan desde `seo_by_lang`/`indexable`/`canonical_url`/`og_image_override_path`. | 👁 (T5: `generateMetadata` actualizada en `/recurso/[slug]`; requiere deploy de web y recursos con datos en los campos nuevos) |

## Acciones pendientes para smoke test

El checklist funcional requiere tres deploys antes del smoke test:

```bash
cd "c:/Users/sampe/Downloads/O SALNÉS/osalnes-dti"
# Paso 6 · t3 — activa las 3 acciones SEO (generateSeo/suggestKeywords/
# translateResource)
npx supabase functions deploy ai-writer
# Paso 6 · t4 — activa los 6 campos SEO en el pipeline admin CRUD
# y en las respuestas mapResourceRow del CMS.
npx supabase functions deploy admin
# Paso 6 · t4 + t5 — mapResourceRow público expone los 6 campos al web.
npx supabase functions deploy api
```

Y redeploy del paquete `web` con `NEXT_PUBLIC_SUPABASE_URL` en env vars
(necesario para construir la URL pública del og:image override).

Sin el deploy de `admin`, los 6 campos del paso 6 se aceptan en el body
pero la BD los ignora (whitelist del update). Sin el deploy de `api`, la
web pública sigue emitiendo metadata desde los LocalizedValue legacy
(fallback funcional pero no consume seo_by_lang). Sin el deploy de
`ai-writer`, los 3 botones "✨ con IA" del paso 6 fallan con
`{error: "Invalid action"}`.

## Deuda abierta

- **og:image fallback a imagen primary del paso 5**: hoy el
  `generateMetadata` de la web solo usa `og_image_override_path` si
  está explícito. Cuando no hay override, falta la caída a la imagen
  primary del paso 5 como og:image. Requiere extender el response de
  `/resources/by-slug` con `primary_image_url` (edge function api:
  batch-fetch resource_images con `is_primary=true` y emitir
  `primary_image_url` en el mapper). Queda para cuando producto lo
  priorice — la compartición en redes hoy funciona con el fallback por
  defecto del dominio (Next.js usa la screenshot genérica).

- **`seo_by_lang` para idiomas adicionales (EN/FR/PT)**: el shape del
  paso 6 soporta `byLang` para los 5 idiomas (ES/GL base + EN/FR/PT
  adicionales), pero la UI del paso 6 solo pide ES/GL de forma
  explícita. Las traducciones EN/FR/PT de nombre+descripción llegan por
  `seo.translations`, no por `byLang`. En la web, `generateMetadata`
  para lang=en/fr/pt cae a `resource.name[lang]` + descripción
  truncada. Si producto quiere SEO curado en EN/FR/PT, hay que ampliar
  el `TranslationsBlock` para pedir también title/description SEO por
  idioma adicional.

- **Slug legacy con UNIQUE NOT NULL global**: el índice partial nuevo
  `idx_recurso_turistico_slug_unique` es redundante con la UNIQUE de
  migración 001. Al bajar la migración 024 (rollback) no se borra el
  índice partial (el .down.sql lo respeta explícitamente) porque
  podría venir de un estado anterior. Si se decide normalizar, hacerlo
  en una migración dedicada.

- **RPC `slug_is_available` podría validar formato**: hoy solo comprueba
  duplicados; no valida que el slug coincida con `isValidSlug()`. El
  cliente ya valida formato antes de llamar, pero si alguien usa la
  RPC directo (script de import, admin SQL editor) puede insertar un
  slug inválido. Refuerzo pendiente: `check` constraint en la columna
  slug o validación dentro de la RPC.

- **`canonical_url` sin validación de URL absoluta**: admin puede meter
  cualquier string; la web la emite tal cual en `<link rel="canonical">`.
  Si alguien pone una ruta relativa o URL malformada, Google la ignora
  (no rompe, pero no sirve). Pendiente: constraint regexp o validación
  cliente al guardar.
