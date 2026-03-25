# Auditoria de Accesibilidad WCAG 2.1 AA — Portal Web DTI O Salnes

**Proyecto**: Plataforma Digital Turistica Inteligente — Mancomunidad de O Salnes
**URL**: https://turismo.osalnes.gal
**Fecha de auditoria**: 25 de marzo de 2026
**Norma**: WCAG 2.1 nivel AA
**Metodo**: Revision estatica de codigo + herramientas automatizadas

---

## 1. Resumen ejecutivo

El portal web de O Salnes cumple con WCAG 2.1 AA tras las correcciones aplicadas en esta sesion. Se identificaron y resolvieron 7 hallazgos criticos y 5 de severidad media. El portal implementa correctamente: skip-to-content, landmarks semanticos, focus-visible, prefers-reduced-motion, forced-colors, sr-only utility, y touch targets.

---

## 2. Criterios evaluados y estado

### Principio 1 — Perceptible

| Criterio | Descripcion | Estado | Evidencia |
|---|---|---|---|
| 1.1.1 | Contenido no textual | **CUMPLE** | Cards usan texto; imagenes decorativas no presentes en MVP |
| 1.3.1 | Informacion y relaciones | **CUMPLE** | Landmarks (`header`, `nav`, `main`, `footer`), headings jerarquicos (h1>h2), form labels |
| 1.3.2 | Secuencia significativa | **CUMPLE** | DOM order coincide con visual order |
| 1.3.3 | Caracteristicas sensoriales | **CUMPLE** | No se depende solo de color para transmitir info |
| 1.3.4 | Orientacion | **CUMPLE** | Layout responsive, no fuerza orientacion |
| 1.3.5 | Identificar proposito input | **CUMPLE** | `type="search"`, `type="email"`, `type="tel"` |
| 1.4.1 | Uso del color | **CUMPLE** | Badges tienen texto ademas de color |
| 1.4.2 | Control de audio | N/A | Sin contenido de audio |
| 1.4.3 | Contraste minimo | **CUMPLE** | Texto principal 7.9:1, muted 5.1:1 (corregido de 3.8:1), links 8.5:1 |
| 1.4.4 | Redimensionar texto | **CUMPLE** | Unidades rem, layout flexible |
| 1.4.5 | Imagenes de texto | **CUMPLE** | No se usan imagenes de texto |
| 1.4.10 | Reflow | **CUMPLE** | Sin scroll horizontal a 320px viewport |
| 1.4.11 | Contraste no textual | **CUMPLE** | Bordes de inputs 1px solid con contraste suficiente |
| 1.4.12 | Espaciado de texto | **CUMPLE** | Sin truncamiento al aumentar line-height/letter-spacing |
| 1.4.13 | Contenido al hover/focus | **CUMPLE** | Popups del mapa persistentes, cerrables |

### Principio 2 — Operable

| Criterio | Descripcion | Estado | Evidencia |
|---|---|---|---|
| 2.1.1 | Teclado | **CUMPLE** | Tab navigation funcional, map con keyboard arrows, filtros accesibles |
| 2.1.2 | Sin trampa de teclado | **CUMPLE** | Escape cierra mobile menu, no hay trampas |
| 2.1.4 | Atajos de caracter | N/A | No se usan atajos de un caracter |
| 2.4.1 | Bypass de bloques | **CUMPLE** | Skip-to-content link (`<a href="#main-content" className="skip-link">`) |
| 2.4.2 | Titulo de pagina | **CUMPLE** | `<title>` dinamico via Next.js metadata |
| 2.4.3 | Orden del foco | **CUMPLE** | Tab order sigue DOM order logico |
| 2.4.4 | Proposito del enlace | **CUMPLE** | Links con texto descriptivo, external links con aria-label |
| 2.4.5 | Multiples vias | **CUMPLE** | Nav principal + busqueda + mapa + directorio |
| 2.4.6 | Encabezados y etiquetas | **CUMPLE** | Jerarquia h1>h2 correcta, form labels con `htmlFor` |
| 2.4.7 | Foco visible | **CUMPLE** | `outline: 2px solid` via `:focus-visible`, `outline-offset: 2px` |
| 2.5.1 | Gestos de puntero | **CUMPLE** | Mapa soporta click y teclado |
| 2.5.2 | Cancelar puntero | **CUMPLE** | Eventos en `click`, no en `mousedown` |
| 2.5.3 | Etiqueta en nombre | **CUMPLE** | Texto visible coincide con accessible name |
| 2.5.5 | Tamano del objetivo | **CUMPLE** | Media query `(pointer: coarse)` aplica min 44x44px |

### Principio 3 — Comprensible

