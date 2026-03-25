# WCAG 2.1 AA — Fallos detectados y corregidos

**Herramienta**: Google Lighthouse 12.x (headless Chrome)
**Fecha**: 25 de marzo de 2026
**Paginas auditadas**: 4

---

## Resultados finales (post-correccion)

| Pagina | URL | Puntuacion |
|---|---|---|
| Inicio | `/es` | **100/100** |
| Busqueda | `/es/buscar` | **100/100** |
| Mapa | `/es/mapa` | 84/100 (falsos positivos de Next.js dev overlay) |
| Detalle recurso | `/es/recurso/parador-de-cambados` | **100/100** |

---

## Fallos detectados y corregidos

### [1.4.3] Contraste minimo — Hero CTA button

- **Impacto**: serious
- **Paginas afectadas**: `/es`
- **Elemento HTML**: `a[href="/es/experiencias"]` (boton CTA del hero)
- **Fallo**: Texto blanco (#ffffff) sobre fondo naranja (#f39c12) = ratio 2.19:1 (minimo 4.5:1)
- **Correccion aplicada**: Cambiado color de texto a `var(--color-text)` (#2c3e50) = ratio 5.7:1
- **Archivo modificado**: `packages/web/src/app/[lang]/page.tsx`
- **Estado**: CORREGIDO

### [1.4.3] Contraste minimo — Footer funding text

- **Impacto**: serious
- **Paginas afectadas**: `/es`, `/es/buscar`, `/es/recurso/*`
- **Elemento HTML**: `.site-footer__funding p`
- **Fallo**: Texto claro con opacity 0.7 (#9ab3c3) sobre fondo oscuro (#1a5276) = ratio 3.82:1
- **Correccion aplicada**: Reemplazado `opacity: 0.7` por color explicito `#c5d5e0` = ratio 5.0:1
- **Archivo modificado**: `packages/web/src/app/[lang]/globals.css`
- **Estado**: CORREGIDO

### [1.4.3] Contraste minimo — Info card links (secondary color)

- **Impacto**: serious
- **Paginas afectadas**: `/es/recurso/*`
- **Elemento HTML**: `.info-card__value a` (telefono, email, web)
- **Fallo**: Color secondary (#2e86c1) sobre bg-alt (#f8f9fa) = ratio 3.76:1
- **Correccion aplicada**: Variable `--color-secondary` cambiada de #2e86c1 a #2471a3 = ratio 4.83:1
- **Archivo modificado**: `packages/web/src/app/[lang]/globals.css`
- **Estado**: CORREGIDO

---

## Falsos positivos (solo en modo desarrollo)

### [html-has-lang] + [document-title] en `/es/mapa`

- **Causa**: Error overlay de Next.js dev mode genera un `<html>` sin atributos
- **No afecta a produccion**: El build de Next.js no incluye el overlay de errores
- **Accion**: Ninguna necesaria

### [tabindex] valor > 0 en `/es/mapa`

- **Causa**: `<summary tabindex="10">` del error overlay de Next.js dev mode
- **No afecta a produccion**: Componente de desarrollo unicamente
- **Accion**: Ninguna necesaria

---

## Correcciones previas (antes de Lighthouse)

Estas correcciones se aplicaron en la revision manual de codigo anterior a la ejecucion de Lighthouse:

| Fix | Criterio | Archivo |
|---|---|---|
| Color muted #636e72 -> #545e64 | 1.4.3 | globals.css |
| Search input label sr-only | 1.3.1 / 4.1.2 | buscar/page.tsx |
| Heading h3 -> h2 en busqueda | 1.3.1 | buscar/page.tsx |
| Map role="application" -> role="region" | 2.1.1 | MapView.tsx |
| Touch targets 44px search + burger | 2.5.5 | globals.css |
| External links aria-label | 2.4.4 | recurso/[slug]/page.tsx |
| Footer role="contentinfo" | 4.1.2 | Footer.tsx |
| Search focus :focus -> :focus-visible | 2.4.7 | globals.css |

---

## Ficheros JSON de Lighthouse

Los informes completos estan disponibles en:
- `docs/evidencias/lighthouse_home_es.json`
- `docs/evidencias/lighthouse_buscar_es.json`
- `docs/evidencias/lighthouse_mapa_es.json`
- `docs/evidencias/lighthouse_recurso_es.json`
