# Checklist E2E · Paso 5 del wizard (rediseño multimedia)

Estado tras aplicar las 7 tareas del prompt `06_paso5_multimedia.md`
sobre el código del repo. Los 18 puntos del
`ResourceWizardPage.step5.integration.md §11` se evalúan aquí.

> ⚙ = verificado estáticamente en el código (no requiere browser).
> 👁 = requiere smoke test manual en el CMS desplegado tras los deploys
>       de `ai-writer`, `admin` y `api` (ver "Acciones pendientes" abajo).

| # | Punto | Estado |
|---|---|---|
| 1 | Migración 023 aplicada. Existen tablas `resource_images`, `resource_videos`, `resource_documents` y función `mark_image_as_primary`. | ⚙ (aplicada 2026-04-21 vía SQL editor — `supabase db push` reportaba "up to date" por descoordinación de history; verificado 3/3 tablas + función) |
| 2 | Buckets `resource-images` y `resource-documents` creados y públicos. | ⚙ (creados por SQL insert en `storage.buckets`; ambos con `public=true`) |
| 3 | Crear recurso nuevo: al llegar al paso 5 aparece el panel "Guarda primero el recurso" con botón "Guardar borrador y continuar". | ⚙ (el componente `ResourceWizardStep5Multimedia` renderiza el panel cuando `resourceId === null`; en la práctica el auto-save de step 0 hace que savedId ya esté poblado — el panel solo se ve si el usuario salta al paso 5 antes de poner nombre) |
| 4 | Pulsar "Guardar borrador y continuar": el `resourceId` se asigna, aparecen los 3 bloques (imágenes, vídeos, documentos). | 👁 (el handler `handleSaveDraft` crea un recurso con slug/nombre fallback `borrador-{timestamp}` y setea savedId; la re-render del componente muestra los 3 bloques) |
| 5 | Subir una foto JPG/PNG/WebP → aparece en el grid con estrella ★ de portada. | 👁 (primera imagen con `is_primary=true` por defecto en `handleUploadImage`) |
| 6 | Subir una segunda foto → sin estrella. Pulsar ☆ en ella → la estrella se mueve; la primera pierde la suya. | 👁 (RPC `mark_image_as_primary` atómico: UPDATE is_primary = (id = p_image_id) para todo el recurso) |
| 7 | Foto >10 MB → error "pesa demasiado". | ⚙ (`MEDIA_LIMITS.image.maxBytes = 10*1024*1024`; validación cliente en `ImagesBlock.handleFiles` antes del upload) |
| 8 | Foto .gif → error "formato no admitido". | ⚙ (`MEDIA_LIMITS.image.acceptedMimes` no incluye `image/gif`) |
| 9 | Botón "Generar descripciones para las N fotos sin descripción" visible si hay fotos sin alt; tras pulsar, progreso en vivo; al acabar, mensaje "Se han generado N descripciones". | 👁 (el `AiBatchBar` de `ImagesBlock` itera por fotos sin alt llamando `onGenerateAlt` y reporta progreso; cumple si el deploy del edge ai-writer está hecho) |
| 10 | Alt text editable en la textarea; al perder foco, se guarda; el badge cambia a "Editado" si venía de IA. | ⚙ (`ImageCard.commitAlt` se dispara en onBlur; `alt_source` pasa a `ai-edited` cuando viene de `ai`) |
| 11 | Añadir URL de YouTube → vídeo aparece con miniatura hqdefault. | ⚙ (`parseVideoUrl` reconoce `youtube.com/watch`, `youtu.be`, `youtube.com/embed`, `youtube.com/shorts`; `getVideoThumbnailUrl` devuelve `https://i.ytimg.com/vi/{id}/hqdefault.jpg`) |
| 12 | Añadir URL de Vimeo → vídeo aparece sin miniatura (placeholder). | ⚙ (Vimeo requiere oEmbed; el cliente deja thumbnail `null` y el `VideosBlock` muestra placeholder) |
| 13 | URL inválida → error "no es de un vídeo reconocido". | ⚙ (`parseVideoUrl` devuelve null; `VideosBlock.handleAdd` muestra `COPY.addErrorInvalid`) |
| 14 | Añadir el mismo vídeo dos veces → error "ya está añadido". | ⚙ (índice `idx_resource_videos_unique` UNIQUE(resource_id, url); el insert falla y el handler captura el error genérico — la variante "ya existe" se detecta cliente-side en `VideosBlock`) |
| 15 | Subir PDF → aparece en la lista; título auto-sugerido desde el nombre; tipo "Otro documento"; idioma "Castellano". | 👁 (`DocumentsBlock` rellena el formulario con `title = nombreFichero.replace('.pdf','')`, kind=`otro`, lang=`es`) |
| 16 | Cambiar tipo a "Guía de visita" y idioma a "Gallego" → se guarda al cambiar. | 👁 (`handleUpdateDocumentMeta` hace UPDATE incremental) |
| 17 | PDF >20 MB → error "pesa demasiado". | ⚙ (`MEDIA_LIMITS.document.maxBytes = 20*1024*1024`) |
| 18 | Fichero .docx → error "formato no admitido" (solo PDF). | ⚙ (`MEDIA_LIMITS.document.acceptedMimes = ['application/pdf']`) |
| 19 | Eliminar foto/vídeo/documento → pide confirmación; tras aceptar, desaparece del grid. | 👁 (`window.confirm` en los 3 componentes; tras confirmar, DELETE en BD + remove best-effort en Storage) |
| 20 | Accesibilidad: dropzone operable con teclado; textareas de alt text navegables. | 👁 (dropzone tiene `role='button'` + `tabIndex=0` + handler Enter/Space) |
| 21 | Móvil (<760px): los 3 bloques se apilan; AI batch bar en 1 columna. | 👁 (media queries en `step5-multimedia.css`) |

