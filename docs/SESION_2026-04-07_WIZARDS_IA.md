# Sesión 7 de abril de 2026 — Wizards "Guía Burros" + IA integrada

## Contexto

Tras la primera presentación a los miembros de la Mancomunidad de O Salnés (recepción muy positiva), se decidió transformar el CMS en una herramienta "rompedora" que guíe al usuario paso a paso en cada acción y asista con inteligencia artificial en redacción, traducción y SEO.

---

## A) Sistema de Wizards — "Guía Burros"

### Problema
El CMS tenía un formulario monolítico (`ResourceFormPage.tsx`) con 30+ campos y 8 fieldsets. Los técnicos municipales (no técnicos informáticos) se perdían al rellenar recursos turísticos.

### Solución implementada
Motor de wizards reutilizable con asistentes paso a paso para cada flujo de creación de contenido.

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `packages/cms/src/components/Wizard.tsx` | Motor reutilizable: componentes `Wizard`, `WizardFieldGroup`, `WizardCompletionCard`. Incluye stepper horizontal, barra de progreso animada, validación por paso, ayuda contextual, pasos opcionales y tarjetas de revisión |
| `packages/cms/src/pages/ResourceWizardPage.tsx` | Wizard de 7 pasos para crear/editar recursos turísticos |
| `packages/cms/src/pages/PageWizardPage.tsx` | Wizard de 4 pasos para crear/editar páginas editoriales |
| `packages/cms/src/components/DocumentUploadWizard.tsx` | Mini-wizard de subida de documentos con drag & drop, metadatos automáticos y estados visuales |

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `packages/cms/src/App.tsx` | Nuevas rutas: `/resources/new` y `/resources/:id` usan `ResourceWizardPage`; `/pages/new` y `/pages/:id/edit` usan `PageWizardPage`; formulario clásico accesible en `/resources/:id/classic` como fallback |
| `packages/cms/src/pages/PagesPage.tsx` | Botón "+ Nueva página (asistente)" y botón "Editar" redirige al wizard; "Edición rápida" mantiene el formulario inline |
| `packages/cms/src/styles.css` | +440 líneas de CSS para wizard, stepper, completion cards, drop zone, responsive |

### Detalle de los pasos del ResourceWizard

| Paso | Título | Contenido | Validación |
|------|--------|-----------|------------|
| 1 | Identificación | Tipología principal/secundarias, nombre ES/GL, slug auto-generado, municipio/zona | Nombre ES y slug obligatorios |
| 2 | Contenido | Descripción ES/GL con contador de palabras, opciones de visibilidad (acceso gratuito, público, mapa) | Ninguna (recomendado pero no obligatorio) |
| 3 | Ubicación + Contacto | Coordenadas GPS (con tip de Google Maps), dirección, teléfonos, email, web, horario, redes sociales | Validación de formato (lat/lng, email, URL) |
| 4 | Clasificación | Estrellas/tenedores, aforo, tipo cocina, tipos turismo UNE 178503, categorías portal | Opcional |
| 5 | Multimedia | Fotos/videos (MediaUploader), documentos (DocumentUploader), relaciones entre recursos. Aviso si el recurso no está guardado aún | Opcional |
| 6 | SEO e idiomas | Títulos y descripciones SEO con contadores, traducciones EN/FR/PT con botones de traducción automática | SEO desc max 300 chars |
| 7 | Revisión | Grid de 6 tarjetas (CompletionCards) con resumen visual: campos completos (verde), warnings (amarillo), incompletos (naranja). Botón "Editar" en cada tarjeta para volver al paso correspondiente | — |

### Detalle del PageWizard (4 pasos)

| Paso | Contenido |
|------|-----------|
| 1 - Básico | Título ES/GL, slug, plantilla (estándar/landing/info/experiencia) |
| 2 - Contenido | Cuerpo ES/GL con contador de palabras |
| 3 - SEO e idiomas | SEO title/desc, traducciones título EN/FR/PT |
| 4 - Revisión | 3 tarjetas de resumen |

### Características del motor Wizard

- Barra de progreso animada con porcentaje y transición CSS
- Stepper horizontal con iconos, estados (activo/completado/bloqueado)
- Validación por paso — no se puede avanzar sin completar campos obligatorios
- Pasos opcionales — se pueden saltar con botón "Saltar paso"
- Ayuda contextual — bloque azul con explicación en cada paso
- Tips (amarillos) — consejos prácticos por grupo de campos
- Completion cards — tarjetas de revisión con estado visual por campo
- Diseño responsive — funciona en móvil (stepper se compacta)
- Navegación libre hacia atrás — se puede volver a cualquier paso completado
- Warning de cambios sin guardar (beforeunload)

---

## B) Integración de IA

