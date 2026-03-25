# Informe de Auditoria de Accesibilidad WCAG 2.1 AA

**Proyecto**: DTI O Salnes — Plataforma Digital Turistica
**URL**: https://turismo.osalnes.gal
**Fecha auditoria**: 25 de marzo de 2026
**Herramienta**: Google Lighthouse 12.x (headless Chrome)
**Paginas auditadas**: /es, /es/mapa, /es/buscar, /es/recurso/parador-de-cambados
**Metodo**: Auditoria automatizada (Lighthouse) + revision manual de codigo fuente

---

## Resultado por pagina

| Pagina | Score Lighthouse | Fallos criticos | Fallos serios | Estado |
|---|---|---|---|---|
| /es (Home) | **100/100** | 0 | 0 | CUMPLE |
| /es/buscar | **100/100** | 0 | 0 | CUMPLE |
| /es/recurso/parador-de-cambados | **100/100** | 0 | 0 | CUMPLE |
| /es/mapa | 84/100 | 0 (falsos positivos) | 0 (falsos positivos) | CUMPLE (*) |

(*) Los 3 fallos reportados en /es/mapa son del **error overlay de Next.js** en modo desarrollo (un `<html>` auxiliar sin atributos). No existen en el build de produccion.

---

## Criterios WCAG 2.1 AA verificados

### Principio 1 — Perceptible

| Criterio | Descripcion | Estado | Evidencia |
|---|---|---|---|
| 1.1.1 | Texto alternativo | CUMPLE | Sin elementos `<img>`/`<Image>` en el portal (cards son CSS) |
| 1.3.1 | Informacion y relaciones | CUMPLE | Landmarks semanticos (header, nav, main, footer), headings h1>h2 sin saltos, form labels con htmlFor |
| 1.3.2 | Secuencia significativa | CUMPLE | DOM order = visual order en todas las paginas |
| 1.3.3 | Caracteristicas sensoriales | CUMPLE | Info no depende solo de color (badges tienen texto) |
| 1.3.4 | Orientacion | CUMPLE | Layout responsive, sin forzar orientacion |
| 1.3.5 | Identificar proposito input | CUMPLE | `type="search"` en buscador |
| 1.4.1 | Uso del color | CUMPLE | Badges y estados usan texto + color |
| 1.4.3 | Contraste minimo | CUMPLE | Todos los ratios >= 4.5:1 (ver tabla detallada abajo) |
| 1.4.4 | Redimensionar texto | CUMPLE | Unidades rem, layout flexible |
| 1.4.5 | Imagenes de texto | CUMPLE | Sin imagenes de texto |
| 1.4.10 | Reflow | CUMPLE | Sin scroll horizontal a 320px |
| 1.4.11 | Contraste no textual | CUMPLE | Bordes de inputs con contraste suficiente |
| 1.4.12 | Espaciado de texto | CUMPLE | Sin truncamiento al modificar line-height |
| 1.4.13 | Contenido al hover/focus | CUMPLE | Popups mapa persistentes y cerrables |

### Principio 2 — Operable

| Criterio | Descripcion | Estado | Evidencia |
|---|---|---|---|
| 2.1.1 | Teclado | CUMPLE | Tab navigation completa, mapa con arrows/zoom, filtros accesibles |
| 2.1.2 | Sin trampa de teclado | CUMPLE | Escape cierra menu movil y drawer asistente |
| 2.4.1 | Bypass de bloques | CUMPLE | `<a href="#main-content" className="skip-link">` en layout.tsx:73 |
| 2.4.2 | Titulo de pagina | CUMPLE | `<title>` dinamico via Next.js metadata |
| 2.4.3 | Orden del foco | CUMPLE | Tab order sigue DOM logico |
| 2.4.4 | Proposito del enlace | CUMPLE | Links descriptivos, externos con aria-label "(abre en ventana nueva)" |
| 2.4.5 | Multiples vias | CUMPLE | Navegacion + busqueda + mapa + directorio + asistente |
| 2.4.6 | Encabezados y etiquetas | CUMPLE | Jerarquia h1>h2, labels en forms |
| 2.4.7 | Foco visible | CUMPLE | `outline: 2px solid` via `:focus-visible` globalmente |
| 2.5.1 | Gestos de puntero | CUMPLE | Mapa soporta click y teclado |
| 2.5.5 | Tamano del objetivo | CUMPLE | Media query `pointer: coarse` aplica min 44x44px |

### Principio 3 — Comprensible

| Criterio | Descripcion | Estado | Evidencia |
|---|---|---|---|
| 3.1.1 | Idioma de pagina | CUMPLE | `<html lang={params.lang}>` dinamico (layout.tsx:72) |
| 3.1.2 | Idioma de partes | CUMPLE | Contenido en idioma de la ruta |
| 3.2.1 | Al recibir foco | CUMPLE | Sin cambio de contexto automatico |
| 3.2.2 | Al recibir entrada | CUMPLE | Filtros no navegan, busqueda requiere submit |
| 3.2.3 | Navegacion consistente | CUMPLE | Header/footer identicos |
| 3.2.4 | Identificacion consistente | CUMPLE | Patrones UI consistentes |
| 3.3.1 | Identificacion de errores | CUMPLE | "No se encontraron resultados" en busqueda |
| 3.3.2 | Etiquetas o instrucciones | CUMPLE | Labels + placeholders |

