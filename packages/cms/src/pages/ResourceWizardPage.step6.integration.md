# Integración · Paso 6 en `ResourceWizardPage.tsx`

---

## 1) Aplicar migración 024

```bash
npx supabase db push
```

Verificar:
```sql
\d public.resources
-- Deben aparecer: seo_by_lang, translations, keywords, indexable,
-- og_image_override_path, canonical_url

select * from pg_indexes
where tablename='resources' and indexname like '%slug%';
-- Debe existir idx_resources_slug_unique

select public.slug_is_available('foo-bar');
-- Debe devolver TRUE (no hay recurso con ese slug)
```

## 2) Aplicar patches AI

### 2a. Cliente
`packages/cms/src/lib/ai.ts` — añadir al final lo descrito en
`ai.step6.patch.ts`:
- `aiGenerateSeo`
- `aiSuggestKeywords`
- `aiTranslateResource`

### 2b. Edge Function
`supabase/functions/ai-writer/index.ts` — añadir según
`index.step6-actions.patch.ts`:
- 3 actions nuevas (`generateSeo`, `suggestKeywords`, `translateResource`)
- 3 builders de prompt
- 3 cases en el switch

Desplegar: `npx supabase functions deploy ai-writer`

## 3) Imports nuevos en ResourceWizardPage.tsx

```tsx
import ResourceWizardStep6Seo from './ResourceWizardStep6Seo';
import {
  type ResourceSeo,
  emptyResourceSeo,
  type AnyLang,
  type AdditionalLang,
  type TranslationByLang,
  type SeoByLang,
} from '@osalnes/shared/data/seo';
import {
  aiGenerateSeo,
  aiSuggestKeywords,
  aiTranslateResource,
} from '../lib/ai';
import './step6-seo.css';
```

## 4) Estado nuevo

```tsx
const [seo, setSeo] = useState<ResourceSeo>(emptyResourceSeo());

// Hidratación desde BD
useEffect(() => {
  if (!initialResource) return;
  setSeo({
    byLang: (initialResource.seo_by_lang as any) ?? {},
    translations: (initialResource.translations as any) ?? {},
    slug: initialResource.slug ?? '',
    indexable: initialResource.indexable ?? true,
    ogImageOverridePath: initialResource.og_image_override_path ?? null,
    keywords: (initialResource.keywords as string[]) ?? [],
    canonicalUrl: initialResource.canonical_url ?? null,
  });
}, [initialResource]);
```

## 5) Handlers IA

```tsx
async function handleGenerateSeoAi(lang: AnyLang): Promise<SeoByLang | null> {
  return aiGenerateSeo({
    descriptionEs,
    resourceName,
    lang: lang as 'es' | 'gl',
    typeLabel: getTypeLabel(mainTypeKey),
    municipio: selectedMunicipioName,
  });
}

async function handleSuggestKeywordsAi(descriptionEs: string): Promise<string[]> {
  return aiSuggestKeywords(descriptionEs);
}

async function handleTranslateOne(lang: AdditionalLang): Promise<TranslationByLang | null> {
  return aiTranslateResource({
    resourceName,
    descriptionEs,
    targetLang: lang,
  });
}

async function handleTranslateAll(): Promise<Partial<Record<AdditionalLang, TranslationByLang>>> {
  const langs: AdditionalLang[] = ['en', 'fr', 'pt'];
  const results: Partial<Record<AdditionalLang, TranslationByLang>> = {};
  await Promise.all(langs.map(async (lang) => {
    try {
      const r = await aiTranslateResource({ resourceName, descriptionEs, targetLang: lang });
      if (r.name && r.description) results[lang] = r;
    } catch { /* ignora el que falle */ }
  }));
  return results;
}
```

## 6) Handler slug duplicate

```tsx
async function handleCheckSlugDuplicate(slug: string): Promise<boolean> {
  const { data } = await supabase.rpc('slug_is_available', {
    p_slug: slug,
    p_exclude_resource_id: resourceId,
  });
  return data === false;  // la RPC devuelve true si está disponible
}
```

## 7) Handlers Open Graph override

```tsx
async function handleUploadOgOverride(file: File): Promise<string> {
  if (!resourceId) throw new Error('Recurso sin ID');
  const uuid = crypto.randomUUID();
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${resourceId}/og-${uuid}.${ext}`;

  const { error } = await supabase.storage
    .from('resource-images')
    .upload(path, file, { contentType: file.type });
  if (error) throw error;

  await supabase.from('resources')
    .update({ og_image_override_path: path })
    .eq('id', resourceId);

  return path;
}

async function handleRemoveOgOverride(): Promise<void> {
  if (!resourceId) return;
  const currentPath = seo.ogImageOverridePath;

  await supabase.from('resources')
    .update({ og_image_override_path: null })
    .eq('id', resourceId);

  if (currentPath) {
    await supabase.storage.from('resource-images').remove([currentPath]);
  }
}
```

## 8) Obtener URLs públicas para previews

```tsx
const primaryImage = useMemo(
  () => mediaImages.find((i) => i.isPrimary) ?? null,
  [mediaImages],
);
const primaryImageUrl = primaryImage?.publicUrl ?? null;

