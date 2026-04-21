# Prompt maestro · Rediseño Paso 5 "Multimedia"

**Pega este contenido en Claude Code.**

Ejecuta el rediseño del paso 5 del wizard de recursos. Se ejecuta después
de los pasos 0, 2, 3 y 4.

---

## Contexto del cambio

El paso 5 actual muestra solo un mensaje "Multimedia disponible tras
guardar" sin posibilidad de hacer nada en creación. Además no cumple los
requisitos del pliego §5.1.5 ni WCAG 2.1 AA (criterio 1.1.1 alt text).

## Solución (5 decisiones del usuario)

1. **Botón "Guardar borrador y continuar"** en creación para desbloquear
   el paso.
2. **IA de alt text por lote** (contador "N fotos sin descripción").
3. **Vídeos solo por URL externa** (YouTube/Vimeo) — no subida .mp4.
4. **Documentos descargables** con metadata (título + tipo + idioma).
5. **Relaciones entre recursos: POSPUESTAS** a iteración futura.
6. **Imagen principal** = primera foto; estrella cambiable en las demás.

## Ficheros ya escritos en el repo

```
osalnes-dti/
├── database/migrations/
│   ├── 023_media_tables.sql
│   └── 023_media_tables.down.sql
│
├── packages/shared/src/data/
│   └── media.ts                            ← ImageItem/VideoItem/DocumentItem + MEDIA_LIMITS
│
├── packages/cms/src/
│   ├── components/
│   │   ├── ImagesBlock.tsx                 ← dropzone + grid + alt IA batch
│   │   ├── VideosBlock.tsx                 ← URL YouTube/Vimeo
│   │   └── DocumentsBlock.tsx              ← PDFs + metadata
│   ├── lib/
│   │   └── ai.genAltText.patch.ts          ← instrucciones patch
│   └── pages/
│       ├── ResourceWizardStep5Multimedia.tsx
│       ├── step5-multimedia.copy.ts
│       ├── step5-multimedia.css
│       └── ResourceWizardPage.step5.integration.md
│
├── supabase/functions/ai-writer/
│   └── index.genAltText-action.patch.ts    ← instrucciones patch
│
└── prompts/
    └── 06_paso5_multimedia.md              ← este fichero
```

---

## Tareas en orden

### Tarea 1 · Aplicar migración 023 y crear buckets de Storage

```bash
npx supabase db push

npx supabase storage create resource-images   --public
npx supabase storage create resource-documents --public
```

**Criterio**: tablas `resource_images`, `resource_videos`, `resource_documents` y función `mark_image_as_primary` existen; ambos buckets aparecen como públicos en el dashboard de Supabase.

### Tarea 2 · Aplicar patch al cliente AI

Abrir `packages/cms/src/lib/ai.ts` y añadir según
`packages/cms/src/lib/ai.genAltText.patch.ts`.

**Criterio**: `import { aiGenAltText } from '../lib/ai'` compila.

### Tarea 3 · Aplicar patch al Edge Function

Abrir `supabase/functions/ai-writer/index.ts` y añadir la action
`genAltText` según `index.genAltText-action.patch.ts`.

Desplegar:
```bash
npx supabase functions deploy ai-writer
```

Test manual con curl (ver la sección 7 del patch).

**Criterio**: la action devuelve un alt text válido (o el mock si no hay GEMINI_API_KEY).

### Tarea 4 · Integrar el componente Step5 en ResourceWizardPage

Seguir la guía paso a paso en
`packages/cms/src/pages/ResourceWizardPage.step5.integration.md`
(secciones 4-9).

Clave: implementar los handlers contra Supabase Storage + las 3 tablas
media, y el handler de guardado de borrador (sección 7).

### Tarea 5 · Borrar la pantalla legacy

Eliminar de `ResourceWizardPage.tsx` el bloque "Multimedia disponible
tras guardar" con el icono de cámara. Lo reemplaza el componente nuevo.

### Tarea 6 · Exportación a PID (opcional)

Localizar el exportador y mapear `resource_images`, `resource_videos`,
`resource_documents` a `hasMultimedia` según la sección 10 del
integration.md.

### Tarea 7 · Checklist E2E

Ejecutar los 18 puntos del checklist de aceptación del integration.md.
Documentar los que no pasen.

---

## Lo que NO tocar

- Pasos 1, 2, 3, 4, 6, 7 — cada uno tiene su propio prompt.
- Relaciones entre recursos (pospuestas a iteración propia).
- Subida directa de vídeos .mp4 (solo URLs externas).

## Mensajes de commit sugeridos

```
feat(db): migración 023 · tablas multimedia + RPC mark_image_as_primary (paso 5 · t1)
feat(cms): aiGenAltText en cliente ai.ts (paso 5 · t2)
feat(edge): ai-writer.genAltText con Gemini Vision (paso 5 · t3)
feat(cms): paso 5 multimedia con alt IA, vídeos URL y documentos (paso 5 · t4)
chore(cms): eliminar pantalla legacy "Multimedia disponible tras guardar" (paso 5 · t5)
chore(pid): mapeo hasMultimedia (paso 5 · t6, opcional)
docs: checklist E2E paso 5 (paso 5 · t7)
```
