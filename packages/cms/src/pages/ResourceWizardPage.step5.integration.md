# Integración · Paso 5 en `ResourceWizardPage.tsx`

Cambios concretos para cablear el rediseño del paso 5. Este documento es
documentación, **no código compilable**.

---

## 1) Aplicar migración 023 + crear buckets de Storage

```bash
npx supabase db push

# Crear buckets (si no existen)
npx supabase storage create resource-images   --public
npx supabase storage create resource-documents --public
```

Verificar:
```sql
\dt public.resource_*
-- Deben existir: resource_images, resource_videos, resource_documents

select routine_name from information_schema.routines
where routine_schema='public' and routine_name='mark_image_as_primary';
-- Debe existir
```

## 2) Aplicar patch al cliente AI

Abrir `packages/cms/src/lib/ai.ts` y añadir al final lo de
`packages/cms/src/lib/ai.genAltText.patch.ts`:

- Interface `AiGenAltTextInput`.
- Función `aiGenAltText`.

## 3) Aplicar patch al Edge Function

Abrir `supabase/functions/ai-writer/index.ts` y seguir
`index.genAltText-action.patch.ts`:

1. Añadir `'genAltText'` al tipo `Action`.
2. Añadir `buildGenAltTextPrompt` y el case en el switch.
3. La action llama a Gemini Vision (modelo `gemini-1.5-flash` o
   equivalente con visión).
4. Si `GEMINI_API_KEY` no está, devuelve mock (no falla).

Desplegar:
```bash
npx supabase functions deploy ai-writer
```

## 4) Imports nuevos en `ResourceWizardPage.tsx`

```tsx
import ResourceWizardStep5Multimedia from './ResourceWizardStep5Multimedia';
import type {
  ImageItem,
  VideoItem,
  DocumentItem,
} from '@osalnes/shared/data/media';
import { aiGenAltText } from '../lib/ai';
import './step5-multimedia.css';
```

## 5) Estado nuevo

```tsx
const [mediaImages, setMediaImages] = useState<ImageItem[]>([]);
const [mediaVideos, setMediaVideos] = useState<VideoItem[]>([]);
const [mediaDocuments, setMediaDocuments] = useState<DocumentItem[]>([]);
```

Hidratación al cargar recurso (`resourceId != null`):
```tsx
useEffect(() => {
  if (!resourceId) return;
  void Promise.all([
    supabase.from('resource_images')
      .select('*').eq('resource_id', resourceId).order('sort_order'),
    supabase.from('resource_videos')
      .select('*').eq('resource_id', resourceId).order('sort_order'),
    supabase.from('resource_documents')
      .select('*').eq('resource_id', resourceId).order('sort_order'),
  ]).then(([imgRes, vidRes, docRes]) => {
    setMediaImages(mapImages(imgRes.data ?? []));
    setMediaVideos(mapVideos(vidRes.data ?? []));
    setMediaDocuments(mapDocuments(docRes.data ?? []));
  });
}, [resourceId]);
```

## 6) Handlers de Storage

### Imágenes

```tsx
async function handleUploadImage(file: File): Promise<ImageItem> {
  if (!resourceId) throw new Error('No resourceId');
  const uuid = crypto.randomUUID();
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${resourceId}/${uuid}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('resource-images')
    .upload(path, file, { contentType: file.type });
  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from('resource-images').getPublicUrl(path);

  // Si es la primera imagen, marcarla como primary
  const isPrimary = mediaImages.length === 0;

  const { data: inserted, error: dbError } = await supabase
    .from('resource_images')
    .insert({
      resource_id: resourceId,
      storage_path: path,
      mime_type: file.type,
      size_bytes: file.size,
      is_primary: isPrimary,
      sort_order: mediaImages.length,
    })
    .select()
    .single();
  if (dbError) throw dbError;

  const item = mapImages([inserted])[0];
  item.publicUrl = publicUrl;
  setMediaImages((curr) => [...curr, item]);
  return item;
}

async function handleSetImagePrimary(imageId: string) {
  await supabase.rpc('mark_image_as_primary', { p_image_id: imageId });
  setMediaImages((curr) =>
    curr.map((i) => ({ ...i, isPrimary: i.id === imageId }))
  );
}

async function handleGenerateImageAlt(imageId: string): Promise<string | null> {
  const img = mediaImages.find((i) => i.id === imageId);
  if (!img || !img.publicUrl) return null;

  const alt = await aiGenAltText({
    imageUrl: img.publicUrl,
    resourceContext: {
      name: resourceName,
      typeLabel: getTypeLabel(mainTypeKey),
      municipio: selectedMunicipio,
    },
  });
  if (!alt) return null;

  await supabase.from('resource_images')
    .update({ alt_text: alt, alt_source: 'ai' })
    .eq('id', imageId);

  setMediaImages((curr) =>
    curr.map((i) =>
      i.id === imageId ? { ...i, altText: alt, altSource: 'ai' } : i
    )
  );
  return alt;
}
```