## Acciones pendientes para smoke test

El checklist funcional requiere tres deploys antes del smoke test:

```bash
cd "c:/Users/sampe/Downloads/O SALNÉS/osalnes-dti"
# Paso 5 · t3 — activa la acción genAltText con Gemini Vision
npx supabase functions deploy ai-writer
# Paso 5 · t6 — activa el mapeo hasMultimedia en el export batch
npx supabase functions deploy admin
# Paso 5 · t6 — activa el mapeo hasMultimedia en el export público
npx supabase functions deploy api
```

Además: configurar `GEMINI_API_KEY` en los secrets del proyecto Supabase.
Sin ella, la acción `genAltText` devuelve mock `"Imagen de {name} en
{municipio}."` con `mock: true` — útil para desarrollo pero sin análisis
visual real.

## Deuda abierta

- **Limpieza física de Storage al borrar recurso**: el CASCADE del FK
  borra las filas en `resource_images` / `resource_videos` /
  `resource_documents`, pero los objetos físicos en los buckets
  `resource-images` y `resource-documents` quedan huérfanos. Opciones
  pendientes de decisión producto:
    1. Trigger PostgreSQL AFTER DELETE que llame a la Storage API.
    2. Cron job que escanee huérfanos (sin fila que lo referencie) y
       los elimine.
    3. Script manual de limpieza semestral.
  Las 3 opciones son post-MVP; mientras tanto, el handler del wizard
  hace best-effort remove al borrar desde el CMS (`remove([path])` sin
  await-bloqueante), pero no al hacer `DELETE FROM recurso_turistico`.

- **RLS permissive en `resource_*`**: las policies `write_*_authenticated`
  permiten insert/update/delete a cualquier usuario autenticado, no a
  quien editó el recurso padre. En una segunda pasada sería deseable
  restringir write a editores/admins del recurso específico. El modelo
  actual de `recurso_turistico` tampoco tiene esa granularidad, así que
  heredar sería consistente con el resto del schema.

- **Vimeo sin miniatura**: resolver el oEmbed de Vimeo requiere un
  proxy server-side (CORS bloquea fetch directo desde el CMS). Queda
  como nice-to-have: el placeholder actual es aceptable y el editor ve
  el título si lo rellena.

- **Reordenar imágenes por drag & drop**: el `sort_order` se asigna al
  subir pero no hay UI para reorganizar. Cuando producto lo pida, se
  puede añadir con react-dnd o con flechas arriba/abajo actualizando
  `sort_order` con UPDATE batch.

- **Miniaturas locales (optimización de ancho de banda)**: no generamos
  thumbs de las imágenes subidas. El cliente carga la imagen completa
  para mostrar el grid. Si en producción el peso impacta, Supabase
  Storage tiene un servicio `transform` con URL query (`?width=400`)
  que el mapper de `publicUrl` podría explotar.

- **GEMINI_API_KEY no reusa Vision API separada**: si el cliente quiere
  desacoplar costes de alt text del resto de acciones IA, habrá que
  dividir en dos secrets. Hoy todas las acciones comparten el mismo key.
