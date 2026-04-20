# Checklist E2E · Paso 2 del wizard (rediseño v2)

Estado tras aplicar las 6 tareas del prompt `03_paso2_content.md` (paso 2
contenido) sobre el código del repo. Los 16 puntos del
`ResourceWizardPage.step2.integration.md` se evalúan aquí.

> ⚙ = verificado estáticamente en el código (no requiere browser).
> 👁 = requiere smoke test manual en el CMS desplegado con GEMINI_API_KEY
>       configurada y edge function `ai-writer` redesplegada tras la
>       acción `draft` (T2).

| # | Punto | Estado |
|---|---|---|
| 1 | Editor ES vacío → botón púrpura "Escribir un primer borrador con IA" | 👁 |
| 2 | Pulsar → AiPreview con "Usar / Descartar"; aplicar rellena ES | 👁 |
| 3 | Con 3 palabras a mano → botón cambia a "Mejorar el texto actual con IA" | 👁 |
| 4 | WordCountBadge ES: 0 gris, 30 ámbar, 150 verde, 400 ámbar | 👁 |
| 5 | Editor GL **sin** badge; línea de estado ("Aún sin traducción" / "Traducción de la descripción en castellano" / "Traducción editada por ti") | 👁 |
| 6 | "Traducir al gallego" con ES vacío → deshabilitado, tooltip explica | 👁 |
| 7 | "Traducir al gallego" con ES relleno → preview IA, aplicar mueve a GL, estado pasa a "translated" | 👁 |
| 8 | Traducción automática al avanzar paso 2 → paso 3, ~3-6s, toast aparece, "Revisar ahora" vuelve a paso 2 | 👁 |
| 9 | Durante background corriendo, en paso 2 aparece badge con spinner "Traduciendo al gallego…" | 👁 |
| 10 | Durante background corriendo, botón manual "Traducir al gallego" deshabilitado | 👁 |
| 11 | 3 opciones de visibilidad **NO** en el paso 2 | ⚙ (ResourceWizardStep2Content no las incluye; paso 7 tiene "Visible en mapa"; gratuito via tag `caracteristicas.gratuito`) |
| 12 | Traducciones EN/FR/PT **NO** en el paso 2 | ⚙ (grep `translationTargets` en Step2Content devuelve 0 resultados — van al paso 6) |
| 13 | Acentos correctos en todo el copy (Descripción, Castellano, Gallego, Inglés, Francés, Portugués, Información, práctica, público, específica) | ⚙ ([step2-content.copy.ts](../../packages/cms/src/pages/step2-content.copy.ts) auditado, 100% del copy del paso 2 vive en el módulo) |
| 14 | Un único tag `tipo-de-recurso.*` por recurso (no duplicado paso 1 ↔ paso 4) | ⚙ (useEffect de sync en [ResourceWizardPage.tsx:377](../../packages/cms/src/pages/ResourceWizardPage.tsx#L377) filtra previos y garantiza unicidad) |
| 15 | HelpBlock ocultable con persistencia en localStorage | ⚙ (HelpBlock tiene prop `storageKey="resource-wizard-step2"`) / 👁 (verificar reload) |
| 16 | `description_es` y `description_gl` persisten al guardar y recargar | 👁 |

## Deuda que queda abierta

- **Tag `caracteristicas.publico` no existe** en el catálogo UNE. El
  `publicAccess` legacy se mantiene como columna propia sin mapeo. Comentario
  `// TODO producto` en `handleFinish`. Decisión pendiente con Mancomunidad.
- **Toolbar subset en `RichTextEditor`**: la prop `toolbar?: string[]` se
  acepta pero no filtra — la barra muestra todos los botones siempre. No
  bloquea ningún criterio del checklist. Deuda documentada en la interface.
- **Deploy manual pendiente**: la acción `draft` del edge function sube
  solo al ejecutar `npx supabase functions deploy ai-writer`. Hasta
  entonces, el botón "Escribir borrador con IA" (punto 1) fallará con
  "Invalid action: draft" — los demás caminos (improve, translate manual
  y background) siguen funcionando con la versión actualmente desplegada.