Handlers similares para `onRemoveImage`, `onUpdateImageAlt`, videos y documentos (patrón idéntico: Supabase insert/update/delete + actualizar estado local).

## 7) Guardado de borrador en creación (decisión 1-B)

```tsx
async function handleSaveDraft(): Promise<string> {
  // Si ya hay resourceId (edición), no crear; solo devolver
  if (resourceId) return resourceId;

  const { data, error } = await supabase.from('resources').insert({
    name: resourceName,
    main_type_key: mainTypeKey,
    municipio_id: selectedMunicipioId,
    description_es: descriptionEs,
    publication_status: 'draft',
    // ... resto de campos del wizard que ya haya rellenado
  }).select().single();
  if (error) throw error;

  // Actualizar el resourceId en el estado del wizard
  setResourceId(data.id);
  return data.id;
}
```

## 8) Render del paso 5

Reemplaza el placeholder "Multimedia disponible tras guardar" por:

```tsx
<ResourceWizardStep5Multimedia
  resourceId={resourceId}
  onSaveDraft={handleSaveDraft}
  onSkip={() => goToStep(6)}

  images={mediaImages}
  videos={mediaVideos}
  documents={mediaDocuments}

  onUploadImage={handleUploadImage}
  onUpdateImageAlt={handleUpdateImageAlt}
  onSetImagePrimary={handleSetImagePrimary}
  onRemoveImage={handleRemoveImage}
  onGenerateImageAlt={handleGenerateImageAlt}

  onAddVideo={handleAddVideo}
  onRemoveVideo={handleRemoveVideo}
  onUpdateVideoTitle={handleUpdateVideoTitle}

  onUploadDocument={handleUploadDocument}
  onUpdateDocumentMeta={handleUpdateDocumentMeta}
  onRemoveDocument={handleRemoveDocument}
/>
```

## 9) Borrar la pantalla antigua del paso 5

En `ResourceWizardPage.tsx`, eliminar el bloque actual "Multimedia
disponible tras guardar" con el icono de cámara y mensaje fijo. Ya no se
usa.

## 10) Mapeo a PID (UNE 178503 §10.1.13 `hasMultimedia`)

| Campo interno | Campo schema.org / PID |
|---|---|
| Imagen con `is_primary=true` | `image` (principal) |
| Resto de imágenes | `image[]` o galería secundaria según exportador |
| `alt_text` de cada imagen | `caption` o `description` de la imagen |
| Vídeos | `video[]` (URL externa) |
| Documentos | No mapean directamente al PID. Se exponen en la web pública como "Descargas". |

## 11) Checklist E2E

- [ ] Migración 023 aplicada; existen tablas `resource_images`, `resource_videos`, `resource_documents` y función `mark_image_as_primary`.
- [ ] Buckets `resource-images` y `resource-documents` creados y públicos.
- [ ] Crear recurso nuevo: al llegar al paso 5 aparece el panel "Guarda primero el recurso" con botón "Guardar borrador y continuar".
- [ ] Pulsar "Guardar borrador y continuar": el `resourceId` se asigna, aparecen los 3 bloques (imágenes, vídeos, documentos).
- [ ] Subir una foto JPG/PNG/WebP → aparece en el grid con estrella ★ de portada.
- [ ] Subir una segunda foto → sin estrella. Pulsar ☆ en ella → la estrella se mueve; la primera pierde la suya.
- [ ] Foto >10 MB → error "pesa demasiado".
- [ ] Foto .gif → error "formato no admitido".
- [ ] Botón "Generar descripciones para las N fotos sin descripción" visible si hay fotos sin alt; tras pulsar, progreso en vivo; al acabar, mensaje "Se han generado N descripciones".
- [ ] Alt text de una foto puede editarse en su textarea; al perder foco, se guarda; el badge cambia a "Editado" si venía de IA.
- [ ] Añadir URL de YouTube (https://youtube.com/watch?v=…) → vídeo aparece con miniatura hqdefault.
- [ ] Añadir URL de Vimeo (https://vimeo.com/123) → vídeo aparece sin miniatura (placeholder).
- [ ] URL inválida ("https://google.com") → error "no es de un vídeo reconocido".
- [ ] Añadir el mismo vídeo dos veces → error "ya está añadido".
- [ ] Subir PDF → aparece en la lista; título auto-sugerido desde el nombre; tipo "Otro documento"; idioma "Castellano".
- [ ] Cambiar tipo a "Guía de visita" y idioma a "Gallego" → se guarda al cambiar.
- [ ] PDF >20 MB → error "pesa demasiado".
- [ ] Fichero .docx → error "formato no admitido" (solo PDF en esta iteración).
- [ ] Eliminar foto/vídeo/documento → pide confirmación; tras aceptar, desaparece del grid.
- [ ] Accesibilidad: dropzone operable con teclado (Tab + Enter/Espacio); textareas de alt text navegables por Tab.
- [ ] Móvil (<760px): los 3 bloques se apilan correctamente; AI batch bar ocupa 1 columna.
- [ ] Copy: todos los textos con acentos correctos.