const ogOverrideUrl = useMemo(() => {
  if (!seo.ogImageOverridePath) return null;
  const { data } = supabase.storage
    .from('resource-images')
    .getPublicUrl(seo.ogImageOverridePath);
  return data.publicUrl;
}, [seo.ogImageOverridePath]);
```

## 9) Render del paso 6

```tsx
<ResourceWizardStep6Seo
  seo={seo}
  onChange={setSeo}
  resourceName={resourceName}
  descriptionEs={descriptionEs}
  hasPrimaryImage={primaryImage != null}
  primaryImageUrl={primaryImageUrl}
  ogOverrideUrl={ogOverrideUrl}
  isPublished={publicationStatus === 'published'}
  onGenerateSeoAi={handleGenerateSeoAi}
  onSuggestKeywordsAi={handleSuggestKeywordsAi}
  onTranslateOne={handleTranslateOne}
  onTranslateAll={handleTranslateAll}
  onCheckSlugDuplicate={handleCheckSlugDuplicate}
  currentResourceId={resourceId}
  onUploadOgOverride={handleUploadOgOverride}
  onRemoveOgOverride={handleRemoveOgOverride}
/>
```

## 10) Guardado en BD

Al persistir el recurso, incluir:
```tsx
const payload = {
  ...existingFields,
  seo_by_lang: seo.byLang,
  translations: seo.translations,
  slug: seo.slug,
  indexable: seo.indexable,
  og_image_override_path: seo.ogImageOverridePath,
  keywords: seo.keywords,
  canonical_url: seo.canonicalUrl,
};
```

## 11) Borrar la UI legacy

En `ResourceWizardPage.tsx`, quitar los campos SEO antiguos:
- Los 4 inputs "Titulo SEO (ES/GL)" + "Descripcion SEO (ES/GL)".
- Los 6 campos "Nombre/Descripcion (EN/FR/PT)" con botones Traducir individuales.
- El tip amarillo legacy.

## 12) Exportación a PID + meta tags en web pública

La web pública (`packages/web/`) debe consumir estos campos:

```tsx
// En page.tsx de /recurso/[slug]
<Head>
  <title>{seo.byLang[lang]?.title ?? resource.name}</title>
  <meta name="description" content={seo.byLang[lang]?.description ?? ''} />
  <meta name="keywords" content={seo.keywords.join(', ')} />
  {!seo.indexable && <meta name="robots" content="noindex,nofollow" />}
  {seo.canonicalUrl && <link rel="canonical" href={seo.canonicalUrl} />}

  <meta property="og:title" content={seo.byLang[lang]?.title ?? resource.name} />
  <meta property="og:description" content={seo.byLang[lang]?.description ?? ''} />
  <meta property="og:image" content={ogImageUrl} />
  <meta property="og:url" content={canonicalOrCurrent} />
  <meta property="og:type" content="article" />
  <meta name="twitter:card" content="summary_large_image" />
</Head>
```

El mapeo a PID/UNE 178503 (si se exporta):
- `seo.byLang.es.title` → `hasDescription.metaTitle.value` (es)
- `seo.byLang.gl.title` → `hasDescription.metaTitle.value` (gl)
- `seo.keywords` → `hasDescription.keywords`
- `seo.translations.en.name` → `name[].value` (lang: en)

## 13) Checklist E2E

- [ ] Migración 024 aplicada.
- [ ] RPC `slug_is_available` devuelve TRUE para slugs libres.
- [ ] Paso 6: preview de Google aparece a la izquierda, card social a la derecha.
- [ ] Preview Google actualiza en vivo al tipear el título; si vacío, muestra el nombre del recurso en cursiva.
- [ ] Preview Google trunca con "…" si excede 70 caracteres.
- [ ] Cambiar tab ES → GL: los campos cambian; el preview refleja el idioma activo.
- [ ] Contador del título pasa de verde (OK) a naranja (corto/largo) a rojo (over-hard) según longitud.
- [ ] Botón "✨ Generar SEO con IA" genera título + descripción razonables (si hay descripción en paso 2).
- [ ] Sin descripción en paso 2 → botón IA desactivado con tooltip.
- [ ] SlugEditor: cambiar valor → status "Comprobando…" → "Disponible" / "Ya existe".
- [ ] Recurso publicado → SlugEditor en read-only con aviso 🔒.
- [ ] Botón "Regenerar desde el nombre" → slug se rellena con slugify(nombre).
- [ ] Toggle indexación ON por defecto; al desactivar aparece el aviso amarillo.
- [ ] OgImageBlock: sin imagen principal ni override → muestra mensaje "Aún no hay foto principal".
- [ ] Subir override → aparece en el preview; botón "Volver a usar principal" visible.
- [ ] KeywordsEditor: añadir manualmente con Enter y Backspace para quitar la última.
- [ ] Botón "✨ Sugerir con IA" → panel con chips "+ keyword"; cada uno clickable.
- [ ] "Añadir todas" → se añaden todas respetando el límite.
- [ ] Traducciones: botón "Traducir todo a Inglés, Francés, Portugués" → rellena los 3 idiomas.
- [ ] Traducción individual por idioma funciona.
- [ ] Auditoría SEO: nota 0-100 visible; color rojo/amarillo/verde según rango.
- [ ] "Ver auditoría detallada" → lista de checks con ✓/⚠/✗ y explicación.
- [ ] Checks dinámicos: al arreglar un error, la auditoría recalcula en vivo.
- [ ] Móvil (<900px): los 2 previews se apilan; OG image se apila vertical.
- [ ] Copy: tildes correctas en todas las labels.