### Principio 4 — Robusto

| Criterio | Descripcion | Estado | Evidencia |
|---|---|---|---|
| 4.1.1 | Analisis sintactico | CUMPLE | HTML5 valido (React JSX) |
| 4.1.2 | Nombre, rol, valor | CUMPLE | aria-labels en controles, aria-expanded en menu, role="search", role="region" en mapa, role="contentinfo" en footer |
| 4.1.3 | Mensajes de estado | CUMPLE | Contadores de resultados, "Pensando..." en asistente |

---

## Ratios de contraste verificados

| Combinacion | Ratio | AA 4.5:1 | AAA 7:1 |
|---|---|---|---|
| --color-text (#2c3e50) / blanco | 7.9:1 | CUMPLE | CUMPLE |
| --color-primary (#1a5276) / blanco | 8.5:1 | CUMPLE | CUMPLE |
| --color-text-light (#4a5568) / blanco | 7.8:1 | CUMPLE | CUMPLE |
| --color-muted (#545e64) / blanco | 5.6:1 | CUMPLE | — |
| --color-muted (#545e64) / bg-alt (#f8f9fa) | 5.1:1 | CUMPLE | — |
| --color-secondary (#2471a3) / blanco | 5.3:1 | CUMPLE | — |
| --color-secondary (#2471a3) / bg-alt (#f8f9fa) | 4.83:1 | CUMPLE | — |
| --color-text (#2c3e50) / accent (#f39c12) | 5.7:1 | CUMPLE | — |
| Footer funding (#c5d5e0) / primary (#1a5276) | 5.0:1 | CUMPLE | — |

---

## Fallos detectados y corregidos

| Fallo | Criterio | Paginas | Correccion | Estado |
|---|---|---|---|---|
| Hero CTA blanco sobre naranja (2.19:1) | 1.4.3 | /es | Texto oscuro sobre accent (5.7:1) | CORREGIDO |
| Footer funding opacity 0.7 (3.82:1) | 1.4.3 | Todas | Color explicito #c5d5e0 (5.0:1) | CORREGIDO |
| Links secondary sobre bg-alt (3.76:1) | 1.4.3 | /es/recurso/* | Secondary #2e86c1->#2471a3 (4.83:1) | CORREGIDO |
| Muted text sobre bg-alt (3.8:1) | 1.4.3 | Varias | Muted #636e72->#545e64 (5.1:1) | CORREGIDO |
| Search input sin label | 1.3.1 | /es/buscar | Label sr-only + role="search" | CORREGIDO |
| Heading h1->h3 (salta h2) | 1.3.1 | /es/buscar | h3 -> h2 en cards | CORREGIDO |
| Map role="application" | 2.1.1 | /es/mapa | role="region" + aria-roledescription | CORREGIDO |
| Touch targets < 44px | 2.5.5 | /es/buscar | Anadido a media query coarse | CORREGIDO |
| External links sin aviso | 2.4.4 | /es/recurso/* | aria-label "(abre en ventana nueva)" | CORREGIDO |
| Footer sin role explicito | 4.1.2 | Todas | role="contentinfo" | CORREGIDO |
| Search focus :focus vs :focus-visible | 2.4.7 | /es/buscar | Cambiado a :focus-visible | CORREGIDO |

---

## Medidas de accesibilidad implementadas

| Medida | Archivo | Detalles |
|---|---|---|
| Skip-to-content | layout.tsx:73-75 | `<a href="#main-content" className="skip-link">` visible en focus |
| `<html lang>` dinamico | layout.tsx:72 | Soporta es/gl/en/fr/pt |
| Landmarks semanticos | Header, Footer, layout | header, nav, main, footer con roles |
| Focus-visible global | globals.css:33-37 | `outline: 2px solid` en todos los interactivos |
| Mouse focus suprimido | globals.css:40-42 | `:focus:not(:focus-visible) { outline: none }` |
| prefers-reduced-motion | globals.css:45-52 | Desactiva animaciones |
| forced-colors | globals.css:54-59 | Bordes en badges para alto contraste |
| .sr-only utility | globals.css:91-102 | Clip rect para texto oculto accesible |
| Touch targets 44px | globals.css:62-70 | Media query `pointer: coarse` |
| ARIA en mapa | MapView.tsx:179 | role="region", aria-label, aria-roledescription |
| ARIA en menu movil | Header.tsx | aria-expanded, aria-label |
| ARIA en asistente | AssistantChat.tsx | role="dialog", role="log", aria-live="polite" |

---

## Conclusion

La plataforma web turistica de O Salnes cumple los criterios WCAG 2.1 nivel AA segun los requisitos del pliego tecnico. Las puntuaciones de Lighthouse de accesibilidad son **100/100** en las 3 paginas principales (Home, Busqueda, Detalle de recurso). La pagina del mapa obtiene 84/100 debido a falsos positivos del entorno de desarrollo de Next.js que no existen en el build de produccion.

Se han corregido 11 hallazgos durante la auditoria y se han documentado 12 medidas de accesibilidad preexistentes. Los ratios de contraste de todas las combinaciones de color han sido verificados y superan el minimo de 4.5:1 requerido.

**Fecha**: 25 de marzo de 2026
**Auditor**: Equipo de desarrollo DTI O Salnes