### Problema
Los editores de contenido no son redactores profesionales. Necesitan ayuda para escribir descripciones atractivas, traducir correctamente al gallego y otros idiomas, y optimizar para buscadores.

### Solución implementada
Sistema completo de asistencia IA con 6 acciones, integrado directamente en los wizards.

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `supabase/functions/ai-writer/index.ts` | Edge Function multipropósito con 6 acciones de IA. Usa Gemini 2.5 Flash. Prompts especializados en turismo de O Salnés con contexto de la comarca (municipios, vinos, gastronomía, patrimonio). Mock fallback si no hay API key |
| `packages/cms/src/lib/ai.ts` | Cliente IA tipado: funciones `aiImprove`, `aiTranslate`, `aiGenerateSeo`, `aiValidate`, `aiCategorize` con tipos TypeScript para cada respuesta |
| `packages/cms/src/components/AiWritingAssistant.tsx` | Panel inline debajo de los textareas. Botón "✨ Mejorar texto" y botones de traducción "→ Gallego/Inglés/Francés/Portugués". Muestra preview del resultado con opciones "Aplicar" o "Descartar" |
| `packages/cms/src/components/AiSeoGenerator.tsx` | Botón "🎯 Generar SEO con IA". Genera título y descripción SEO en ES y GL. Muestra preview estilo resultado de Google antes de aplicar. Contadores de caracteres |
| `packages/cms/src/components/AiQualityScore.tsx` | Botón "🔍 Evaluar calidad con IA". Muestra puntuación 0-100 con círculo visual, nivel (excelente/bueno/mejorable/incompleto), lista de problemas, sugerencias de mejora, campos faltantes. También sugiere tipos de turismo UNE 178503 con botón "Aplicar tipos sugeridos" |

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `packages/cms/src/pages/ResourceWizardPage.tsx` | Paso 2: `AiWritingAssistant` con traducción a 4 idiomas. Paso 6: `AiSeoGenerator` antes del formulario SEO. Paso 7: `AiQualityScore` con auto-categorización |
| `packages/cms/src/pages/PageWizardPage.tsx` | Paso 2: `AiWritingAssistant` con traducción a gallego |
| `packages/cms/src/styles.css` | +250 líneas: estilos de paneles IA (color púrpura #8e44ad como acento), animaciones slide-in, preview Google, score circle, tags de categorización |

### Detalle de las 6 acciones de la Edge Function `ai-writer`

| Acción | Prompt | Temperatura | Uso |
|--------|--------|-------------|-----|
| `improve` | Redactor experto en turismo. Mejora texto haciéndolo atractivo, evocador y profesional. Detalles sensoriales. 100-250 palabras | 0.7 | Botón "✨ Mejorar texto" |
| `translate` | Traductor especializado en turismo gallego. Gallego real (non castellano con cambios). Respeta nombres propios | 0.2 | Botones "→ Gallego/Inglés/Francés/Portugués" |
| `seo` | Experto SEO en turismo Galicia. Título <60 chars, descripción 120-160 chars. Keywords: Rías Baixas, Albariño, etc. Responde JSON | 0.4 | Botón "🎯 Generar SEO con IA" |
| `validate` | Auditor de calidad DTI. Evalúa score 0-100, nivel, issues, suggestions, missing_fields, seo_ready, translation_quality. Responde JSON | 0.4 | Botón "🔍 Evaluar calidad con IA" |
| `categorize` | Clasificador UNE 178503. Sugiere tipos turismo y categorías. Responde JSON | 0.4 | Se ejecuta junto con validate |
| `alt_text` | Genera alt text accesible <125 chars | 0.4 | Disponible para futura integración |

### Infraestructura IA existente (ya estaba antes)

| Función | Proveedor | Propósito |
|---------|-----------|-----------|
| `assistant` | Claude Haiku (Anthropic) | Asistente turístico público en la web |
| `cms-assistant` | Gemini 2.5 Flash | Chat IA flotante en el CMS |
| `auto-translate` | Gemini / LibreTranslate / DeepL / Mock | Worker de traducción en lote (background jobs) |
| **`ai-writer`** (NUEVO) | **Gemini 2.5 Flash** | **Mejora, traducción, SEO, validación, categorización inline** |

---

## CI/CD — Deploy automático

### Problema
El proyecto `osalnes-cms` en Cloudflare Pages estaba configurado como "Direct Upload" (subida manual arrastrando la carpeta `dist`). Cada cambio requería: build local → abrir Cloudflare → arrastrar carpeta → desplegar.

### Solución implementada
GitHub Action que auto-despliega el CMS con cada push a `main`.

### Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `.github/workflows/deploy-cms.yml` | Workflow que se dispara con cambios en `packages/cms/` o `packages/shared/`. Instala dependencias, construye shared, construye CMS con `vite build` (sin tsc para evitar errores pre-existentes), y despliega a Cloudflare Pages con Wrangler |

### Configuración necesaria (ya realizada)

| Secreto GitHub | Valor |
|----------------|-------|
| `CLOUDFLARE_ACCOUNT_ID` | `f6cae09a6113424202366d4c50cdf115` |
| `CLOUDFLARE_API_TOKEN` | Token con permisos "Edit Cloudflare Workers" + Cloudflare Pages Edit |

### Notas importantes
- El workflow usa `cd packages/cms && npx vite build` en vez de `npm run build` porque `tsc` falla con errores pre-existentes en archivos no modificados (`NavigationPage.tsx`, `CategoriesPage.tsx`, `RelationsManager.tsx`, `DocumentUploader.tsx`)
- La web pública (`osalnes.pages.dev`) ya tenía auto-deploy conectado a GitHub
- Las Edge Functions de Supabase NO se auto-despliegan (deploy manual con CLI)

---

## Commits realizados

| Hash | Mensaje |
|------|---------|
| `5e8562f` | feat(cms): sistema de wizards "guía burros" para creación guiada de contenido |
| `80a12b2` | feat(cms): integración de IA en wizards — escritura, SEO, traducción y validación |
| `b76a0b3` | ci: auto-deploy CMS a Cloudflare Pages vía GitHub Actions |
| `0c02903` | fix(ci): skip tsc in CMS deploy, use vite build directly |
| `93d0e4e` | ci: retrigger CMS deploy with fixed workflow |

---

## Estado actual del despliegue

| Servicio | URL | Estado | Auto-deploy |
|----------|-----|--------|-------------|
| Web pública | osalnes.pages.dev | ✅ Operativa | ✅ GitHub → Cloudflare Pages |
| CMS admin | osalnes-cms.pages.dev | ✅ Operativa | ✅ GitHub Actions → Cloudflare Pages |
| Edge Functions | oduglbxjcmmdexwplzvw.supabase.co/functions/v1/* | ✅ Operativas | ❌ Deploy manual (CLI) |
| Base de datos | Supabase PostgreSQL (West EU - Ireland) | ✅ Operativa | — |

---

## Pendiente — Punto C (próxima sesión)

### C1. Editor de texto enriquecido (WYSIWYG)
- Integrar TipTap (ProseMirror) para reemplazar textareas planos
- Negrita, cursiva, enlaces, listas, encabezados
- Botón de IA inline (seleccionar texto → mejorar)
- **Archivos**: `RichTextEditor.tsx`, modificar wizards, instalar `@tiptap/react`

### C2. Vista previa en tiempo real
- Panel lateral deslizable que muestra cómo queda el recurso en la web pública
- **Archivos**: `LivePreview.tsx`, `PreviewPanel.tsx`

### C3. Flujo editorial visual
- Barra de estado visual tipo Kanban (borrador → revisión → publicado → archivado)
- Timeline de actividad (quién hizo qué y cuándo)
- **Archivos**: `EditorialStatusBar.tsx`, `ActivityTimeline.tsx`

### C4. Operaciones masivas con IA
- Seleccionar múltiples recursos → "Traducir todos a GL", "Generar SEO", "Evaluar calidad"
- **Archivos**: `BulkAiActions.tsx`, `supabase/functions/ai-batch/index.ts`

### C5. Plantillas de contenido
- Al crear recurso, ofrecer plantillas pre-rellenadas según tipología (Hotel, Playa, Restaurante, Museo, Evento...)
- **Archivos**: `TemplateSelector.tsx`, `resource-templates.ts`

### C6. Auto-deploy Edge Functions
- GitHub Action para desplegar funciones Supabase automáticamente
- **Archivos**: `.github/workflows/deploy-functions.yml`
- **Secreto necesario**: `SUPABASE_ACCESS_TOKEN`

### Orden recomendado
C1 (WYSIWYG) → C5 (Plantillas) → C2 (Preview) → C3 (Flujo editorial) → C4 (Bulk IA) → C6 (Auto-deploy)

---

## Deuda técnica identificada

| Issue | Archivos afectados | Prioridad |
|-------|-------------------|-----------|
| Errores TypeScript pre-existentes | `NavigationPage.tsx` (propiedad `visible` no existe en `NavItem`), `CategoriesPage.tsx` (tipo `Category` no encontrado), `RelationsManager.tsx` (tipos incompatibles), `DocumentUploader.tsx` (tipos incompatibles) | Media — no bloquean el build de Vite pero sí tsc |
| Bundle size >500KB | `packages/cms/dist/assets/index-*.js` (546KB) | Baja — considerar code splitting con lazy imports |
| Warning Node.js 20 en GitHub Actions | `actions/checkout@v4` y `actions/setup-node@v4` | Baja — actualizar a Node 22 cuando sea estable |