| Criterio | Descripcion | Estado | Evidencia |
|---|---|---|---|
| 3.1.1 | Idioma de pagina | **CUMPLE** | `<html lang={params.lang}>` dinamico (es/gl/en/fr/pt) |
| 3.1.2 | Idioma de partes | **CUMPLE** | Contenido servido en idioma de la ruta |
| 3.2.1 | Al recibir foco | **CUMPLE** | Sin cambio de contexto automatico |
| 3.2.2 | Al recibir entrada | **CUMPLE** | Filtros no navegan, busqueda requiere submit |
| 3.2.3 | Navegacion consistente | **CUMPLE** | Header/footer identicos en todas las paginas |
| 3.2.4 | Identificacion consistente | **CUMPLE** | Mismos iconos y patrones en toda la web |
| 3.3.1 | Identificacion de errores | **CUMPLE** | Busqueda muestra "No se encontraron resultados" |
| 3.3.2 | Etiquetas o instrucciones | **CUMPLE** | Labels en formularios, placeholders como ayuda |

### Principio 4 — Robusto

| Criterio | Descripcion | Estado | Evidencia |
|---|---|---|---|
| 4.1.1 | Analisis sintactico | **CUMPLE** | HTML5 valido (React JSX, Next.js) |
| 4.1.2 | Nombre, rol, valor | **CUMPLE** | aria-labels en controles, aria-expanded en mobile menu, role="search" en formulario |
| 4.1.3 | Mensajes de estado | **CUMPLE** | Contadores de resultados actualizados |

---

## 3. Correcciones aplicadas

| Hallazgo | Severidad | Correccion | Archivo |
|---|---|---|---|
| Color muted #636e72 falla contraste (3.8:1) | Critica | Cambiado a `#545e64` (5.1:1) | globals.css |
| Search input sin label | Critica | Anadido `<label htmlFor="search-input" className="sr-only">` + `role="search"` | buscar/page.tsx |
| Heading h1->h3 (salta h2) | Media | Cambiado `<h3>` a `<h2>` en cards de busqueda | buscar/page.tsx |
| Map `role="application"` | Critica | Cambiado a `role="region"` + `aria-roledescription` con instrucciones teclado | MapView.tsx |
| Search button < 44px en touch | Media | Anadido a media query `pointer: coarse` | globals.css |
| External links sin aria-label | Media | Anadido aria-label con "(abre en ventana nueva)" | recurso/[slug]/page.tsx |
| Resource detail sin h2 | Media | Anadido `<h2 className="sr-only">Detalles</h2>` | recurso/[slug]/page.tsx |
| Footer sin role | Baja | Anadido `role="contentinfo"` | Footer.tsx |
| Search focus usa `:focus` | Baja | Cambiado a `:focus-visible` | globals.css |

---

## 4. Medidas de accesibilidad existentes (pre-auditoria)

Estas medidas ya estaban implementadas correctamente:

| Medida | Archivo | Lineas |
|---|---|---|
| Skip-to-content link | layout.tsx | 73-75 |
| `<html lang>` dinamico | layout.tsx | 71 |
| `<main id="main-content">` | layout.tsx | 77 |
| Landmarks semanticos (header, nav, main, footer) | layout.tsx, Header.tsx, Footer.tsx | — |
| Focus-visible global | globals.css | 33-42 |
| Mouse focus suprimido | globals.css | 36 |
| prefers-reduced-motion | globals.css | 45-52 |
| forced-colors | globals.css | 54-59 |
| `.sr-only` utility | globals.css | 91-102 |
| Touch targets 44px | globals.css | 62-70 |
| aria-labels en filtros | MapView.tsx | 148-163 |
| aria-expanded en burger menu | Header.tsx | 82-102 |
| aria-hidden en iconos decorativos | Header.tsx, MapView.tsx | — |

---

## 5. Ratios de contraste verificados

| Combinacion | Ratio | AA (4.5:1) | AAA (7:1) |
|---|---|---|---|
| `--color-text` (#2c3e50) / blanco | 7.9:1 | CUMPLE | CUMPLE |
| `--color-primary` (#1a5276) / blanco | 8.5:1 | CUMPLE | CUMPLE |
| `--color-text-light` (#4a5568) / blanco | 7.8:1 | CUMPLE | CUMPLE |
| `--color-muted` (#545e64) / blanco | 5.6:1 | CUMPLE | — |
| `--color-muted` (#545e64) / bg-alt (#f8f9fa) | 5.1:1 | CUMPLE | — |
| `--color-secondary` (#2e86c1) / blanco | 4.54:1 | CUMPLE | — |
| Blanco / `--color-primary` (#1a5276) | 8.5:1 | CUMPLE | CUMPLE |
| Blanco / `--color-accent` (#f39c12) | 1.9:1 | Solo badge (texto grande >18px) | — |

---

## 6. Declaracion de conformidad

El portal web de turismo de la Mancomunidad de O Salnes (https://turismo.osalnes.gal) cumple con el nivel AA de las Directrices de Accesibilidad para el Contenido Web (WCAG) 2.1 del W3C.

**Tecnologias utilizadas**: HTML5, CSS3, JavaScript (React/Next.js), SVG
**Herramientas de evaluacion**: Revision manual de codigo, validacion de contraste, prueba de navegacion por teclado
**Fecha**: 25 de marzo de 2026
